import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.responses import Response
from starlette.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from sqlalchemy import func

from models.quote import QuoteItem, QuoteRequest, QuoteRequestCreate, QuoteRevision, ModifiedQuoteCreate, ModifiedQuote, CustomerQuoteResponse
from utils.contact_validation import raise_if_invalid_email, raise_if_invalid_phone
from models.user import UserResponse
from pydantic import BaseModel
from utils.auth import get_current_user, get_optional_user, get_admin_user
from utils.permissions import can_see_buying_price, require_company_permission
from utils.sales_scope import resolve_sales_assignee_id
from repositories.quotes import generate_qt_quote_reference
from utils.email_service import send_quote_request_email, send_modified_quote_email
from utils.totals import calculate_subtotal, calculate_list_subtotal, calculate_totals, validate_pricing, DEFAULT_TAX_RATE
from utils.logger import logger
from utils.chat_attachments import (
    sanitize_attachments,
    save_chat_upload,
    serialize_quote_message,
)
from db.models import (
    Quote as QuoteModel,
    QuoteItem as QuoteItemModel,
    SiteSettings,
)
from deps import get_db
from utils.pdf import generate_quote_pdf
import base64

router = APIRouter()


class MessageAttachmentIn(BaseModel):
    type: str
    name: Optional[str] = None
    url: str
    mime: Optional[str] = None


class QuoteMessageCreate(BaseModel):
    body: str = ""
    attachments: List[MessageAttachmentIn] = []

# ---- customer quote endpoints -----------------------------------------------

