import uuid
import io
import base64
from typing import List, Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from sqlalchemy import or_

from models.invoice import Invoice, InvoiceCreate
from models.user import UserResponse
from utils.auth import get_current_user, get_admin_user
from utils.permissions import company_has_permission
from utils.email_service import send_invoice_email
from utils.pdf import generate_invoice_pdf, generate_delivery_note_pdf
from utils.totals import calculate_subtotal, calculate_totals, validate_pricing
from utils.logger import logger
from utils.document_refs import generate_invoice_reference
from utils.app_time import serialize_datetime
from utils.ops_stats import INVOICE_AWAITING_PAYMENT
from deps import get_db
from db.models import (
    Invoice as InvoiceModel,
    Quote as QuoteModel,
    ModifiedQuote as ModifiedQuoteModel,
    SiteSettings,
)
from repositories import invoices as invoices_repo

router = APIRouter()


def _resolve_invoice(db: Session, key: str):
    return invoices_repo.get_invoice_by_id_or_number(db, key)


def _customer_can_access_invoice(db: Session, invoice: dict, current_user: UserResponse) -> bool:
    if invoice.get("user_id") == current_user.id:
        return True
    from db.models import User as UserModel, Quote as QuoteRow

    user_row = db.query(UserModel).filter(UserModel.id == current_user.id).one_or_none()
    if not user_row or not user_row.organization_id:
        return False
    org_id = invoice.get("organization_id")
    if org_id and org_id == user_row.organization_id:
        return True
    quote_id = invoice.get("quote_id")
    if quote_id:
        quote = db.query(QuoteRow).filter(QuoteRow.id == quote_id).one_or_none()
        if quote and quote.organization_id == user_row.organization_id:
            return True
    return False


def _company_info_from_settings(db: Session) -> dict:
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
        "default_payment_terms": settings_row.default_payment_terms if settings_row and settings_row.default_payment_terms else "Net 14",
    }


async def _stream_invoice_pdf(invoice: dict, db: Session, invoice_id: str):
    company_info = _company_info_from_settings(db)
    pdf_base64 = await generate_invoice_pdf(
        invoice,
        company_info,
        is_paid=(invoice.get("status") == "paid"),
    )
    pdf_bytes = io.BytesIO()
    pdf_bytes.write(base64.b64decode(pdf_base64))
    pdf_bytes.seek(0)
    filename = invoice.get("invoice_number") or invoice_id
    return StreamingResponse(
        iter([pdf_bytes.getvalue()]),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}.pdf"'
        },
    )

# ============================================
# CUSTOMER INVOICE ENDPOINTS
# ============================================

