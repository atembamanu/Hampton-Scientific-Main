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
            Invoice.status.in_(["pending", "unpaid"]),
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


# Email template functions
def get_quote_followup_html(quote: dict, custom_message: str = None) -> str:
    """Generate HTML for quote follow-up email"""
    facility_name = quote.get("facility_name", "Customer")
    contact_person = quote.get("contact_person", "")
    quote_id = quote.get("id", "")[:8].upper()
    
    items_html = ""
    total = 0
    for item in quote.get("items", []):
        price = item.get("unit_price", 0) or 0
        qty = item.get("quantity", 1)
        line_total = price * qty
        total += line_total
        items_html += f"""
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">{item.get('product_name', '')}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: center;">{qty}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: right;">KES {price:,.0f}</td>
        </tr>
        """
    
    message = custom_message or "We wanted to follow up on the quotation we sent you. Please review the items below and let us know if you have any questions or would like to proceed with your order."
    
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #006332 0%, #00a550 100%); padding: 30px 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Hampton Scientific</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Medical Supplier & Trainer</p>
        </div>
        
        <div style="padding: 30px; background: #ffffff;">
            <h2 style="color: #006332; margin-bottom: 20px;">Quote Follow-Up</h2>
            
            <p>Dear {contact_person or facility_name},</p>
            
            <p>{message}</p>
            
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>Quote Reference:</strong> {quote_id}</p>
                <p style="margin: 0 0 10px 0;"><strong>Facility:</strong> {facility_name}</p>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                    <tr style="background: #006332; color: white;">
                        <th style="padding: 12px; text-align: left;">Product</th>
                        <th style="padding: 12px; text-align: center;">Qty</th>
                        <th style="padding: 12px; text-align: right;">Unit Price</th>
                    </tr>
                </thead>
                <tbody>
                    {items_html}
                </tbody>
                <tfoot>
                    <tr style="background: #f0f0f0;">
                        <td colspan="2" style="padding: 12px; text-align: right; font-weight: bold;">Total:</td>
                        <td style="padding: 12px; text-align: right; font-weight: bold; color: #006332;">KES {total:,.0f}</td>
                    </tr>
                </tfoot>
            </table>
            
            <p>To accept this quote or request any changes, please reply to this email or log in to your account.</p>
            
            <p style="margin-top: 30px;">Best regards,<br><strong>Hampton Scientific Team</strong></p>
        </div>
        
        <div style="background: #1a1a1a; color: #888; padding: 20px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">Hampton Scientific Limited</p>
            <p style="margin: 5px 0;">Phone: 0717 023 814 | Email: info@hamptonscientific.com</p>
        </div>
    </div>
    """


def get_invoice_reminder_html(invoice: dict, is_overdue: bool = False) -> str:
    """Generate HTML for invoice reminder email"""
    facility_name = invoice.get("facility_name", "Customer")
    contact_person = invoice.get("contact_person", "")
    invoice_number = invoice.get("invoice_number", "")
    total = invoice.get("total", 0)
    due_date = invoice.get("due_date")
    
    due_date_str = due_date.strftime("%B %d, %Y") if due_date else "N/A"
    
    subject_line = "Invoice Overdue - Action Required" if is_overdue else "Invoice Reminder"
    urgency_color = "#dc2626" if is_overdue else "#f59e0b"
    
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #006332 0%, #00a550 100%); padding: 30px 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Hampton Scientific</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Medical Supplier & Trainer</p>
        </div>
        
        <div style="padding: 30px; background: #ffffff;">
            <h2 style="color: {urgency_color}; margin-bottom: 20px;">{subject_line}</h2>
            
            <p>Dear {contact_person or facility_name},</p>
            
            {"<p style='color: #dc2626;'><strong>This invoice is now overdue. Please arrange payment as soon as possible to avoid any service interruptions.</strong></p>" if is_overdue else "<p>This is a friendly reminder about your upcoming invoice payment.</p>"}
            
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid {urgency_color};">
                <p style="margin: 0 0 10px 0;"><strong>Invoice Number:</strong> {invoice_number}</p>
                <p style="margin: 0 0 10px 0;"><strong>Amount Due:</strong> <span style="font-size: 1.2em; color: #006332;">KES {total:,.0f}</span></p>
                <p style="margin: 0;"><strong>Due Date:</strong> <span style="color: {urgency_color};">{due_date_str}</span></p>
            </div>
            
            <p>If you have already made this payment, please disregard this reminder. For any questions regarding this invoice, please contact us.</p>
            
            <p style="margin-top: 30px;">Best regards,<br><strong>Hampton Scientific Team</strong></p>
        </div>
        
        <div style="background: #1a1a1a; color: #888; padding: 20px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">Hampton Scientific Limited</p>
            <p style="margin: 5px 0;">Phone: 0717 023 814 | Email: info@hamptonscientific.com</p>
        </div>
    </div>
    """
