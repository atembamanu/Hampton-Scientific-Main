import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import Response
from starlette.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from models.quote import QuoteRequest, QuoteRequestCreate, QuoteRevision, ModifiedQuoteCreate, ModifiedQuote
from models.user import UserResponse
from utils.auth import get_current_user, get_optional_user, get_admin_user
from utils.email_service import send_quote_request_email, send_modified_quote_email
from utils.totals import calculate_subtotal, calculate_totals, validate_pricing
from utils.logger import logger
from db.models import (
    Quote as QuoteModel,
    QuoteItem as QuoteItemModel,
    SiteSettings,
)
from deps import get_db
from utils.pdf import generate_quote_pdf
import base64

router = APIRouter()

# ---- customer quote endpoints -----------------------------------------------

@router.post("/quotes", response_model=dict, tags=["quotes"])
async def create_quote_request(
    quote_data: QuoteRequestCreate,
    current_user: Optional[UserResponse] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Customer submits a quote request."""
    quote_dict = quote_data.dict()
    quote_dict["id"] = str(uuid.uuid4())

    if current_user:
        quote_dict["user_id"] = current_user.id
        quote_dict["email"] = current_user.email

    # Quotes now only use: quoted, invoiced
    quote_dict["status"] = "quoted"
    quote_dict["current_handler"] = "ADMIN_REVIEW"
    quote_dict["created_at"] = datetime.utcnow()
    quote_dict["updated_at"] = datetime.utcnow()
    quote_dict["discount_amount"] = 0
    quote_dict["tax_rate"] = 16
    quote_dict["tax_amount"] = 0
    quote_dict["subtotal"] = calculate_subtotal(quote_dict.get("items", []))
    quote_dict["total"] = quote_dict["subtotal"]

    # Persist to Postgres via repository
    from repositories import quotes as quotes_repo

    await run_in_threadpool(quotes_repo.create_quote_with_items, db, quote_dict)
    logger.info(f"Quote request created: {quote_dict['id']}")
    
    # Send notification email to customer
    try:
        send_quote_request_email(
            to_email=quote_dict.get("email", ""),
            customer_name=quote_dict.get("contact_person", ""),
            facility_name=quote_dict.get("facility_name", ""),
            quote_id=quote_dict["id"]
        )
    except Exception as e:
        logger.error(f"Failed to send quote confirmation: {str(e)}")
    
    return {
        "message": "Quote request received. We'll respond shortly.",
        "quote_id": quote_dict["id"],
        "status": "quoted"
    }

@router.get("/quotes", response_model=List[dict], tags=["quotes"])
async def list_customer_quotes(
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List quotes for the logged-in customer."""
    from repositories import quotes as quotes_repo

    quotes = await run_in_threadpool(
        quotes_repo.list_quotes_for_user, db, current_user.id, 100
    )
    return quotes or []

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
    if quote.get("user_id") != current_user.id:
        raise HTTPException(status_code=404, detail="Quote not found")
    return quote

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

    async def _store_revision_and_update():
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
    
    async def _mark_ready_for_invoicing():
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

@router.post("/quotes/{quote_id}/reject", tags=["quotes"])
async def reject_quote(
    quote_id: str,
    reason: str,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Customer rejects a quoted price."""
    from repositories import quotes as quotes_repo

    quote = await run_in_threadpool(quotes_repo.get_quote_by_id, db, quote_id)
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    if quote.get("user_id") != current_user.id:
        raise HTTPException(status_code=404, detail="Quote not found")

    async def _mark_rejected():
        q = (
            db.query(QuoteModel)
            .filter(QuoteModel.id == quote_id, QuoteModel.user_id == current_user.id)
            .one_or_none()
        )
        if not q:
            return
        q.status = "rejected"
        q.customer_response = "rejected"
        q.customer_notes = reason
        db.add(q)
        db.commit()

    await run_in_threadpool(_mark_rejected)
    
    logger.info(f"Quote {quote_id} rejected by {current_user.email}: {reason}")
    
    return {"message": "Quote rejected."}


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

        if quote_row.status in ("pending", "quoted", "approved"):
            quote_row.status = "quoted"
            quote_row.current_handler = "ADMIN_REVIEW"

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

@router.post("/admin/quotes", response_model=dict, tags=["quotes"])
async def create_quote_by_admin(
    quote_data: dict,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Create a quote on behalf of a customer - Admin only."""
    
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
    
    # Validation
    if not facility_name or not contact_person or not email or not phone or not items:
        raise HTTPException(
            status_code=400,
            detail="Missing required fields: facility_name, contact_person, email, phone, items"
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

    quote_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
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
        "validity_days": default_validity_days,
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
            validity_days=default_validity_days,
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
    """
    Generate and return a PDF for an official admin quote.
    """
    # Load quote and its items
    quote_row = (
        db.query(QuoteModel)
        .filter(QuoteModel.id == quote_id)
        .one_or_none()
    )
    if not quote_row:
        raise HTTPException(status_code=404, detail="Quote not found")

    items_rows = (
        db.query(QuoteItemModel)
        .filter(QuoteItemModel.quote_id == quote_id)
        .all()
    )

    items_payload = [
        {
            "product_id": it.product_id,
            "product_name": it.product_name,
            "category": it.category,
            "quantity": it.quantity,
            "original_price": it.unit_price or 0,
            "modified_price": None,
        }
        for it in items_rows
    ]

    # Company / site settings for header & footer
    settings_row = (
        db.query(SiteSettings)
        .filter(SiteSettings.id == "site_settings")
        .one_or_none()
    )

    company_info = {
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

    # Prepare quote payload for PDF generator
    quote_dict = {
        "id": quote_row.id,
        "quote_number": getattr(quote_row, "quote_number", None),
        "facility_name": quote_row.facility_name,
        "contact_person": quote_row.contact_person,
        "email": quote_row.email,
        "phone": quote_row.phone,
        "address": quote_row.address,
        "items": items_payload,
        "discount_amount": quote_row.discount_amount or 0,
        "tax_rate": quote_row.tax_rate or 0,
        "tax_amount": quote_row.tax_amount or 0,
        "subtotal": quote_row.subtotal or 0,
        "total": quote_row.total or 0,
        "validity_days": int(getattr(quote_row, "validity_days", None) or 7),
        "terms_and_conditions": (
            settings_row.default_payment_terms if settings_row and settings_row.default_payment_terms else "Net 30"
        ),
        "notes": quote_row.additional_notes or "",
        "additional_notes": quote_row.additional_notes or "",
        "include_vat": quote_row.include_vat if quote_row.include_vat is not None else True,
    }

    pdf_base64 = await generate_quote_pdf(quote_dict, company_info, is_modified=True)
    pdf_bytes = base64.b64decode(pdf_base64)

    filename = f"quote_{quote_row.id[:8].upper()}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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

    # Calculate totals from modified items
    subtotal = 0
    for item in data.items:
        price = item.modified_price if item.modified_price else item.original_price or 0
        subtotal += price * item.quantity

    include_vat = bool(getattr(data, "include_vat", True))
    tax_amount = (subtotal - data.discount_amount) * (data.tax_rate / 100) if data.tax_rate > 0 else 0
    total = subtotal - data.discount_amount + tax_amount

    # If VAT is excluded, keep tax metadata but do not charge it
    if not include_vat:
        tax_amount = 0
        total = subtotal - data.discount_amount

    # Persist modified quote + revision + items in Postgres
    from repositories import quotes as quotes_repo

    pricing = {
        "subtotal": subtotal,
        "discount_amount": data.discount_amount,
        "tax_rate": data.tax_rate,
        "tax_amount": tax_amount,
        "total": total,
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
    async def _update_original_quote_items():
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
        by_product = {it.product_id: it for it in existing_items}

        for item in data.items:
            it = by_product.get(item.product_id)
            if it:
                it.unit_price = item.modified_price or item.original_price or 0

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

        quote_row.status = "quoted"
        quote_row.current_handler = "CUSTOMER_REVIEW"
        quote_row.discount_amount = data.discount_amount
        quote_row.tax_rate = data.tax_rate
        quote_row.tax_amount = tax_amount
        quote_row.subtotal = subtotal
        quote_row.total = total
        quote_row.include_vat = include_vat
        quote_row.validity_days = int(getattr(data, "validity_days", None) or quote_row.validity_days or 7)
        quote_row.customer_response = None

        db.commit()

    await run_in_threadpool(_update_original_quote_items)

    # Send modified quote email to customer
    try:
        refreshed = await run_in_threadpool(
            lambda: db.query(QuoteModel).filter(QuoteModel.id == quote_id).one_or_none()
        )
        effective = refreshed or original
        send_modified_quote_email(
            contact_person=effective.contact_person,
            email=effective.email,
            facility_name=effective.facility_name,
            items=[item.dict() for item in data.items],
            subtotal=subtotal,
            discount=data.discount_amount,
            tax_rate=data.tax_rate,
            tax_amount=tax_amount,
            total=total,
            validity_days=data.validity_days,
            notes=data.notes or "",
            include_vat=include_vat,
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