@router.get("/invoices", tags=["invoices"])
async def list_customer_invoices(
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
    """List all invoices for the logged-in customer or organization."""
    try:
        from db.models import User as UserModel
        from utils.permissions import resolve_list_branch_ids
        from utils.list_query import parse_day_start, parse_day_end, clamp_page, paginated_payload

        user_row = db.query(UserModel).filter(UserModel.id == current_user.id).one_or_none()
        page_n, limit_n, _ = clamp_page(page or 1, limit)
        start = parse_day_start(from_date)
        end = parse_day_end(to_date)
        if user_row and user_row.organization_id:
            branch_ids = resolve_list_branch_ids(db, user_row, branch_id)
            invoices, total, amount_total = await run_in_threadpool(
                invoices_repo.list_invoices_facility,
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
            invoices, total, amount_total = await run_in_threadpool(
                invoices_repo.list_invoices_facility,
                db,
                user_id=current_user.id,
                status=status or None,
                search=search,
                from_date=start,
                to_date=end,
                page=page_n,
                limit=limit_n if page is not None else 100,
            )
        items = invoices or []
        if page is None:
            return items
        return paginated_payload(items, total, page_n, limit_n, amount_total=amount_total)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list customer invoices: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve invoices")

@router.get("/invoices/{invoice_id}", response_model=dict, tags=["invoices"])
async def get_customer_invoice(
    invoice_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific invoice (customer can only see their own)."""
    try:
        invoice = await run_in_threadpool(_resolve_invoice, db, invoice_id)
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        if not _customer_can_access_invoice(db, invoice, current_user):
            raise HTTPException(status_code=404, detail="Invoice not found")
        return invoice
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve invoice {invoice_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve invoice")

@router.get("/invoices/{invoice_id}/download", tags=["invoices"])
async def download_customer_invoice_pdf(
    invoice_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download invoice as PDF (customer can only access their own)."""
    try:
        invoice = await run_in_threadpool(_resolve_invoice, db, invoice_id)
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        if not _customer_can_access_invoice(db, invoice, current_user):
            raise HTTPException(status_code=404, detail="Invoice not found")
        return await _stream_invoice_pdf(invoice, db, invoice_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate invoice PDF for {invoice_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate PDF")

@router.post("/invoices/{invoice_id}/mark-paid", tags=["invoices"])
async def mark_customer_invoice_paid(
    invoice_id: str,
    payment_data: dict,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Customer marks invoice as paid (manual payment confirmation)."""
    try:
        # For customer-facing ID, treat invoice_id as invoice_number
        invoice = await run_in_threadpool(_resolve_invoice, db, invoice_id)
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        if not _customer_can_access_invoice(db, invoice, current_user):
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        if invoice.get("status") == "paid":
            raise HTTPException(status_code=400, detail="Invoice already marked as paid")
        
        payment_method = payment_data.get("payment_method", "manual")

        def _mark_paid():
            inv_row = (
                db.query(InvoiceModel)
                .filter(
                    or_(
                        InvoiceModel.id == invoice_id,
                        InvoiceModel.invoice_number == invoice_id,
                    )
                )
                .one_or_none()
            )
            if not inv_row:
                return False
            inv_row.status = "paid"
            inv_row.paid_at = datetime.utcnow()
            inv_row.notes = inv_row.notes
            db.commit()
            return {
                "id": inv_row.id,
                "organization_id": inv_row.organization_id,
                "quote_id": inv_row.quote_id,
            }

        inv_row = await run_in_threadpool(_mark_paid)
        if not inv_row:
            raise HTTPException(status_code=404, detail="Invoice not found")
        from utils.live_events import publish_entity_event
        publish_entity_event(
            "invoice.updated",
            entity_type="invoice",
            entity_id=inv_row["id"],
            organization_id=inv_row["organization_id"],
            invoice_id=inv_row["id"],
            quote_id=inv_row["quote_id"],
        )

        logger.info(f"Invoice {invoice_id} marked as paid by customer {current_user.email}")
        
        return {
            "message": "Invoice marked as paid",
            "invoice_id": invoice_id,
            "status": "paid"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to mark invoice {invoice_id} as paid: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update invoice")

# ============================================
# ADMIN INVOICE ENDPOINTS
# ============================================

@router.post("/admin/invoices", response_model=dict, tags=["invoices"])
async def create_invoice(
    data: InvoiceCreate,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Create invoice from quote (admin only)."""
    _require_invoice_ops(current_user)
    try:
        # Get the quote or modified quote from Postgres
        modified_quote = data.modified_quote_id is not None

        if modified_quote:
            source_quote = (
                db.query(ModifiedQuoteModel)
                .filter(ModifiedQuoteModel.id == data.modified_quote_id)
                .one_or_none()
            )
        else:
            source_quote = (
                db.query(QuoteModel)
                .filter(QuoteModel.id == data.quote_id)
                .one_or_none()
            )

        if not source_quote:
            raise HTTPException(status_code=404, detail="Quote not found")

        quote_number = getattr(source_quote, "quote_number", None)
        if not quote_number and data.quote_id:
            quote_row = db.query(QuoteModel).filter(QuoteModel.id == data.quote_id).one_or_none()
            quote_number = quote_row.quote_number if quote_row else None
        invoice_number = generate_invoice_reference(db, quote_number)
        
        # Extract items & calculate totals
        if modified_quote:
            # Use ModifiedQuote aggregated pricing
            items = []
            subtotal = float(source_quote.subtotal or 0)
            discount_amount = float(source_quote.discount_amount or 0)
            tax_rate = float(source_quote.tax_rate or 16)
            tax_amount = float(source_quote.tax_amount or 0)
            total = float(source_quote.total or 0)
            include_vat = bool(getattr(source_quote, "include_vat", True))
        else:
            # Build items from QuoteItems table
            from db.models import QuoteItem as QuoteItemModel

            quote_items = (
                db.query(QuoteItemModel)
                .filter(QuoteItemModel.quote_id == data.quote_id)
                .all()
            )
            items = []
            for item in quote_items:
                list_price = float(getattr(item, "list_price", 0) or 0)
                agreed = float(item.unit_price or 0)
                qty = int(getattr(item, "quoted_quantity", None) or item.quantity or 1)
                items.append(
                    {
                        "product_id": item.product_id,
                        "product_name": item.product_name,
                        "category": item.category,
                        "quantity": qty,
                        "original_price": list_price or agreed,
                        "modified_price": agreed,
                        "list_price": list_price or agreed,
                        "unit_price": agreed,
                        "discount_percent": 0,
                        "notes": item.notes,
                    }
                )

            from utils.totals import document_pricing, items_to_pricing_payload
            include_vat = bool(getattr(source_quote, "include_vat", True))
            computed = document_pricing(
                items_to_pricing_payload(items),
                tax_rate=getattr(source_quote, "tax_rate", None),
                include_vat=include_vat,
            )
            discount_amount = computed["discount_amount"]
            tax_rate = computed["tax_rate"]
            tax_amount = computed["tax_amount"]
            subtotal = computed["quoted_subtotal"]
            total = computed["total"]
        
        # Validate pricing
        if not validate_pricing(subtotal, discount_amount, tax_rate):
            raise HTTPException(status_code=400, detail="Invalid pricing data")
        
        # Calculate due date (default: company settings 14 days)
        settings_row = (
            db.query(SiteSettings)
            .filter(SiteSettings.id == "site_settings")
            .one_or_none()
        )
        default_due_days = getattr(settings_row, "default_invoice_due_days", None) or 14
        due_days = int(data.payment_terms or default_due_days)
        due_date = datetime.utcnow() + timedelta(days=due_days)

        # Create invoice + items via repository
        pricing = {
            "subtotal": subtotal,
            "discount_amount": discount_amount,
            "tax_rate": tax_rate,
            "tax_amount": tax_amount,
            "total": total,
            "include_vat": include_vat,
        }
        meta = {
            "invoice_number": invoice_number,
            "payment_terms": f"Net {due_days}",
            "due_date": due_date,
            "status": INVOICE_AWAITING_PAYMENT,
            "notes": data.notes,
            "created_by": current_user.id,
        }

        invoice_dict = await run_in_threadpool(
            invoices_repo.create_invoice_from_quote,
            db,
            quote=source_quote if not modified_quote else db.query(QuoteModel).filter(QuoteModel.id == data.quote_id).one(),
            modified_quote=source_quote if modified_quote else None,
            items_payload=items,
            pricing=pricing,
            meta=meta,
        )
        logger.info(f"Invoice {invoice_number} created by {current_user.email}")
        
        # Send invoice email to customer
        try:
            send_invoice_email(
                contact_person=invoice_dict["contact_person"],
                email=invoice_dict["email"],
                facility_name=invoice_dict["facility_name"],
                invoice_number=invoice_number,
                items=items,
                subtotal=subtotal,
                discount=discount_amount,
                tax_rate=tax_rate,
                tax_amount=tax_amount,
                total=total,
                due_date=serialize_datetime(due_date),
                payment_terms=meta.get("payment_terms") or "Net 14",
                notes=data.notes or "",
                include_vat=include_vat,
            )
        except Exception as e:
            logger.error(f"Failed to send invoice email: {str(e)}")
        
        # Update quote status in Postgres
        quote_row = (
            db.query(QuoteModel).filter(QuoteModel.id == data.quote_id).one_or_none()
        )
        if quote_row:
            quote_row.status = "invoiced"
            quote_row.current_handler = "AWAITING_PAYMENT"
            db.commit()
        from utils.live_events import publish_entity_event
        publish_entity_event(
            "invoice.updated",
            entity_type="invoice",
            entity_id=invoice_dict["id"],
            organization_id=invoice_dict.get("organization_id") or (quote_row.organization_id if quote_row else None),
            invoice_id=invoice_dict["id"],
            quote_id=data.quote_id,
        )
        
        return {
            "message": "Invoice created and sent to customer",
            "invoice_number": invoice_number,
            "invoice_id": invoice_dict["id"],
            "status": INVOICE_AWAITING_PAYMENT,
            "due_date": serialize_datetime(due_date),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create invoice: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create invoice")


def _require_invoice_ops(user: UserResponse) -> None:
    if not company_has_permission(user.role, "invoices"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")


@router.get("/admin/invoices", tags=["invoices"])
async def list_all_invoices(
    current_user: UserResponse = Depends(get_admin_user),
    status_filter: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """List all invoices (admin only)."""
    _require_invoice_ops(current_user)
    try:
        from utils.list_query import clamp_page, parse_day_end, parse_day_start

        page_n, limit_n, _ = clamp_page(page, limit)
        try:
            start = parse_day_start(from_date)
            end = parse_day_end(to_date)
        except ValueError:
            start = None
            end = None
        invoices, total = await run_in_threadpool(
            invoices_repo.list_invoices_admin,
            db,
            status_filter=status or status_filter,
            search=search,
            from_date=start,
            to_date=end,
            page=page_n,
            limit=limit_n,
        )
        pages = max((total + limit_n - 1) // limit_n, 1) if total else 1
        return {
            "invoices": invoices or [],
            "total": total,
            "page": page_n,
            "limit": limit_n,
            "pages": pages,
        }
    except Exception as e:
        logger.error(f"Failed to list invoices: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve invoices")


@router.post("/admin/resend-invoice/{invoice_id}", tags=["invoices"])
async def resend_invoice_email_admin(
    invoice_id: str,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Resend an existing invoice email to the customer (admin only)."""
    invoice = await run_in_threadpool(invoices_repo.get_invoice_by_id, db, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Build items in the format expected by email template
    items = [
        {
            "product_id": it.get("product_id"),
            "product_name": it.get("product_name"),
            "category": it.get("category"),
            "quantity": it.get("quantity"),
            "original_price": it.get("original_price"),
            "modified_price": it.get("modified_price"),
            "discount_percent": it.get("discount_percent") or 0,
            "notes": it.get("notes"),
        }
        for it in (invoice.get("items") or [])
    ]

    try:
        send_invoice_email(
            contact_person=invoice.get("contact_person") or "",
            email=invoice.get("email") or "",
            facility_name=invoice.get("facility_name") or "",
            invoice_number=invoice.get("invoice_number") or "",
            items=items,
            subtotal=float(invoice.get("subtotal") or 0),
            discount=float(invoice.get("discount_amount") or 0),
            tax_rate=float(invoice.get("tax_rate") or 0),
            tax_amount=float(invoice.get("tax_amount") or 0),
            total=float(invoice.get("total") or 0),
            due_date=(serialize_datetime(invoice.get("due_date")) if invoice.get("due_date") else ""),
            payment_terms=str(invoice.get("payment_terms") or "Net 30"),
            notes=str(invoice.get("notes") or ""),
            include_vat=bool(invoice.get("include_vat", True)),
        )
    except Exception as e:
        logger.error(f"Failed to resend invoice email for {invoice_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to resend invoice email")

    logger.info(f"Invoice {invoice.get('invoice_number')} resent by {current_user.email}")
    return {"message": "Invoice email resent successfully"}


@router.post("/admin/invoices/{invoice_id}/resend", tags=["invoices"])
async def resend_invoice_email_admin_alias(
    invoice_id: str,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """
    Alias endpoint for resending invoice emails.
    Some deployments/frontends may expect this nested invoices path.
    """
    return await resend_invoice_email_admin(invoice_id, current_user=current_user, db=db)

@router.get("/admin/invoices/{invoice_id}", response_model=dict, tags=["invoices"])
async def get_invoice_admin(
    invoice_id: str,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Get invoice details (admin only)."""
    _require_invoice_ops(current_user)
    try:
        invoice = await run_in_threadpool(
            invoices_repo.get_invoice_by_id, db, invoice_id
        )
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        return invoice
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve invoice {invoice_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve invoice")

@router.get("/admin/invoices/{invoice_id}/download", tags=["invoices"])
async def download_invoice_pdf_admin(
    invoice_id: str,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Download invoice as PDF (admin only)."""
    try:
        invoice = await run_in_threadpool(_resolve_invoice, db, invoice_id)
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        # Build company info from SiteSettings via SQLAlchemy (avoids circular imports)
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
            "default_payment_terms": settings_row.default_payment_terms if settings_row and settings_row.default_payment_terms else "Net 14",
        }

        pdf_base64 = await generate_invoice_pdf(
            invoice,
            company_info,
            is_paid=(invoice.get("status") == "paid"),
        )

        pdf_bytes = io.BytesIO()
        pdf_bytes.write(base64.b64decode(pdf_base64))
        pdf_bytes.seek(0)

        return StreamingResponse(
            iter([pdf_bytes.getvalue()]),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{invoice.get("invoice_number") or invoice_id}.pdf"'
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate invoice PDF for {invoice_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate PDF")

@router.get("/admin/invoices/{invoice_id}/delivery-note", tags=["invoices"])
async def download_delivery_note_admin(
    invoice_id: str,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Download delivery note PDF generated from invoice details (admin only)."""
    try:
        invoice = await run_in_threadpool(_resolve_invoice, db, invoice_id)
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

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
            "email": (
                settings_row.email
                if settings_row and settings_row.email
                else "admin@hamptonscientific.com"
            ),
        }

        pdf_base64 = await generate_delivery_note_pdf(invoice, company_info)

        pdf_bytes = io.BytesIO()
        pdf_bytes.write(base64.b64decode(pdf_base64))
        pdf_bytes.seek(0)

        filename = f"DeliveryNote_{invoice.get('invoice_number') or invoice_id}.pdf"
        return StreamingResponse(
            iter([pdf_bytes.getvalue()]),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate delivery note PDF for {invoice_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate delivery note PDF")

@router.put("/admin/invoices/{invoice_id}", response_model=dict, tags=["invoices"])
async def update_invoice(
    invoice_id: str,
    update_data: dict,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Update invoice details (admin only)."""
    try:
        inv = (
            db.query(InvoiceModel).filter(InvoiceModel.id == invoice_id).one_or_none()
        )
        if not inv:
            raise HTTPException(status_code=404, detail="Invoice not found")

        for key, value in update_data.items():
            if hasattr(inv, key):
                setattr(inv, key, value)
        inv.updated_at = datetime.utcnow()
        db.commit()
        from utils.live_events import publish_entity_event
        publish_entity_event(
            "invoice.updated",
            entity_type="invoice",
            entity_id=invoice_id,
            organization_id=inv.organization_id,
            invoice_id=invoice_id,
            quote_id=inv.quote_id,
        )
        
        logger.info(f"Invoice {invoice_id} updated by {current_user.email}")
        
        return {"message": "Invoice updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update invoice {invoice_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update invoice")

@router.put("/admin/invoices/{invoice_id}/mark-paid", tags=["invoices"])
async def mark_invoice_paid_admin(
    invoice_id: str,
    payment_data: dict,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Mark invoice as paid (admin only)."""
    _require_invoice_ops(current_user)
    try:
        inv = (
            db.query(InvoiceModel).filter(InvoiceModel.id == invoice_id).one_or_none()
        )
        if not inv:
            raise HTTPException(status_code=404, detail="Invoice not found")

        if inv.status == "paid":
            raise HTTPException(
                status_code=400, detail="Invoice already marked as paid"
            )

        payment_method = payment_data.get("payment_method", "manual")

        inv.status = "paid"
        inv.paid_at = datetime.utcnow()
        inv.notes = inv.notes
        db.commit()
        from utils.live_events import publish_entity_event
        publish_entity_event(
            "invoice.updated",
            entity_type="invoice",
            entity_id=invoice_id,
            organization_id=inv.organization_id,
            invoice_id=invoice_id,
            quote_id=inv.quote_id,
        )
        
        logger.info(f"Invoice {invoice_id} marked as paid by {current_user.email}")
        
        return {
            "message": "Invoice marked as paid",
            "invoice_id": invoice_id,
            "status": "paid"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to mark invoice {invoice_id} as paid: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update invoice")

@router.delete("/admin/invoices/{invoice_id}", tags=["invoices"])
async def delete_invoice(
    invoice_id: str,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Delete invoice (admin only)."""
    try:
        inv = (
            db.query(InvoiceModel).filter(InvoiceModel.id == invoice_id).one_or_none()
        )
        if not inv:
            raise HTTPException(status_code=404, detail="Invoice not found")

        db.delete(inv)
        db.commit()

        logger.info(f"Invoice {invoice_id} deleted by {current_user.email}")
        
        return {"message": "Invoice deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete invoice {invoice_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete invoice")