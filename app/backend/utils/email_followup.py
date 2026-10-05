"""
Automated Email Follow-Up System using Postgres.

Handles scheduled follow-up emails for quotes and invoices via SQLAlchemy
models and repositories.
"""

import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any

from sqlalchemy.orm import Session

from repositories import email_config as email_repo
from db.models import Quote, QuoteItem, Invoice, InvoiceItem
from utils.ops_stats import OPEN_INVOICE_STATUSES

logger = logging.getLogger(__name__)

# Default follow-up settings
DEFAULT_FOLLOWUP_SETTINGS = {
    "quote_followup_enabled": True,
    "quote_followup_hours": 24,  # Send follow-up 24 hours after quote sent
    "invoice_followup_enabled": True,
    "invoice_followup_days": 7,  # Send reminder 7 days before due date
    "invoice_overdue_reminder_days": 3,  # Send reminder every 3 days after overdue
}


async def get_followup_settings(db: Session) -> Dict[str, Any]:
    """Get email follow-up settings from Postgres."""
    settings_row = email_repo.get_email_settings(db)
    settings = {
        "quote_followup_enabled": settings_row.quote_followup_enabled,
        "quote_followup_hours": settings_row.quote_followup_hours,
        "invoice_followup_enabled": settings_row.invoice_followup_enabled,
        "invoice_followup_days": settings_row.invoice_followup_days,
        "invoice_overdue_reminder_days": settings_row.invoice_overdue_reminder_days,
    }
    # Merge with defaults to ensure any new keys are present
    merged = {**DEFAULT_FOLLOWUP_SETTINGS, **settings}
    return merged


async def update_followup_settings(db: Session, settings: dict) -> Dict[str, Any]:
    """Update email follow-up settings in Postgres."""
    allowed_fields = list(DEFAULT_FOLLOWUP_SETTINGS.keys())
    update_data = {k: v for k, v in settings.items() if k in allowed_fields}
    settings_row = email_repo.update_email_settings(db, update_data)
    return {
        "quote_followup_enabled": settings_row.quote_followup_enabled,
        "quote_followup_hours": settings_row.quote_followup_hours,
        "invoice_followup_enabled": settings_row.invoice_followup_enabled,
        "invoice_followup_days": settings_row.invoice_followup_days,
        "invoice_overdue_reminder_days": settings_row.invoice_overdue_reminder_days,
    }


async def log_email(db: Session, email_data: dict) -> Dict[str, Any]:
    """Log sent email for tracking in Postgres."""
    log_row = email_repo.insert_email_log(db, email_data)
    logger.info(f"Email logged: {email_data.get('type')} to {email_data.get('to')}")
    return {
        "id": log_row.id,
        "to": log_row.to.split(",") if log_row.to else [],
        "subject": log_row.subject,
        "type": log_row.type,
        "related_id": log_row.related_id,
        "status": log_row.status,
        "sent_at": log_row.sent_at,
        "error": log_row.error,
    }


async def get_email_logs(
    db: Session, filters: dict | None = None, limit: int = 100
) -> List[dict]:
    """Get email logs with optional filters from Postgres."""
    rows = email_repo.list_email_logs(db, filters, limit)
    result: List[dict] = []
    for r in rows:
        result.append(
            {
                "id": r.id,
                "to": r.to.split(",") if r.to else [],
                "subject": r.subject,
                "type": r.type,
                "related_id": r.related_id,
                "status": r.status,
                "sent_at": r.sent_at,
                "error": r.error,
            }
        )
    return result


async def get_quotes_needing_followup(db: Session, hours: int = 24) -> List[dict]:
    """Get quotes that need follow-up (status = quoted, no customer response, updated < cutoff)."""
    cutoff_time = datetime.utcnow() - timedelta(hours=hours)

    quotes = (
        db.query(Quote)
        .filter(
            Quote.status == "quoted",
            Quote.customer_response.is_(None),
            Quote.updated_at < cutoff_time,
        )
        .all()
    )

    result: List[dict] = []
    for q in quotes:
        items = (
            db.query(QuoteItem)
            .filter(QuoteItem.quote_id == q.id)
            .all()
        )
        result.append(
            {
                "id": q.id,
                "quote_number": getattr(q, "quote_number", None),
                "facility_name": q.facility_name,
                "contact_person": q.contact_person,
                "email": q.email,
                "items": [
                    {
                        "product_id": it.product_id,
                        "product_name": it.product_name,
                        "quantity": it.quantity,
                        "unit_price": it.modified_price or it.original_price or 0,
                    }
                    for it in items
                ],
            }
        )
    return result


async def get_invoices_needing_reminder(
    db: Session, days_before_due: int = 7
) -> List[dict]:
    """Get unpaid invoices approaching due date."""
    reminder_date = datetime.utcnow() + timedelta(days=days_before_due)

    invoices = (
        db.query(Invoice)
        .filter(
            Invoice.status.in_(list(OPEN_INVOICE_STATUSES)),
            Invoice.due_date != None,  # noqa: E711
            Invoice.due_date <= reminder_date,
        )
        .all()
    )

    result: List[dict] = []
    for inv in invoices:
        items = (
            db.query(InvoiceItem)
            .filter(InvoiceItem.invoice_id == inv.id)
            .all()
        )
        result.append(
            {
                "id": inv.id,
                "facility_name": inv.facility_name,
                "contact_person": inv.contact_person,
                "email": inv.email,
                "invoice_number": inv.invoice_number,
                "items": [
                    {
                        "product_id": it.product_id,
                        "product_name": it.product_name,
                        "quantity": it.quantity,
                        "original_price": it.original_price,
                        "modified_price": it.modified_price,
                    }
                    for it in items
                ],
                "subtotal": inv.subtotal,
                "discount_amount": inv.discount_amount,
                "tax_rate": inv.tax_rate,
                "tax_amount": inv.tax_amount,
                "include_vat": getattr(inv, "include_vat", True),
                "total": inv.total,
                "due_date": inv.due_date,
                "payment_terms": getattr(inv, "payment_terms", ""),
                "notes": inv.notes or "",
                "created_at": inv.created_at,
            }
        )
    return result