@router.post("/quotes/draft-reference", response_model=dict, tags=["quotes"])
async def create_draft_quote_reference(
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a unique draft quote reference for the client-side basket."""
    reference = await run_in_threadpool(generate_qt_quote_reference, db)
    return {"reference": reference}


@router.post("/quotes", response_model=dict, tags=["quotes"])
async def create_quote_request(
    quote_data: QuoteRequestCreate,
    current_user: Optional[UserResponse] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Customer submits a quote request."""
    quote_dict = quote_data.dict()
    quote_dict["id"] = str(uuid.uuid4())
    if quote_data.quote_number:
        quote_dict["quote_number"] = quote_data.quote_number

    is_facility_submit = False
    if current_user:
        from db.models import User as UserModel

        user_row = db.query(UserModel).filter(UserModel.id == current_user.id).one_or_none()
        quote_dict["user_id"] = current_user.id
        quote_dict["ordered_by_user_id"] = current_user.id
        if user_row and user_row.organization_id:
            is_facility_submit = True
            quote_dict["email"] = current_user.email
            from utils.permissions import resolve_write_branch_id
            from db.models import DeliveryLocation, Branch

            quote_dict["organization_id"] = user_row.organization_id
            if user_row.role in ("branch_admin", "branch_user"):
                branch_id = resolve_write_branch_id(db, user_row, quote_data.ordered_for_branch_id)
            elif quote_data.ordered_for_branch_id:
                branch_id = resolve_write_branch_id(db, user_row, quote_data.ordered_for_branch_id)
            else:
                branch_id = None
            if branch_id:
                quote_dict["ordered_for_branch_id"] = branch_id

            if user_row.role in ("branch_admin", "branch_user"):
                if quote_data.delivery_location_id:
                    loc = (
                        db.query(DeliveryLocation)
                        .filter(DeliveryLocation.id == quote_data.delivery_location_id)
                        .one_or_none()
                    )
                    if not loc or (
                        loc.branch_id and loc.branch_id != branch_id
                    ):
                        raise HTTPException(
                            status_code=403,
                            detail="Delivery location must belong to your branch",
                        )
                    quote_dict["delivery_location_id"] = loc.id
                else:
                    branch = db.query(Branch).filter(Branch.id == branch_id).one_or_none()
                    quote_dict["delivery_snapshot"] = quote_data.delivery_snapshot or {
                        "label": branch.name if branch else "Branch",
                        "address_line": (branch.delivery_address or branch.physical_address)
                        if branch
                        else "",
                        "county": branch.county if branch else None,
                    }
            else:
                if quote_data.delivery_location_id:
                    quote_dict["delivery_location_id"] = quote_data.delivery_location_id
                if quote_data.delivery_snapshot:
                    quote_dict["delivery_snapshot"] = quote_data.delivery_snapshot

    if not is_facility_submit:
        # Public website / guest submissions.
        # Contact-page quote inquiries only collect facility + contact + notes/categories.
        # Quote-cart checkouts include products and still require address + branch.
        missing = []
        for field, label in (
            ("facility_name", "Facility name"),
            ("contact_person", "Contact person"),
            ("email", "Email"),
            ("phone", "Phone"),
        ):
            if not str(getattr(quote_data, field, None) or "").strip():
                missing.append(label)
        has_items = bool(quote_data.items)
        has_notes = bool(str(quote_data.additional_notes or "").strip())
        if has_items:
            for field, label in (
                ("address", "Facility address"),
                ("branch_name", "Branch"),
            ):
                if not str(getattr(quote_data, field, None) or "").strip():
                    missing.append(label)
        if missing:
            raise HTTPException(status_code=400, detail=f"Please provide: {', '.join(missing)}")
        if not has_items and not has_notes:
            raise HTTPException(
                status_code=400,
                detail="Add at least one product, or describe the categories/products you need",
            )
        snap = dict(quote_data.delivery_snapshot or {})
        snap.update({
            "guest": True,
            "branch_name": (quote_data.branch_name or "").strip() or snap.get("branch_name"),
            "facility_type": (quote_data.facility_type or "").strip() or snap.get("facility_type"),
            "address_line": snap.get("address_line") or (quote_data.address or "").strip(),
            "county": (quote_data.county or "").strip() or snap.get("county"),
            "inquiry_only": not has_items,
        })
        quote_dict["delivery_snapshot"] = snap
        quote_dict.pop("organization_id", None)
        quote_dict.pop("ordered_for_branch_id", None)
        quote_dict.pop("delivery_location_id", None)

    # Customer quote request — list prices only until admin quotes
    normalized_items = []
    for item in quote_dict.get("items", []):
        row = dict(item)
        list_price = row.get("list_price")
        if list_price is None and row.get("unit_price"):
            list_price = row.get("unit_price")
        row["list_price"] = float(list_price or 0)
        row["unit_price"] = 0
        normalized_items.append(row)
    quote_dict["items"] = normalized_items

    quote_dict["status"] = "pending"
    quote_dict["current_handler"] = "ADMIN_REVIEW"
    quote_dict["created_at"] = datetime.utcnow()
    quote_dict["updated_at"] = datetime.utcnow()
    quote_dict["discount_amount"] = 0
    quote_dict["tax_rate"] = DEFAULT_TAX_RATE
    quote_dict["tax_amount"] = 0
    quote_dict["list_subtotal"] = calculate_list_subtotal(normalized_items)
    quote_dict["subtotal"] = 0
    quote_dict["total"] = 0

    # Persist to Postgres via repository
    from repositories import quotes as quotes_repo

    created = await run_in_threadpool(quotes_repo.create_quote_with_items, db, quote_dict)
    logger.info(f"Quote request created: {quote_dict['id']}")
    from utils.live_events import publish_entity_event
    publish_entity_event(
        "quote.updated",
        entity_type="quote",
        entity_id=quote_dict["id"],
        organization_id=quote_dict.get("organization_id"),
        quote_id=quote_dict["id"],
    )

    try:
        from utils.activity import log_activity
        def _log_submit():
            log_activity(
                db,
                entity_type="quote",
                entity_id=quote_dict["id"],
                event_type="submitted",
                summary=f"{quote_dict.get('contact_person')} submitted quote {created.get('quote_number') or quote_dict['id'][:8]}",
                actor_id=quote_dict.get("user_id"),
                actor_name=quote_dict.get("contact_person"),
                actor_role="customer",
                commit=True,
            )
        await run_in_threadpool(_log_submit)
    except Exception as e:
        logger.error(f"Failed to log quote submission: {str(e)}")
    
    # Send notification emails (admin + customer confirmation)
    try:
        send_quote_request_email(
            facility_name=quote_dict.get("facility_name", ""),
            contact_person=quote_dict.get("contact_person", ""),
            email=quote_dict.get("email", ""),
            phone=quote_dict.get("phone", ""),
            items=quote_dict.get("items") or [],
            additional_notes=quote_dict.get("additional_notes") or "",
            address=quote_dict.get("address") or "",
            branch_name=quote_dict.get("branch_name") or "",
        )
    except Exception as e:
        logger.error(f"Failed to send quote confirmation: {str(e)}")
    
    return {
        "message": "Quote request received. We'll respond shortly.",
        "quote_id": quote_dict["id"],
        "status": "pending"
    }

@router.get("/quotes", tags=["quotes"])
async def list_customer_quotes(
    branch_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    page: Optional[int] = None,
    limit: int = 10,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List quotes for the logged-in customer or organization."""
    from repositories import quotes as quotes_repo
    from db.models import User as UserModel
    from utils.permissions import resolve_list_branch_ids
    from utils.list_query import parse_day_start, parse_day_end, clamp_page, paginated_payload

    user_row = db.query(UserModel).filter(UserModel.id == current_user.id).one_or_none()
    page_n, limit_n, _ = clamp_page(page or 1, limit)
    start = parse_day_start(from_date)
    end = parse_day_end(to_date)

    if user_row and user_row.organization_id:
        branch_ids = resolve_list_branch_ids(db, user_row, branch_id)
        quotes, total = await run_in_threadpool(
            quotes_repo.list_quotes_facility,
            db,
            organization_id=user_row.organization_id,
            branch_ids=branch_ids,
            status=status or None,
            search=search,
            from_date=start,
            to_date=end,
            page=page_n,
            limit=limit_n if page is not None else 200,
        )
    else:
        quotes, total = await run_in_threadpool(
            quotes_repo.list_quotes_facility,
            db,
            user_id=current_user.id,
            status=status or None,
            search=search,
            from_date=start,
            to_date=end,
            page=page_n,
            limit=limit_n if page is not None else 100,
        )

    items = [quotes_repo.strip_admin_pricing_fields(q) for q in (quotes or [])]
    if page is None:
        return items
    return paginated_payload(items, total, page_n, limit_n)


@router.get("/quotes/inbox/unread-count", tags=["quotes"])
async def facility_unread_message_count(
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from db.models import QuoteMessage, User as UserModel

    user_row = db.query(UserModel).filter(UserModel.id == current_user.id).one_or_none()
    q = db.query(func.count(QuoteMessage.id)).join(QuoteModel, QuoteMessage.quote_id == QuoteModel.id).filter(
        QuoteMessage.is_read.is_(False),
        QuoteMessage.sender_role == "admin",
    )
    if user_row and user_row.organization_id:
        q = q.filter(QuoteModel.organization_id == user_row.organization_id)
    else:
        q = q.filter(QuoteModel.user_id == current_user.id)
    return {"count": q.scalar() or 0}

@router.get("/quotes/{quote_id}", response_model=dict, tags=["quotes"])
async def get_quote(
    quote_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific quote (customer can only see their own)."""
    from repositories import quotes as quotes_repo

    quote = await run_in_threadpool(quotes_repo.get_quote_by_id, db, quote_id)
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    from db.models import User as UserModel
    from utils.permissions import get_user_accessible_branch_ids, require_branch_access

    user_row = db.query(UserModel).filter(UserModel.id == current_user.id).one_or_none()
    if user_row and user_row.organization_id and quote.get("organization_id") == user_row.organization_id:
        if user_row.role in ("branch_admin", "branch_user"):
            branch_id = quote.get("ordered_for_branch_id")
            if branch_id:
                require_branch_access(db, user_row, branch_id)
        elif quote.get("user_id") != current_user.id and user_row.role not in ("org_admin", "admin"):
            raise HTTPException(status_code=404, detail="Quote not found")
    elif quote.get("user_id") != current_user.id:
        raise HTTPException(status_code=404, detail="Quote not found")
    return quotes_repo.strip_admin_pricing_fields(quote)


class DraftQuoteSubmit(BaseModel):
    items: List[QuoteItem]
    additional_notes: Optional[str] = None
    ordered_for_branch_id: Optional[str] = None
    delivery_location_id: Optional[str] = None


@router.post("/quotes/{quote_id}/submit", response_model=dict, tags=["quotes"])
async def submit_draft_quote(
    quote_id: str,
    payload: DraftQuoteSubmit,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit a facility draft quote (from Order again) for admin review."""
    from db.models import User as UserModel, QuoteItem as QuoteItemRow
    from utils.permissions import require_branch_access, resolve_write_branch_id
    from utils.quote_items import recalc_quote_totals
    from repositories import quotes as quotes_repo

    user_row = db.query(UserModel).filter(UserModel.id == current_user.id).one_or_none()
    quote_row = db.query(QuoteModel).filter(QuoteModel.id == quote_id).one_or_none()
    if not quote_row:
        raise HTTPException(status_code=404, detail="Quote not found")
    if not user_row or quote_row.organization_id != user_row.organization_id:
        raise HTTPException(status_code=404, detail="Quote not found")
    if quote_row.status != "draft":
        raise HTTPException(status_code=400, detail="This quote has already been submitted")
    if not payload.items:
        raise HTTPException(status_code=400, detail="Add at least one product")

    if quote_row.ordered_for_branch_id and user_row.role in ("branch_admin", "branch_user"):
        require_branch_access(db, user_row, quote_row.ordered_for_branch_id)

    if payload.ordered_for_branch_id:
        branch_id = resolve_write_branch_id(db, user_row, payload.ordered_for_branch_id)
        quote_row.ordered_for_branch_id = branch_id
    if payload.delivery_location_id:
        quote_row.delivery_location_id = payload.delivery_location_id
    if payload.additional_notes is not None:
        quote_row.additional_notes = payload.additional_notes

    normalized_items = []
    for item in payload.items:
        row = item.model_dump() if hasattr(item, "model_dump") else item.dict()
        list_price = row.get("list_price")
        if list_price is None and row.get("unit_price"):
            list_price = row.get("unit_price")
        row["list_price"] = float(list_price or 0)
        row["unit_price"] = 0
        normalized_items.append(row)

    existing = db.query(QuoteItemRow).filter(QuoteItemRow.quote_id == quote_id).all()
    for row in existing:
        db.delete(row)
    db.flush()
    enriched = quotes_repo.enrich_quote_items_from_catalog(db, normalized_items)
    for row in enriched:
        row["unit_price"] = 0
    items = quotes_repo._build_quote_items_from_payload(quote_id, enriched)
    for item in items:
        db.add(item)
    quote_row.list_subtotal = calculate_list_subtotal(enriched)
    quote_row.subtotal = 0
    quote_row.total = 0
    quote_row.discount_amount = 0
    quote_row.tax_amount = 0
    recalc_quote_totals(quote_row, items)
    quote_row.status = "pending"
    quote_row.current_handler = "ADMIN_REVIEW"
    quote_row.updated_at = datetime.utcnow()
    quote_row.customer_snapshot = quotes_repo.customer_snapshot_from_payload(
        quotes_repo._serialize_quote_with_items(quote_row, items)
    )
    db.commit()
    db.refresh(quote_row)

    from utils.live_events import publish_entity_event
    publish_entity_event(
        "quote.updated",
        entity_type="quote",
        entity_id=quote_id,
        organization_id=quote_row.organization_id,
        quote_id=quote_id,
    )
    try:
        from utils.activity import log_activity
        log_activity(
            db,
            entity_type="quote",
            entity_id=quote_id,
            event_type="submitted",
            summary=f"{quote_row.contact_person} submitted quote {quote_row.quote_number or quote_id[:8]}",
            actor_id=current_user.id,
            actor_name=quote_row.contact_person,
            actor_role="customer",
            commit=True,
        )
    except Exception as e:
        logger.error(f"Failed to log quote submission: {str(e)}")
    try:
        item_rows = db.query(QuoteItemModel).filter(QuoteItemModel.quote_id == quote_id).all()
        send_quote_request_email(
            facility_name=quote_row.facility_name or "",
            contact_person=quote_row.contact_person or "",
            email=quote_row.email or "",
            phone=quote_row.phone or "",
            items=[
                {
                    "product_name": it.product_name,
                    "quantity": it.quantity,
                    "unit_price": it.unit_price or 0,
                }
                for it in item_rows
            ],
            additional_notes=quote_row.additional_notes or "",
            address=quote_row.address or "",
            branch_name=(
                (quote_row.delivery_snapshot or {}).get("branch_name")
                if isinstance(quote_row.delivery_snapshot, dict)
                else ""
            ) or "",
        )
    except Exception as e:
        logger.error(f"Failed to send quote confirmation: {str(e)}")

    return {
        "message": "Quote request received. We'll respond shortly.",
        "quote_id": quote_id,
        "status": "pending",
        "quote_number": quote_row.quote_number,
    }


def _company_info_for_pdf(db) -> dict:
    settings_row = (
        db.query(SiteSettings)
        .filter(SiteSettings.id == "site_settings")
        .one_or_none()
    )
    return {
        "company_name": settings_row.company_name if settings_row and settings_row.company_name else "Hampton Scientific Limited",
        "website": getattr(settings_row, "website", None) if settings_row else "",
        "address": settings_row.address if settings_row and settings_row.address else "",
        "po_box": settings_row.po_box if settings_row and settings_row.po_box else "",
        "phone": settings_row.phone if settings_row and settings_row.phone else "",
        "email": settings_row.email if settings_row and settings_row.email else "",
        "bank_name": settings_row.bank_name if settings_row and settings_row.bank_name else "",
        "bank_account_name": settings_row.bank_account_name if settings_row and settings_row.bank_account_name else "",
        "bank_account_number": settings_row.bank_account_number if settings_row and settings_row.bank_account_number else "",
        "mpesa_paybill": settings_row.mpesa_paybill if settings_row and settings_row.mpesa_paybill else "",
        "mpesa_account_number": settings_row.mpesa_account_number if settings_row and settings_row.mpesa_account_number else "",
        "mpesa_account_name": settings_row.mpesa_account_name if settings_row and settings_row.mpesa_account_name else "",
        "default_payment_terms": settings_row.default_payment_terms if settings_row and settings_row.default_payment_terms else "Net 30",
    }


def _quote_pdf_payload(db, quote_row) -> dict:
    from db.models import Branch

    items_rows = (
        db.query(QuoteItemModel)
        .filter(QuoteItemModel.quote_id == quote_row.id)
        .all()
    )
    items_payload = []
    for it in items_rows:
        qty = getattr(it, "quoted_quantity", None) or it.quantity
        unit = float(it.unit_price or 0)
        list_price = float(getattr(it, "list_price", None) or 0)
        items_payload.append(
            {
                "product_id": it.product_id,
                "product_name": it.product_name,
                "category": it.category,
                "quantity": qty,
                "quoted_quantity": qty,
                "list_price": list_price,
                "original_price": list_price,
                "unit_price": unit,
                "modified_price": unit if unit > 0 else None,
            }
        )
    branch = None
    if quote_row.ordered_for_branch_id:
        branch = db.query(Branch).filter(Branch.id == quote_row.ordered_for_branch_id).one_or_none()
    snap = quote_row.delivery_snapshot if isinstance(quote_row.delivery_snapshot, dict) else {}
    return {
        "id": quote_row.id,
        "quote_number": getattr(quote_row, "quote_number", None),
        "facility_name": quote_row.facility_name,
        "branch_name": (branch.name if branch else None) or snap.get("branch_name"),
        "delivery_snapshot": snap,
        "contact_person": quote_row.contact_person,
        "email": quote_row.email,
        "phone": quote_row.phone,
        "address": quote_row.address,
        "items": items_payload,
        "discount_amount": quote_row.discount_amount or 0,
        "tax_rate": quote_row.tax_rate or 0,
        "tax_amount": quote_row.tax_amount or 0,
        "subtotal": quote_row.subtotal or 0,
        "list_subtotal": getattr(quote_row, "list_subtotal", 0) or 0,
        "total": quote_row.total or 0,
        "validity_days": int(getattr(quote_row, "validity_days", None) or 7),
        "notes": quote_row.additional_notes or "",
        "additional_notes": quote_row.additional_notes or "",
        "include_vat": quote_row.include_vat if quote_row.include_vat is not None else True,
        "created_at": quote_row.created_at,
    }


async def _stream_quote_pdf(db, quote_row):
    quote_dict = _quote_pdf_payload(db, quote_row)
    settings_row = (
        db.query(SiteSettings)
        .filter(SiteSettings.id == "site_settings")
        .one_or_none()
    )
    quote_dict["terms_and_conditions"] = (
        settings_row.default_payment_terms if settings_row and settings_row.default_payment_terms else "Net 30"
    )
    pdf_base64 = await generate_quote_pdf(quote_dict, _company_info_for_pdf(db), is_modified=True)
    pdf_bytes = base64.b64decode(pdf_base64)
    filename = quote_row.quote_number or f"quote_{quote_row.id[:8].upper()}"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'},
    )


@router.get("/quotes/{quote_id}/download", tags=["quotes"])
async def download_customer_quote_pdf(
    quote_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from db.models import User as UserModel

    quote_row = db.query(QuoteModel).filter(QuoteModel.id == quote_id).one_or_none()
    if not quote_row:
        raise HTTPException(status_code=404, detail="Quote not found")
    user_row = db.query(UserModel).filter(UserModel.id == current_user.id).one_or_none()
    _assert_facility_quote_access(db, user_row, quote_row, current_user)
    return await _stream_quote_pdf(db, quote_row)


@router.put("/quotes/{quote_id}/revise", tags=["quotes"])
async def propose_quote_revision(
    quote_id: str,
    revision: QuoteRevision,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Customer proposes revised pricing for quote items."""
    from repositories import quotes as quotes_repo

    quote = await run_in_threadpool(quotes_repo.get_quote_by_id, db, quote_id)
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    if quote.get("user_id") != current_user.id:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    if quote["status"] not in ["quoted", "revised"]:
        raise HTTPException(
            status_code=400,
            detail="Can only propose revisions for quoted items"
        )
    
    # Store customer's proposed changes
    revision_doc = {
        "id": str(uuid.uuid4()),
        "quote_id": quote_id,
        "items": revision.items,
        "customer_notes": revision.customer_notes,
        "proposed_at": datetime.utcnow(),
        "status": "pending_review"
    }

    def _store_revision_and_update():
        from db.models import QuoteRevision as QuoteRevisionModel, Quote as QuoteModel

        rev = QuoteRevisionModel(
            id=revision_doc["id"],
            quote_id=quote_id,
            revised_by="customer",
            revised_by_id=current_user.id,
            notes=revision.customer_notes,
        )
        db.add(rev)

        q = db.query(QuoteModel).filter(QuoteModel.id == quote_id).one_or_none()
        if q:
            q.status = "revision_proposed"
            q.current_handler = "ADMIN_REVIEW"
        db.commit()

    await run_in_threadpool(_store_revision_and_update)
    
    logger.info(f"Quote revision proposed by {current_user.email} for {quote_id}")
    
    return {
        "message": "Revision proposal submitted for admin review",
        "revision_id": revision_doc["id"]
    }

@router.post("/quotes/{quote_id}/approve", tags=["quotes"])
async def approve_quote(
    quote_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Customer approves a quoted price (moves to invoicing)."""
    from repositories import quotes as quotes_repo

    quote = await run_in_threadpool(quotes_repo.get_quote_by_id, db, quote_id)
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    if quote.get("user_id") != current_user.id:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    if quote["status"] != "quoted":
        raise HTTPException(
            status_code=400,
            detail="Quote must be in 'quoted' status to approve"
        )
    
    def _mark_ready_for_invoicing():
        q = (
            db.query(QuoteModel)
            .filter(QuoteModel.id == quote_id, QuoteModel.user_id == current_user.id)
            .one_or_none()
        )
        if not q:
            return
        # Keep status as quoted; invoices creation will mark quote as invoiced.
        q.status = "quoted"
        q.current_handler = "ADMIN_INVOICING"
        db.add(q)
        db.commit()

    await run_in_threadpool(_mark_ready_for_invoicing)
    
    logger.info(f"Quote {quote_id} accepted by {current_user.email}")
    
    return {"message": "Quote accepted. Invoice will be prepared."}


@router.put("/quotes/{quote_id}/respond", tags=["quotes"])
async def respond_to_quote(
    quote_id: str,
    body: CustomerQuoteResponse,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Customer accepts or negotiates a quoted price."""
    from repositories import quotes as quotes_repo

    quote = await run_in_threadpool(quotes_repo.get_quote_by_id, db, quote_id)
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    from db.models import User as UserModel
    from utils.permissions import require_branch_access

    user_row = db.query(UserModel).filter(UserModel.id == current_user.id).one_or_none()
    if user_row and user_row.organization_id and quote.get("organization_id") == user_row.organization_id:
        if user_row.role in ("branch_admin", "branch_user"):
            branch_id = quote.get("ordered_for_branch_id")
            if branch_id:
                require_branch_access(db, user_row, branch_id)
    elif quote.get("user_id") != current_user.id:
        raise HTTPException(status_code=404, detail="Quote not found")

    if quote.get("status") not in ("quoted", "revision_proposed"):
        raise HTTPException(
            status_code=400,
            detail="Quote must be in 'quoted' status to respond",
        )

    response = (body.response or "").strip().lower()
    if response not in ("accepted", "negotiating"):
        raise HTTPException(
            status_code=400,
            detail="Response must be 'accepted' or 'negotiating'",
        )

    from utils.order_from_quote import quote_has_quoted_prices

    quote_items = (
        db.query(QuoteItemModel)
        .filter(QuoteItemModel.quote_id == quote_id)
        .all()
    )
    if response == "accepted" and not quote_has_quoted_prices(quote_items):
        raise HTTPException(
            status_code=400,
            detail="Quote has no quoted prices yet. Wait for admin quotation.",
        )

    def _apply_response():
        from utils.order_from_quote import create_order_from_quote

        q = db.query(QuoteModel).filter(QuoteModel.id == quote_id).one_or_none()
        if not q:
            return

        q.customer_response = response
        q.customer_notes = body.notes
        q.updated_at = datetime.utcnow()

        if response == "accepted":
            create_order_from_quote(
                db, q, quote_items, acting_user_id=current_user.id
            )
        else:
            q.status = "revision_proposed"
            q.current_handler = "ADMIN_REVIEW"
            # Persist proposed prices onto quote items when provided
            proposed_by_product = {
                (it.get("product_id") if isinstance(it, dict) else None): (
                    it.get("customer_proposed_price") if isinstance(it, dict) else None
                )
                for it in (body.items or [])
            }
            if any(v is not None for v in proposed_by_product.values()):
                items = (
                    db.query(QuoteItemModel)
                    .filter(QuoteItemModel.quote_id == quote_id)
                    .all()
                )
                for item in items:
                    proposed = proposed_by_product.get(item.product_id)
                    if proposed is not None:
                        item.customer_proposed_price = float(proposed)

        db.add(q)
        db.commit()

    await run_in_threadpool(_apply_response)
    from utils.live_events import publish_entity_event
    publish_entity_event(
        "quote.updated",
        entity_type="quote",
        entity_id=quote_id,
        organization_id=quote.get("organization_id"),
        quote_id=quote_id,
    )
    if response == "accepted":
        publish_entity_event(
            "order.updated",
            entity_type="order",
            entity_id=quote_id,
            organization_id=quote.get("organization_id"),
            quote_id=quote_id,
        )

    try:
        from utils.activity import log_activity
        def _log_response():
            log_activity(
                db,
                entity_type="quote",
                entity_id=quote_id,
                event_type="accepted" if response == "accepted" else "negotiating",
                summary=(
                    f"{current_user.firstName} {current_user.lastName} accepted the quotation"
                    if response == "accepted"
                    else f"{current_user.firstName} {current_user.lastName} proposed a revision"
                ),
                actor_id=current_user.id,
                actor_name=f"{current_user.firstName} {current_user.lastName}".strip(),
                actor_role="customer",
                commit=True,
            )
        await run_in_threadpool(_log_response)
    except Exception as e:
        logger.error(f"Failed to log quote response: {str(e)}")

    logger.info(f"Quote {quote_id} response '{response}' by {current_user.email}")
    if response == "accepted":
        return {"message": "Quote accepted. Your order has been created."}
    return {"message": "Counter-proposal submitted for admin review."}


class QuoteRejectRequest(BaseModel):
    reason: str


@router.post("/quotes/{quote_id}/reject", tags=["quotes"])
async def reject_quote(
    quote_id: str,
    body: QuoteRejectRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Customer rejects a quotation that is awaiting their decision."""
    from db.models import User as UserModel
    from utils.activity import log_activity
    from utils.live_events import publish_entity_event
    from utils.quote_ops import compute_ops_status, quote_has_order

    reason = (body.reason or "").strip()
    if len(reason) < 3:
        raise HTTPException(status_code=400, detail="Please tell us why you are rejecting the quotation")

    quote = db.query(QuoteModel).filter(QuoteModel.id == quote_id).one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    user_row = db.query(UserModel).filter(UserModel.id == current_user.id).one_or_none()
    _assert_facility_quote_access(db, user_row, quote, current_user)

    ops = compute_ops_status(quote, has_order=bool(quote_has_order(db, quote_id)))
    if ops != "awaiting_customer":
        raise HTTPException(status_code=400, detail="Only a quotation awaiting your decision can be rejected")

    actor = f"{current_user.firstName} {current_user.lastName}".strip() or current_user.email
    previous = f"{quote.status}/{quote.current_handler}"
    quote.status = "rejected"
    quote.customer_response = "rejected"
    quote.customer_notes = reason
    quote.updated_at = datetime.utcnow()
    log_activity(
        db,
        entity_type="quote",
        entity_id=quote_id,
        event_type="rejected",
        summary=f"{actor} rejected the quotation: {reason}",
        actor_id=current_user.id,
        actor_name=actor,
        actor_role="customer",
        field_name="status",
        previous_value=previous,
        new_value="rejected/CUSTOMER_REVIEW",
        is_customer_visible=True,
        commit=True,
    )
    publish_entity_event(
        "quote.updated",
        entity_type="quote",
        entity_id=quote_id,
        organization_id=quote.organization_id,
        quote_id=quote_id,
    )
    logger.info(f"Quote {quote_id} rejected by {current_user.email}: {reason}")
    return {"message": "Quote rejected."}


def _assert_facility_quote_access(db, user_row, quote, current_user):
    if not user_row:
        raise HTTPException(status_code=404, detail="Quote not found")
    if user_row.role == "admin":
        return
    if quote.organization_id and user_row.organization_id:
        if quote.organization_id != user_row.organization_id:
            raise HTTPException(status_code=404, detail="Quote not found")
        if user_row.role in ("branch_admin", "branch_user"):
            from utils.permissions import get_user_accessible_branch_ids, require_branch_access

            branch_id = quote.ordered_for_branch_id
            if branch_id:
                require_branch_access(db, user_row, branch_id)
            else:
                # Quote is org-scoped; allow if the user has any branch in this org.
                if not get_user_accessible_branch_ids(db, user_row):
                    raise HTTPException(status_code=403, detail="No branch assigned to your account")
        elif quote.user_id != current_user.id and user_row.role not in ("org_admin", "admin"):
            raise HTTPException(status_code=404, detail="Quote not found")
        return
    if quote.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Quote not found")


def _list_quote_messages(db, quote_id: str, current_user: UserResponse):
    from db.models import QuoteMessage, User as UserModel

    quote = db.query(QuoteModel).filter(QuoteModel.id == quote_id).one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    user_row = db.query(UserModel).filter(UserModel.id == current_user.id).one_or_none()
    _assert_facility_quote_access(db, user_row, quote, current_user)
    messages = (
        db.query(QuoteMessage)
        .filter(QuoteMessage.quote_id == quote_id)
        .order_by(QuoteMessage.created_at.asc())
        .all()
    )
    unread = [m for m in messages if m.sender_role == "admin" and not m.is_read]
    for m in unread:
        m.is_read = True
    if unread:
        db.commit()
    return [
        serialize_quote_message(
            m,
            extra={"is_read": True if m.sender_role == "admin" else m.is_read},
        )
        for m in messages
    ]


def _send_quote_message(db, quote_id: str, current_user: UserResponse, text: str, attachments=None):
    from db.models import QuoteMessage, User as UserModel
    from utils.activity import log_activity
    import uuid as uuid_mod

    quote = db.query(QuoteModel).filter(QuoteModel.id == quote_id).one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    user_row = db.query(UserModel).filter(UserModel.id == current_user.id).one_or_none()
    _assert_facility_quote_access(db, user_row, quote, current_user)
    actor = f"{current_user.firstName} {current_user.lastName}".strip() or current_user.email
    msg = QuoteMessage(
        id=str(uuid_mod.uuid4()),
        quote_id=quote_id,
        sender_id=current_user.id,
        sender_role="customer" if (user_row and user_row.role != "admin") else "admin",
        sender_name=actor,
        body=text,
        attachments=attachments or [],
        is_read=user_row.role == "admin" if user_row else False,
        created_at=datetime.utcnow(),
    )
    db.add(msg)
    log_activity(
        db,
        entity_type="quote",
        entity_id=quote_id,
        event_type="message",
        summary=f"{actor} sent a message",
        actor_id=current_user.id,
        actor_name=actor,
        actor_role=msg.sender_role,
        commit=False,
    )

    # A customer answering a request for information puts the quote back in review.
    status_changed = False
    if msg.sender_role == "customer":
        from utils.quote_ops import customer_reply_transition

        transition = customer_reply_transition(quote)
        if transition:
            previous = f"{quote.status}/{quote.current_handler}"
            quote.status, quote.current_handler = transition
            quote.updated_at = datetime.utcnow()
            status_changed = True
            log_activity(
                db,
                entity_type="quote",
                entity_id=quote_id,
                event_type="status_change",
                summary=f"{actor} replied; quote returned to review",
                actor_id=current_user.id,
                actor_name=actor,
                actor_role="customer",
                field_name="status",
                previous_value=previous,
                new_value=f"{quote.status}/{quote.current_handler}",
                commit=False,
            )

    db.commit()
    db.refresh(msg)
    from utils.live_events import publish_entity_event
    publish_entity_event(
        "message.created",
        entity_type="quote",
        entity_id=quote_id,
        organization_id=quote.organization_id,
        quote_id=quote_id,
    )
    if status_changed:
        publish_entity_event(
            "quote.updated",
            entity_type="quote",
            entity_id=quote_id,
            organization_id=quote.organization_id,
            quote_id=quote_id,
        )
    return serialize_quote_message(msg)


@router.get("/quotes/{quote_id}/messages", tags=["quotes"])
async def list_customer_quote_messages(
    quote_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _list_quote_messages(db, quote_id, current_user)


@router.post("/quotes/{quote_id}/messages", tags=["quotes"])
async def send_customer_quote_message(
    quote_id: str,
    payload: QuoteMessageCreate,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    text = (payload.body or "").strip()
    attachments = sanitize_attachments([a.model_dump() for a in (payload.attachments or [])])
    if not text and not attachments:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    return _send_quote_message(db, quote_id, current_user, text, attachments)


@router.post("/quotes/{quote_id}/messages/attachments", tags=["quotes"])
async def upload_customer_quote_message_attachment(
    quote_id: str,
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from db.models import User as UserModel

    quote = db.query(QuoteModel).filter(QuoteModel.id == quote_id).one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    user_row = db.query(UserModel).filter(UserModel.id == current_user.id).one_or_none()
    _assert_facility_quote_access(db, user_row, quote, current_user)
    content = await file.read()
    return save_chat_upload(file, content)


# ---- admin quote endpoints -----------------------------------------------

@router.get("/admin/quotes", tags=["quotes"])
async def get_all_quotes(
    current_user: UserResponse = Depends(get_admin_user),
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    db: Session = Depends(get_db),
):
    """Get all quotes with filtering - Admin only."""
    from repositories import quotes as quotes_repo

    quotes, total = await run_in_threadpool(
        quotes_repo.list_quotes_admin, db, status, limit, skip
    )

    quote_models = [QuoteRequest(**quote) for quote in quotes]

    return {
        "quotes": quote_models,
        "total": total,
        "limit": limit,
        "skip": skip,
    }


@router.put("/admin/quotes/{quote_id}", response_model=dict, tags=["quotes"])
async def update_quote_by_admin(
    quote_id: str,
    quote_data: dict,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """
    Update an existing quote (items, discount, VAT, customer details) - Admin only.
    Mirrors the create_quote_by_admin logic but applies changes to an existing record.
    """
    from repositories import quotes as quotes_repo

    existing_quote = await run_in_threadpool(
        quotes_repo.get_quote_by_id,
        db,
        quote_id,
    )
    if not existing_quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    user_id = quote_data.get("user_id")
    facility_name = quote_data.get("facility_name")
    contact_person = quote_data.get("contact_person")
    email = quote_data.get("email")
    phone = quote_data.get("phone")
    address = quote_data.get("address", "")
    items = quote_data.get("items", [])
    notes = quote_data.get("notes", "")
    discount_amount = float(quote_data.get("discount_amount", 0))
    tax_rate = float(quote_data.get("tax_rate", 16))
    include_vat = bool(quote_data.get("include_vat", True))
    validity_days = int(quote_data.get("validity_days", 0) or 0)

    if not facility_name or not contact_person or not email or not phone:
        raise HTTPException(
            status_code=400,
            detail="Missing required fields: facility_name, contact_person, email, phone",
        )
    raise_if_invalid_email(email)
    raise_if_invalid_phone(phone)

    if not items:
        raise HTTPException(
            status_code=400,
            detail="Quote must contain at least one item",
        )

    formatted_items: List[Dict[str, Any]] = []
    for item in items:
        if isinstance(item, dict):
            formatted_items.append(
                {
                    "product_id": item.get("product_id"),
                    "product_name": item.get("product_name"),
                    "category": item.get("category", ""),
                    "quantity": int(item.get("quantity", 1)),
                    "unit_price": float(item.get("unit_price", 0)),
                }
            )
        else:
            formatted_items.append(item)

    subtotal, tax_amount, total = calculate_totals(
        items=formatted_items,
        discount=discount_amount,
        tax_rate=tax_rate,
    )

    if not include_vat:
        tax_amount = 0
        total = subtotal - discount_amount

    def _apply_updates():
        quote_row = (
            db.query(QuoteModel)
            .filter(QuoteModel.id == quote_id)
            .one_or_none()
        )
        if not quote_row:
            return

        quote_row.user_id = user_id
        quote_row.facility_name = facility_name
        quote_row.contact_person = contact_person
        quote_row.email = email
        quote_row.phone = phone
        quote_row.address = address
        # Quote model stores notes in additional_notes
        quote_row.additional_notes = notes
        if validity_days > 0:
            quote_row.validity_days = validity_days

        quote_row.discount_amount = discount_amount
        quote_row.tax_rate = tax_rate
        quote_row.tax_amount = tax_amount
        quote_row.subtotal = subtotal
        quote_row.total = total
        quote_row.include_vat = include_vat

        # Editing prices keeps the quote in review; only "send quote" publishes it.
        if quote_row.status in ("pending", "approved"):
            quote_row.status = "pending"
            quote_row.current_handler = "UNDER_REVIEW"

        existing_items = (
            db.query(QuoteItemModel)
            .filter(QuoteItemModel.quote_id == quote_id)
            .all()
        )
        for it in existing_items:
            db.delete(it)

        for item in formatted_items:
            db.add(
                QuoteItemModel(
                    id=str(uuid.uuid4()),
                    quote_id=quote_id,
                    product_id=item.get("product_id"),
                    product_name=item.get("product_name"),
                    category=item.get("category", ""),
                    quantity=item.get("quantity", 1),
                    unit_price=item.get("unit_price", 0),
                )
            )

        db.commit()

    await run_in_threadpool(_apply_updates)

    logger.info(f"Quote {quote_id} updated by admin {current_user.email}")
    return {"message": "Quote updated successfully"}

@router.get("/admin/quote-customers", response_model=dict, tags=["quotes"])
def list_quote_customers(
    search: str = "",
    current_user: UserResponse = Depends(require_company_permission("quotes")),
    db: Session = Depends(get_db),
):
    """Return registered facilities available for a staff-created quote."""
    from sqlalchemy import or_
    from db.models import Organization, User as UserModel

    query = db.query(Organization)
    term = search.strip()
    if term:
        like = f"%{term}%"
        query = query.filter(or_(
            Organization.name.ilike(like),
            Organization.email.ilike(like),
            Organization.phone.ilike(like),
        ))
    organizations = query.order_by(Organization.name.asc()).limit(100).all()
    org_ids = [organization.id for organization in organizations]
    users = (
        db.query(UserModel)
        .filter(UserModel.organization_id.in_(org_ids))
        .order_by(UserModel.created_at.asc())
        .all()
        if org_ids
        else []
    )
    users_by_org = {}
    for user in users:
        users_by_org.setdefault(user.organization_id, []).append(user)

    customers = []
    for organization in organizations:
        org_users = users_by_org.get(organization.id, [])
        contact = next(
            (user for user in org_users if user.role == "org_admin"),
            org_users[0] if org_users else None,
        )
        customers.append({
            "organizationId": organization.id,
            "name": organization.name,
            "facilityType": organization.facility_type,
            "email": contact.email if contact else organization.email,
            "phone": contact.phone if contact else organization.phone,
            "address": organization.address_line,
            "contactPerson": (
                f"{contact.first_name} {contact.last_name}".strip()
                if contact
                else organization.name
            ),
            "userId": contact.id if contact else None,
        })
    return {"customers": customers}


@router.post("/admin/quotes/products", response_model=dict, tags=["quotes"])
async def create_product_for_quote(
    product_data: dict,
    current_user: UserResponse = Depends(require_company_permission("quotes")),
    db: Session = Depends(get_db),
):
    """Create a catalogue product from the quote form so staff can keep quoting."""
    from models.product import Product as ProductSchema
    from repositories import products as products_repo

    name = (product_data.get("name") or "").strip()
    category_id = str(product_data.get("category_id") or "").strip()
    if not name or not category_id:
        raise HTTPException(status_code=400, detail="Name and category are required")
    buying = float(product_data.get("buying_price", 0) or 0) if can_see_buying_price(current_user.role) else 0
    try:
        row = products_repo.create_catalog_product(
            db,
            name=name,
            category_id=category_id,
            price=float(product_data.get("price", 0) or 0),
            buying_price=buying,
            package=product_data.get("package") or "",
            stocking_unit=product_data.get("stocking_unit") or "",
            description=product_data.get("description") or None,
            in_stock=bool(product_data.get("in_stock", True)),
        )
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    payload = ProductSchema.model_validate(row, from_attributes=True)
    if not can_see_buying_price(current_user.role):
        payload.buying_price = 0
    return {"product": payload, "product_id": row.product_id}


@router.post("/admin/quotes", response_model=dict, tags=["quotes"])
async def create_quote_by_admin(
    quote_data: dict,
    current_user: UserResponse = Depends(require_company_permission("quotes")),
    db: Session = Depends(get_db),
):
    """Create and send a quote on behalf of a customer."""
    
    user_id = quote_data.get("user_id")
    organization_id = quote_data.get("organization_id")
    facility_name = quote_data.get("facility_name")
    contact_person = quote_data.get("contact_person")
    email = quote_data.get("email")
    phone = quote_data.get("phone")
    address = quote_data.get("address", "")
    items = quote_data.get("items", [])
    notes = quote_data.get("notes", "")
    discount_amount = float(quote_data.get("discount_amount", 0))
    tax_rate = float(quote_data.get("tax_rate", 16))
    include_vat = bool(quote_data.get("include_vat", True))
    
    # Validation
    if not facility_name or not contact_person or not email or not phone or not items:
        raise HTTPException(
            status_code=400,
            detail="Missing required fields: facility_name, contact_person, email, phone, items"
        )
    raise_if_invalid_email(email)
    raise_if_invalid_phone(phone)

    if organization_id:
        from db.models import Organization, User as UserModel

        organization = (
            db.query(Organization)
            .filter(Organization.id == organization_id)
            .one_or_none()
        )
        if not organization:
            raise HTTPException(status_code=400, detail="Selected facility no longer exists")
        if user_id:
            linked_user = (
                db.query(UserModel)
                .filter(
                    UserModel.id == user_id,
                    UserModel.organization_id == organization_id,
                )
                .one_or_none()
            )
            if not linked_user:
                raise HTTPException(
                    status_code=400,
                    detail="Selected contact does not belong to this facility",
                )
    
    # Format items properly
    formatted_items = []
    for item in items:
        if isinstance(item, dict):
            formatted_items.append({
                "product_id": item.get("product_id"),
                "product_name": item.get("product_name"),
                "category": item.get("category", ""),
                "quantity": int(item.get("quantity", 1)),
                "unit_price": float(item.get("unit_price", 0))
            })
        else:
            formatted_items.append(item)
    
    # Calculate totals using helper
    subtotal, tax_amount, total = calculate_totals(
        items=formatted_items,
        discount=discount_amount,
        tax_rate=tax_rate,
    )

    # If VAT is excluded, keep tax metadata but do not charge it
    if not include_vat:
        tax_amount = 0
        total = subtotal - discount_amount
    
    # Validate pricing
    if not validate_pricing(subtotal, discount_amount, tax_rate):
        raise HTTPException(status_code=400, detail="Invalid pricing data")
    
    # Create quote in Postgres
    settings_row = (
        db.query(SiteSettings)
        .filter(SiteSettings.id == "site_settings")
        .one_or_none()
    )
    default_validity_days = (
        getattr(settings_row, "default_quote_validity_days", None) or 7
    )
    validity_days = int(quote_data.get("validity_days") or default_validity_days)

    quote_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "organization_id": organization_id,
        "quoted_by_user_id": current_user.id,
        "assigned_sales_user_id": resolve_sales_assignee_id(
            db, current_user, organization_id=organization_id
        ),
        "facility_name": facility_name,
        "contact_person": contact_person,
        "email": email,
        "phone": phone,
        "address": address,
        "items": formatted_items,
        "status": "quoted",
        "current_handler": "CUSTOMER_REVIEW",
        "discount_amount": discount_amount,
        "tax_rate": tax_rate,
        "tax_amount": tax_amount,
        "subtotal": subtotal,
        "total": total,
        "include_vat": include_vat,
        "validity_days": validity_days,
        "additional_notes": notes,
    }

    from repositories import quotes as quotes_repo

    created = await run_in_threadpool(quotes_repo.create_quote_with_items, db, quote_doc)
    logger.info(f"Quote created by admin {current_user.email} for {facility_name}")
    
    # Send quote email to customer
    try:
        email_items = []
        for item in formatted_items:
            email_items.append({
                "product_name": item.get("product_name"),
                "category": item.get("category"),
                "quantity": item.get("quantity", 1),
                "original_price": item.get("unit_price", 0),
                "modified_price": item.get("unit_price", 0),
                "discount_percent": 0,
                "notes": None
            })
        
        send_modified_quote_email(
            contact_person=contact_person,
            email=email,
            facility_name=facility_name,
            items=email_items,
            subtotal=subtotal,
            discount=discount_amount,
            tax_rate=tax_rate,
            tax_amount=tax_amount,
            total=total,
            validity_days=validity_days,
            notes=notes or "",
            include_vat=include_vat,
            quote_id=quote_doc["id"],
            quote_number=(created or {}).get("quote_number"),
        )
    except Exception as e:
        logger.error(f"Failed to send quote email: {str(e)}")
    
    return {
        "message": "Quote created and sent to customer",
        "quote_id": quote_doc["id"],
        "status": "quoted"
    }


@router.get("/admin/quotes/{quote_id}/pdf", tags=["quotes"])
async def download_quote_pdf(
    quote_id: str,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Generate and return a PDF for an official admin quote."""
    quote_row = (
        db.query(QuoteModel)
        .filter(QuoteModel.id == quote_id)
        .one_or_none()
    )
    if not quote_row:
        raise HTTPException(status_code=404, detail="Quote not found")
    return await _stream_quote_pdf(db, quote_row)


@router.put("/admin/quotes/{quote_id}/status", tags=["quotes"])
async def update_quote_status(
    quote_id: str,
    data: dict,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Update quote status and handler - Admin only."""
    from datetime import datetime

    new_status = data.get("status")
    if new_status not in ["quoted", "invoiced"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid status. Must be: quoted or invoiced",
        )

    handler_map = {
        "quoted": "CUSTOMER_REVIEW",
        "invoiced": "LOCKED_APPROVED",
    }
    new_handler = handler_map.get(new_status, "ADMIN_REVIEW")

    from repositories import quotes as quotes_repo

    success = await run_in_threadpool(
        quotes_repo.update_quote_status, db, quote_id, new_status, new_handler
    )
    if not success:
        raise HTTPException(status_code=404, detail="Quote not found")

    logger.info(f"Quote {quote_id} status updated to {new_status}")
    return {"message": "Status updated successfully", "new_status": new_status}


@router.post("/admin/quotes/{quote_id}/modify", tags=["quotes"])
async def create_modified_quote(
    quote_id: str,
    data: ModifiedQuoteCreate,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Create a modified quote with custom pricing - Admin only."""
    from datetime import datetime

    # Get original quote (ORM)
    original = await run_in_threadpool(
        lambda: db.query(QuoteModel).filter(QuoteModel.id == quote_id).one_or_none()
    )
    if not original:
        raise HTTPException(status_code=404, detail="Original quote not found")
    from utils.quote_ops import quote_has_order, compute_ops_status
    if quote_has_order(db, quote_id):
        raise HTTPException(status_code=400, detail="This quote has been converted to an order and cannot be edited")
    current_ops = compute_ops_status(original)
    if current_ops in ("rejected", "cancelled", "converted"):
        raise HTTPException(status_code=400, detail=f"A {current_ops} quote cannot be sent to the customer")
    if current_ops == "submitted":
        raise HTTPException(status_code=400, detail="Start the review before sending a quote")
    if not data.items:
        raise HTTPException(status_code=400, detail="Quote must contain at least one item")
    # The workspace always sends the quoted price as modified_price; a missing or
    # zero value means the line has not been priced yet, so refuse to publish.
    unpriced = [item for item in data.items if float(item.modified_price or 0) <= 0]
    if unpriced:
        raise HTTPException(status_code=400, detail="Every line needs a quoted price before the quote can be sent")

    # Calculate totals from modified items
    subtotal = 0
    for item in data.items:
        price = item.modified_price if item.modified_price else item.original_price or 0
        subtotal += price * item.quantity

    include_vat = data.include_vat
    if include_vat is None:
        include_vat = original.include_vat is not False
    else:
        include_vat = bool(include_vat)
    from utils.totals import document_pricing
    computed = document_pricing(
        [
            {
                "list_price": item.original_price or 0,
                "unit_price": (item.modified_price if item.modified_price else item.original_price) or 0,
                "quantity": item.quantity,
            }
            for item in data.items
        ],
        tax_rate=data.tax_rate,
        include_vat=include_vat,
    )
    from repositories import quotes as quotes_repo

    pricing = {
        "subtotal": computed["quoted_subtotal"],
        "discount_amount": computed["discount_amount"],
        "tax_rate": computed["tax_rate"],
        "tax_amount": computed["tax_amount"],
        "total": computed["total"],
        "include_vat": include_vat,
    }
    items_payload = [item.dict() for item in data.items]
    meta = {
        "validity_days": data.validity_days,
        "terms_and_conditions": data.terms_and_conditions,
        "notes": data.notes,
        "modified_by": current_user.id,
    }

    modified_dict = await run_in_threadpool(
        quotes_repo.create_modified_quote_with_items,
        db,
        original,
        items_payload,
        pricing,
        meta,
    )

    # Update original quote items and pricing in Postgres
    def _update_original_quote_items():
        quote_row = (
            db.query(QuoteModel).filter(QuoteModel.id == quote_id).one_or_none()
        )
        if not quote_row:
            return

        existing_items = (
            db.query(QuoteItemModel)
            .filter(QuoteItemModel.quote_id == quote_id)
            .all()
        )

        from utils.quote_items import sync_quote_items, recalc_quote_totals
        from repositories.quotes import customer_snapshot_from_payload, _serialize_quote_with_items
        from sqlalchemy.orm.attributes import flag_modified

        vat_flag = include_vat if data.include_vat is not None else (quote_row.include_vat is not False)

        existing_items = sync_quote_items(
            db,
            quote_id,
            existing_items,
            data.items,
            allow_buying=can_see_buying_price(current_user.role),
        )
        recalc_quote_totals(
            quote_row,
            existing_items,
            discount=data.discount_amount,
            tax_rate=data.tax_rate,
            include_vat=vat_flag,
        )

        # Persist updated customer/facility details if provided
        if getattr(data, "facility_name", None):
            quote_row.facility_name = data.facility_name
        if getattr(data, "contact_person", None):
            quote_row.contact_person = data.contact_person
        if getattr(data, "email", None):
            quote_row.email = data.email
        if getattr(data, "phone", None):
            quote_row.phone = data.phone
        if getattr(data, "address", None) is not None:
            quote_row.address = data.address

        previous_status = quote_row.status
        quote_row.status = "quoted"
        quote_row.current_handler = "CUSTOMER_REVIEW"
        quote_row.validity_days = int(getattr(data, "validity_days", None) or quote_row.validity_days or 7)
        quote_row.customer_response = None
        quote_row.quoted_at = datetime.utcnow()
        quote_row.quoted_by_user_id = current_user.id
        quote_row.customer_snapshot = customer_snapshot_from_payload(
            _serialize_quote_with_items(quote_row, existing_items)
        )
        flag_modified(quote_row, "customer_snapshot")

        from db.models import QuoteMessage
        import uuid as uuid_mod
        notify_msg = QuoteMessage(
            id=str(uuid_mod.uuid4()),
            quote_id=quote_id,
            sender_id=current_user.id,
            sender_role="admin",
            sender_name=f"{current_user.firstName} {current_user.lastName}".strip() or "Admin",
            body="An updated quotation has been sent." if previous_status == "quoted" else "A quotation has been sent.",
            is_read=False,
            created_at=datetime.utcnow(),
        )
        db.add(notify_msg)

        from utils.activity import log_activity
        log_activity(
            db,
            entity_type="quote",
            entity_id=quote_id,
            event_type="quotation_sent",
            summary=f"{current_user.firstName} {current_user.lastName}".strip() + " sent quotation to customer",
            actor_id=current_user.id,
            actor_name=f"{current_user.firstName} {current_user.lastName}".strip(),
            actor_role="admin",
            field_name="status",
            previous_value=previous_status,
            new_value="quoted",
        )

        db.commit()
        from utils.live_events import publish_entity_event
        publish_entity_event(
            "quote.priced",
            entity_type="quote",
            entity_id=quote_id,
            organization_id=quote_row.organization_id,
            quote_id=quote_id,
        )
        publish_entity_event(
            "message.created",
            entity_type="quote",
            entity_id=quote_id,
            organization_id=quote_row.organization_id,
            quote_id=quote_id,
        )

        return {
            "include_vat": quote_row.include_vat is not False,
            "subtotal": quote_row.subtotal,
            "tax_amount": quote_row.tax_amount,
            "total": quote_row.total,
        }

    persisted = await run_in_threadpool(_update_original_quote_items) or {}

    # Send modified quote email to customer
    try:
        refreshed = await run_in_threadpool(
            lambda: db.query(QuoteModel).filter(QuoteModel.id == quote_id).one_or_none()
        )
        effective = refreshed or original
        send_include_vat = persisted.get("include_vat", include_vat)
        send_modified_quote_email(
            contact_person=effective.contact_person,
            email=effective.email,
            facility_name=effective.facility_name,
            items=[item.dict() for item in data.items],
            subtotal=persisted.get("subtotal", subtotal),
            discount=data.discount_amount,
            tax_rate=data.tax_rate,
            tax_amount=persisted.get("tax_amount", tax_amount),
            total=persisted.get("total", total),
            validity_days=data.validity_days,
            notes=data.notes or "",
            include_vat=send_include_vat,
            quote_id=effective.id,
            quote_number=getattr(effective, "quote_number", None),
        )
    except Exception as e:
        logger.error(f"Failed to send modified quote email: {str(e)}")

    logger.info(f"Modified quote created for {quote_id}")
    return {
        "message": "Modified quote created and sent to customer",
        "modified_quote_id": modified_dict["id"],
    }