async def mark_quote_followup_sent(db: Session, quote_id: str) -> None:
    """Placeholder for marking quote follow-up; implemented in Quote table if needed."""
    # For now, no-op; could add followup_sent fields on Quote if required.
    return None


async def mark_invoice_reminder_sent(db: Session, invoice_id: str) -> None:
    """Placeholder for marking invoice reminder; implemented in Invoice table if needed."""
    # For now, no-op; could add reminder_sent fields on Invoice if required.
    return None


# Email template helpers — use shared modern shell
def get_quote_followup_html(quote: dict, custom_message: str = None) -> str:
    """Generate HTML for quote follow-up email (modern shell)."""
    from utils.email_layout import (
        e,
        email_detail_card,
        email_items_table,
        first_name_only,
        render_email,
        BORDER,
        INK,
        MUTED,
    )
    from utils.email_service import _get_company_info_from_db, _company_signature_html

    facility_name = quote.get("facility_name", "Customer")
    contact_person = quote.get("contact_person", "")
    quote_id = (quote.get("id") or "")[:8].upper()
    company_info = _get_company_info_from_db()

    items_html = ""
    total = 0
    for item in quote.get("items", []):
        price = item.get("unit_price", 0) or 0
        qty = item.get("quantity", 1)
        total += price * qty
        items_html += f"""
        <tr>
            <td style="padding:12px; border-bottom:1px solid {BORDER}; color:{INK}; font-size:14px;">{e(item.get('product_name', ''))}</td>
            <td style="padding:12px; border-bottom:1px solid {BORDER}; text-align:center; color:{MUTED}; font-size:14px;">{e(qty)}</td>
            <td style="padding:12px; border-bottom:1px solid {BORDER}; text-align:right; color:{MUTED}; font-size:14px;">KES {price:,.0f}</td>
        </tr>
        """

    message = custom_message or (
        "We wanted to follow up on the quotation we sent you. Please review the items below and let us know "
        "if you have any questions or would like to proceed with your order."
    )

    return render_email(
        "Quote Follow-Up",
        (
            f'<p style="margin:0 0 14px 0;">Dear {e(first_name_only(contact_person or facility_name))},</p>'
            f'<p style="margin:0 0 14px 0;">{e(message)}</p>'
            + email_detail_card([
                ("Quote reference", e(quote_id)),
                ("Facility", e(facility_name)),
            ])
            + email_items_table(
                items_html,
                footer_label="Total",
                footer_value=f"KES {total:,.0f}",
                columns=[("Product", "left"), ("Qty", "center"), ("Unit Price", "right")],
            )
            + '<p style="margin:0 0 8px 0;">To accept this quote or request changes, reply to this email or log in to your account.</p>'
            + _company_signature_html(company_info)
        ),
        eyebrow="Following up",
        company_info=company_info,
    )


def get_invoice_reminder_html(invoice: dict, is_overdue: bool = False) -> str:
    """Generate HTML for invoice reminder email (modern shell)."""
    from utils.app_time import format_app
    from utils.email_layout import e, email_detail_card, email_highlight, first_name_only, render_email, GREEN
    from utils.email_service import _get_company_info_from_db, _company_signature_html

    facility_name = invoice.get("facility_name", "Customer")
    contact_person = invoice.get("contact_person", "")
    invoice_number = invoice.get("invoice_number", "")
    total = invoice.get("total", 0) or 0
    due_date = invoice.get("due_date")
    due_date_str = format_app(due_date, "%B %d, %Y", default="N/A") if due_date else "N/A"
    company_info = _get_company_info_from_db()

    subject_line = "Invoice Overdue — Action Required" if is_overdue else "Invoice Reminder"
    intro = (
        "<strong>This invoice is now overdue.</strong> Please arrange payment as soon as possible."
        if is_overdue
        else "This is a friendly reminder about your upcoming invoice payment."
    )

    return render_email(
        subject_line,
        (
            f'<p style="margin:0 0 14px 0;">Dear {e(first_name_only(contact_person or facility_name))},</p>'
            + email_highlight(intro, tone="red" if is_overdue else "amber")
            + email_detail_card([
                ("Invoice number", e(invoice_number)),
                ("Amount due", f"KES {float(total):,.0f}"),
                ("Due date", e(due_date_str)),
                ("Facility", e(facility_name)),
            ], accent="#c4704a" if is_overdue else GREEN)
            + '<p style="margin:0 0 8px 0;">If you have already made this payment, please disregard this reminder.</p>'
            + _company_signature_html(company_info)
        ),
        eyebrow="Payment reminder",
        company_info=company_info,
    )
