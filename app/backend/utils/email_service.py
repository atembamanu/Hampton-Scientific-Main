import os
import asyncio
import logging
import base64
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, parseaddr
from typing import List, Optional
from pathlib import Path

from env_loader import load_app_env
from jinja2 import Environment, FileSystemLoader, select_autoescape

from db.session import SessionLocal
from db.models import SiteSettings
from utils.pdf import generate_invoice_pdf, generate_quote_pdf
from utils.email_layout import (
    e,
    email_cta,
    email_detail_card,
    email_greeting,
    email_highlight,
    email_info_grid,
    email_item_rows,
    email_items_table,
    email_panel,
    email_section_title,
    email_status_row,
    email_totals_block,
    first_name_only,
    mailto,
    render_email,
    GREEN,
    BORDER,
    INK,
    MUTED,
)


load_app_env()

logger = logging.getLogger(__name__)
frontend_url = os.environ['FRONTEND_URL'] 

# Module-level company info cache (set from server.py)
_company_info = {}

DEFAULT_COMPANY_EMAIL = "info@hamptonscientific.com"
DEFAULT_SENDER = f"Hampton Scientific <{DEFAULT_COMPANY_EMAIL}>"

def set_company_info(info: dict):
    """Called from server.py to update company info cache"""
    global _company_info
    _company_info = info


def _get_company_info_from_db() -> dict:
    """
    Source of truth for company/payment details used in emails.
    Prefer DB at send-time to avoid stale cache.
    """
    with SessionLocal() as session:
        row = (
            session.query(SiteSettings)
            .filter(SiteSettings.id == "site_settings")
            .one_or_none()
        )
        if not row:
            return _company_info or {}
        return {
            "company_name": row.company_name or "Hampton Scientific Limited",
            "website": getattr(row, "website", None) or "",
            "address": row.address or "",
            "po_box": row.po_box or "",
            "phone": row.phone or "",
            "email": row.email or "",
            "working_hours": row.working_hours or "",
            "bank_name": row.bank_name or "",
            "bank_account_name": row.bank_account_name or "",
            "bank_account_number": row.bank_account_number or "",
            "mpesa_paybill": row.mpesa_paybill or "",
            "mpesa_account_number": row.mpesa_account_number or "",
            "mpesa_account_name": row.mpesa_account_name or "",
            "default_payment_terms": getattr(row, "default_payment_terms", "") or "",
        }


def _company_signature_html(company_info: dict) -> str:
    name = e(company_info.get("company_name") or "Hampton Scientific Limited")
    return f'<p style="margin:24px 0 0 0; color:{INK};">Best regards,<br><strong>{name} Team</strong></p>'


def _wrap_document_email(title: str, body_html: str, *, eyebrow: str = "Document", company_info: dict = None) -> str:
    return render_email(
        title,
        body_html,
        eyebrow=eyebrow,
        company_info=company_info or _get_company_info_from_db(),
    )


def _get_jinja_env() -> Environment:
    # Templates live alongside pdf templates in backend/utils
    templates_dir = Path(__file__).resolve().parent
    return Environment(
        loader=FileSystemLoader(str(templates_dir)),
        autoescape=select_autoescape(["html", "xml"]),
    )


def _run_coro(coro):
    """
    Run an async coroutine from sync context.
    If we're already in an event loop, schedule it in the background.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    else:
        loop.create_task(coro)
        return None


async def _send_document_email(
    *,
    to_email: str,
    subject: str,
    template_name: str,
    context: dict,
    pdf_filename: str,
    pdf_base64: str,
) -> dict:
    env = _get_jinja_env()
    html = env.get_template(template_name).render(**context)
    attachments = [{"filename": pdf_filename, "content": pdf_base64}]
    return await send_email_async([to_email], subject, html, attachments=attachments)

# Outbound mail via Zoho (or any) SMTP.
SENDER_EMAIL = (os.environ.get("SENDER_EMAIL") or DEFAULT_SENDER).strip()
ADMIN_EMAIL = (os.environ.get("ADMIN_EMAIL") or DEFAULT_COMPANY_EMAIL).strip()

def _env_secret(name: str) -> str:
    """Read env value and strip whitespace / wrapping quotes from .env editors."""
    value = (os.environ.get(name) or "").strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
        value = value[1:-1].strip()
    return value


SMTP_HOST = _env_secret("SMTP_HOST")
SMTP_PORT = int(_env_secret("SMTP_PORT") or "465")
SMTP_USER = _env_secret("SMTP_USER")
# Zoho MFA: use an application-specific password (SMTP_APP_PASSWORD or SMTP_PASSWORD).
SMTP_PASSWORD = _env_secret("SMTP_APP_PASSWORD") or _env_secret("SMTP_PASSWORD")
SMTP_USE_SSL = (_env_secret("SMTP_USE_SSL") or "true").lower() in ("1", "true", "yes")

if SMTP_HOST and SMTP_USER and SMTP_PASSWORD:
    logger.info("SMTP email delivery configured (%s:%s)", SMTP_HOST, SMTP_PORT)
else:
    logger.warning("SMTP not configured — emails will be logged only")


def _smtp_configured() -> bool:
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD)


def _admin_inbox() -> str:
    """Inbox for quote/contact/training notifications — Admin Settings email, else env."""
    try:
        email = (_get_company_info_from_db().get("email") or "").strip()
        if email:
            return email
    except Exception:
        logger.debug("Could not load site settings email for admin inbox", exc_info=True)
    return ADMIN_EMAIL or DEFAULT_COMPANY_EMAIL


def _sender_address() -> str:
    """From header for client-facing mail."""
    sender = (SENDER_EMAIL or "").strip()
    if sender:
        return sender
    try:
        ci = _get_company_info_from_db()
        email = (ci.get("email") or DEFAULT_COMPANY_EMAIL).strip()
        name = (ci.get("company_name") or "Hampton Scientific").strip()
        return formataddr((name, email))
    except Exception:
        return DEFAULT_SENDER


def _from_email_only(sender: str) -> str:
    _name, addr = parseaddr(sender or "")
    return (addr or sender or SMTP_USER or DEFAULT_COMPANY_EMAIL).strip()


def _send_via_smtp(
    to_emails: List[str],
    subject: str,
    html_content: str,
    attachments: Optional[List[dict]] = None,
) -> dict:
    sender = _sender_address()
    reply_to = _admin_inbox()
    msg = MIMEMultipart()
    msg["From"] = sender
    msg["To"] = ", ".join(to_emails)
    msg["Subject"] = subject
    msg["Reply-To"] = reply_to
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    for att in attachments or []:
        filename = att.get("filename") or "attachment.bin"
        raw = base64.b64decode(att.get("content") or "")
        # Explicit PDF subtype so clients show a proper attachment icon/open action.
        subtype = "pdf" if str(filename).lower().endswith(".pdf") else "octet-stream"
        part = MIMEApplication(raw, _subtype=subtype, Name=filename)
        part.add_header("Content-Disposition", "attachment", filename=filename)
        part.add_header("Content-Type", f"application/{subtype}", name=filename)
        msg.attach(part)

    if SMTP_USE_SSL:
        server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=30)
    else:
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30)
        server.ehlo()
        server.starttls()
        server.ehlo()

    try:
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(_from_email_only(sender), to_emails, msg.as_string())
    finally:
        try:
            server.quit()
        except Exception:
            pass
    return {"status": "success"}


def _deliver_email(
    to_emails: List[str],
    subject: str,
    html_content: str,
    attachments: Optional[List[dict]] = None,
) -> dict:
    if _smtp_configured():
        return _send_via_smtp(to_emails, subject, html_content, attachments)
    logger.info(f"[MOCK EMAIL] To: {to_emails}, Subject: {subject}")
    return {"status": "mocked", "message": "Email logged (SMTP not configured)"}


async def send_email_async(to_emails: List[str], subject: str, html_content: str, attachments: Optional[List[dict]] = None) -> dict:
    """
    Send email (async) via SMTP when configured.
    attachments: List of dicts with 'filename' and 'content' (base64 encoded)
    """
    try:
        result = await asyncio.to_thread(_deliver_email, to_emails, subject, html_content, attachments)
        if result.get("status") == "success":
            logger.info(f"Email sent successfully to {to_emails}")
        return result
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        return {"status": "error", "error": str(e)}


def send_email(to_emails: List[str], subject: str, html_content: str, attachments: Optional[List[dict]] = None) -> bool:
    """
    Synchronous email sending (for backwards compatibility)
    """
    try:
        result = _deliver_email(to_emails, subject, html_content, attachments)
        if result.get("status") == "success":
            logger.info(f"Email sent successfully to {to_emails}")
            return True
        return result.get("status") == "mocked"
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        return False


# Legacy shims — prefer render_email for all new templates
def get_email_header(company_info=None):
    return ""


def get_email_footer(company_info=None):
    return ""


def send_contact_inquiry_email(name: str, email: str, phone: str, subject: str, message: str):
    """Send notification email for contact inquiry"""
    company_info = _get_company_info_from_db()
    details = email_detail_card([
        ("Name", e(name)),
        ("Email", mailto(email)),
        ("Phone", e(phone)),
        ("Subject", e(subject)),
    ])
    message_block = (
        email_section_title("Your message")
        + email_panel(e((message or "").strip()))
    )

    admin_html = render_email(
        "New Contact Inquiry",
        details + message_block,
        eyebrow="Website inquiry",
        company_info=company_info,
    )
    send_email([_admin_inbox()], f"New Contact Inquiry: {subject}", admin_html)

    user_html = render_email(
        "We've Received Your Inquiry",
        (
            email_greeting(name, "Thank you for contacting Hampton Scientific. Here is a copy of what you submitted — our team will respond within 24 hours.")
            + email_status_row([
                ("Submitted", "done"),
                ("Under review", "current"),
                ("Reply sent", "todo"),
            ])
            + email_section_title("Inquiry details")
            + details
            + message_block
            + email_highlight("Keep this email for your records. Reply anytime if you need to add more information.")
            + _company_signature_html(company_info)
        ),
        eyebrow="We've got your message",
        company_info=company_info,
    )
    send_email([email], "We've Received Your Inquiry - Hampton Scientific", user_html)


def send_quote_request_email(
    facility_name: str,
    contact_person: str,
    email: str,
    phone: str,
    items: list,
    additional_notes: str = "",
    address: str = "",
    branch_name: str = "",
):
    """
    Notify admin + customer after a quote submission.

    Two templates:
    - Product quote (items present): cart/product line details
    - Website inquiry (no items): contact form fields + typed message/categories
    """
    if items:
        _send_product_quote_request_emails(
            facility_name=facility_name,
            contact_person=contact_person,
            email=email,
            phone=phone,
            items=items,
            additional_notes=additional_notes,
            address=address,
            branch_name=branch_name,
        )
    else:
        _send_quote_inquiry_emails(
            facility_name=facility_name,
            contact_person=contact_person,
            email=email,
            phone=phone,
            additional_notes=additional_notes,
        )


def _parse_quote_inquiry_notes(notes: str) -> tuple[str, str]:
    """Split contact-form notes into categories line + free-text message."""
    text = (notes or "").strip()
    if not text:
        return "", ""
    lines = text.splitlines()
    categories = ""
    message_lines = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        if i == 0 and stripped.lower().startswith("categories:"):
            categories = stripped.split(":", 1)[1].strip()
            continue
        if i == 0 and stripped.lower().startswith("category:"):
            categories = stripped.split(":", 1)[1].strip()
            continue
        message_lines.append(line)
    return categories, "\n".join(message_lines).strip()


def _send_quote_inquiry_emails(
    *,
    facility_name: str,
    contact_person: str,
    email: str,
    phone: str,
    additional_notes: str = "",
):
    """Website Contact → Request quote (no cart products)."""
    company_info = _get_company_info_from_db()
    categories, message = _parse_quote_inquiry_notes(additional_notes)
    contact_card = email_detail_card([
        ("Facility", e(facility_name)),
        ("Contact", e(contact_person)),
        ("Email", mailto(email)),
        ("Phone", e(phone)),
        ("Product categories", e(categories) if categories else None),
    ])
    message_block = ""
    if message:
        message_block = email_section_title("Your message") + email_panel(e(message))
    elif additional_notes and not categories:
        message_block = email_section_title("Your message") + email_panel(e(additional_notes.strip()))

    admin_html = render_email(
        "New Quote Inquiry",
        contact_card + message_block,
        eyebrow="Website quote request",
        company_info=company_info,
    )
    send_email([_admin_inbox()], f"New Quote Inquiry from {facility_name}", admin_html)

    phone_line = e(company_info.get("phone") or "")
    user_html = render_email(
        "We've Received Your Quote Request",
        (
            email_greeting(
                contact_person,
                "Thank you for requesting a quotation. Here is a copy of what you submitted — our team will prepare pricing and respond within 24–48 hours.",
            )
            + email_status_row([
                ("Request received", "done"),
                ("Preparing quote", "current"),
                ("Quote sent", "todo"),
            ])
            + email_section_title("Request details")
            + contact_card
            + message_block
            + email_highlight(
                "<strong>Keep this email for your records.</strong><br>"
                '<span style="font-size:13px;">We will follow up with an official quotation based on the categories and details you provided.</span>'
            )
            + (f'<p style="margin:0 0 8px 0;">For urgent queries, call us at <strong style="color:{INK};">{phone_line}</strong>.</p>' if phone_line else "")
            + _company_signature_html(company_info)
        ),
        eyebrow="Quote inquiry",
        company_info=company_info,
    )
    send_email([email], "Quote Request Received - Hampton Scientific", user_html)


def _send_product_quote_request_emails(
    *,
    facility_name: str,
    contact_person: str,
    email: str,
    phone: str,
    items: list,
    additional_notes: str = "",
    address: str = "",
    branch_name: str = "",
):
    """Quote cart / product selection submission."""
    company_info = _get_company_info_from_db()
    admin_rows, total_value = email_item_rows(items, show_prices=True)
    client_rows, _ = email_item_rows(items, show_prices=False)
    contact_card = email_detail_card([
        ("Facility", e(facility_name)),
        ("Contact", e(contact_person)),
        ("Email", mailto(email)),
        ("Phone", e(phone)),
        ("Branch", e(branch_name) if branch_name else None),
        ("Address", e(address) if address else None),
    ])
    notes_block = ""
    if additional_notes and str(additional_notes).strip():
        notes_block = email_section_title("Additional notes") + email_panel(e(str(additional_notes).strip()))

    admin_html = render_email(
        "New Product Quote Request",
        (
            contact_card
            + email_section_title(f"Quoted products ({len(items)})")
            + email_items_table(
                admin_rows,
                footer_label="Estimated total",
                footer_value=f"KES {total_value:,.0f}",
            )
            + notes_block
        ),
        eyebrow="Product quote",
        company_info=company_info,
    )
    send_email([_admin_inbox()], f"New Product Quote from {facility_name}", admin_html)

    phone_line = e(company_info.get("phone") or "")
    user_html = render_email(
        "Quote Request Received",
        (
            email_greeting(
                contact_person,
                f"Thank you for your quote request for <strong style=\"color:{INK};\">{len(items)} product(s)</strong>. "
                "We are preparing a detailed quotation and will send it within 24–48 hours.",
            )
            + email_status_row([
                ("Request received", "done"),
                ("Preparing quote", "current"),
                ("Quote sent", "todo"),
            ])
            + email_section_title("Your details")
            + contact_card
            + email_section_title("Products requested")
            + email_items_table(
                client_rows,
                columns=[("Product", "left"), ("Qty", "center")],
            )
            + notes_block
            + email_highlight(
                "<strong>Pricing will follow in your official quotation.</strong><br>"
                '<span style="font-size:13px;">This confirmation lists the products you selected so you can keep a record.</span>'
            )
            + (f'<p style="margin:0 0 8px 0;">For urgent queries, call us at <strong style="color:{INK};">{phone_line}</strong>.</p>' if phone_line else "")
            + _company_signature_html(company_info)
        ),
        eyebrow="Product quote",
        company_info=company_info,
    )
    send_email([email], "Quote Request Received - Hampton Scientific", user_html)


def send_training_registration_email(facility_name: str, contact_person: str, email: str, phone: str, training_type: str, message: str = ""):
    """Send notification email for training registration"""
    company_info = _get_company_info_from_db()
    details = email_detail_card([
        ("Facility", e(facility_name)),
        ("Contact", e(contact_person)),
        ("Email", mailto(email)),
        ("Phone", e(phone)),
        ("Training type", e(training_type)),
    ])
    notes = ""
    if message and str(message).strip():
        notes = email_section_title("Additional notes") + email_panel(e(str(message).strip()))

    admin_html = render_email(
        "New Training Registration",
        details + notes,
        eyebrow="Training inquiry",
        company_info=company_info,
    )
    send_email([_admin_inbox()], f"New Training Registration: {training_type}", admin_html)

    user_html = render_email(
        "Training Registration Confirmed",
        (
            email_greeting(
                contact_person,
                "Thank you for registering for our training program. Here is a copy of your registration details — we will contact you shortly to schedule your session.",
            )
            + email_status_row([
                ("Registered", "done"),
                ("Scheduling", "current"),
                ("Confirmed", "todo"),
            ])
            + email_section_title("Registration details")
            + details
            + notes
            + email_highlight(f'<strong>Program:</strong> {e(training_type)}')
            + _company_signature_html(company_info)
        ),
        eyebrow="Training",
        company_info=company_info,
    )
    send_email([email], "Training Registration Confirmed - Hampton Scientific", user_html)


def send_newsletter_welcome_email(email: str):
    """Send welcome email for newsletter subscription"""
    from utils.newsletter_tokens import newsletter_unsubscribe_url

    company_info = _get_company_info_from_db()
    unsub = newsletter_unsubscribe_url(email, frontend_url)
    html_content = render_email(
        "Welcome to Our Newsletter",
        (
            '<p style="margin:0 0 14px 0;">Thank you for subscribing to the Hampton Scientific newsletter.</p>'
            '<p style="margin:0 0 8px 0;">You’ll now receive updates about:</p>'
            f'<ul style="margin:0 0 18px 0; padding-left:20px; color:{MUTED};">'
            "<li>New medical equipment and supplies</li>"
            "<li>Training programs and workshops</li>"
            "<li>Industry news and innovations</li>"
            "<li>Special offers and promotions</li>"
            "</ul>"
            + _company_signature_html(company_info)
            + _newsletter_unsubscribe_footer(unsub)
        ),
        eyebrow="Stay informed",
        company_info=company_info,
    )
    send_email([email], "Welcome to Hampton Scientific Newsletter", html_content)


def send_newsletter_already_subscribed_email(email: str):
    """Confirm an address that is already on the newsletter list."""
    from utils.newsletter_tokens import newsletter_unsubscribe_url

    company_info = _get_company_info_from_db()
    unsub = newsletter_unsubscribe_url(email, frontend_url)
    html_content = render_email(
        "You're already subscribed",
        (
            '<p style="margin:0 0 14px 0;">Good news — this email is already on the Hampton Scientific newsletter list.</p>'
            '<p style="margin:0 0 14px 0;">You’ll continue to receive updates on equipment, training, and healthcare innovation. No further action is needed.</p>'
            + _company_signature_html(company_info)
            + _newsletter_unsubscribe_footer(unsub)
        ),
        eyebrow="Newsletter",
        company_info=company_info,
    )
    send_email([email], "You're already subscribed — Hampton Scientific", html_content)


def _newsletter_unsubscribe_footer(unsubscribe_url: str) -> str:
    return (
        f'<p style="margin:28px 0 0 0; padding-top:16px; border-top:1px solid {BORDER}; '
        f'font-size:12px; line-height:1.5; color:{MUTED}; text-align:center;">'
        "You’re receiving this because you subscribed to the Hampton Scientific newsletter.<br>"
        f'<a href="{e(unsubscribe_url)}" style="color:{MUTED}; text-decoration:underline;">Unsubscribe</a>'
        "</p>"
    )


def send_password_reset_email(email: str, reset_token: str, reset_url: str):
    """Send password reset email"""
    _ = reset_token
    company_info = _get_company_info_from_db()
    html_content = render_email(
        "Reset Your Password",
        (
            '<p style="margin:0 0 14px 0;">We received a request to reset your password. Click the button below to create a new one:</p>'
            + email_cta("Reset Password", reset_url)
            + email_highlight("This link expires in 1 hour for security. If you didn’t request a reset, you can ignore this email.", tone="amber")
            + f'<p style="margin:18px 0 0 0; font-size:12px; color:{MUTED};">If the button doesn’t work, copy this link:<br>'
            f'<a href="{e(reset_url)}" style="color:{GREEN}; word-break:break-all;">{e(reset_url)}</a></p>'
        ),
        eyebrow="Account security",
        company_info=company_info,
    )
    send_email([email], "Reset Your Password - Hampton Scientific", html_content)


def send_welcome_email(first_name: str, email: str):
    """Send welcome email after registration"""
    company_info = _get_company_info_from_db()
    products_url = f"{frontend_url.rstrip('/')}/products"
    html_content = render_email(
        "Welcome to Hampton Scientific",
        (
            f'<p style="margin:0 0 14px 0;">Dear {e(first_name_only(first_name))},</p>'
            '<p style="margin:0 0 8px 0;">Thank you for creating an account. You can now:</p>'
            f'<ul style="margin:0 0 8px 0; padding-left:20px; color:{MUTED};">'
            "<li>Request quotes for medical equipment</li>"
            "<li>Track your quote history</li>"
            "<li>Register for training programs</li>"
            "<li>Get personalized support</li>"
            "</ul>"
            + email_cta("Browse Products", products_url)
            + _company_signature_html(company_info)
        ),
        eyebrow="Welcome aboard",
        company_info=company_info,
    )
    send_email([email], "Welcome to Hampton Scientific!", html_content)


def send_quote_status_update_email(contact_person: str, email: str, facility_name: str, old_status: str, new_status: str, quote_id: str):
    """Send email notification when quote status changes"""
    company_info = _get_company_info_from_db()
    status_messages = {
        "quoted": ("Quote Ready", "Your official quotation has been prepared and is ready for review."),
        "invoiced": ("Invoice Created", "An invoice has been created for your quote."),
        "completed": ("Order Completed", "Your order has been completed successfully. Thank you for choosing Hampton Scientific!"),
        "cancelled": ("Quote Cancelled", "Your quote request has been cancelled. If you have any questions, please contact us."),
    }
    status_title, status_message = status_messages.get(
        new_status, ("Status Updated", f"Your quote status has been updated to {new_status}.")
    )
    tone = "red" if new_status == "cancelled" else "green"
    ref = (quote_id or "")[:8].upper()
    html_content = render_email(
        "Quote Status Update",
        (
            f'<p style="margin:0 0 14px 0;">Dear {e(first_name_only(contact_person))},</p>'
            + email_highlight(f"<strong>{e(status_title)}</strong><br>{e(status_message)}", tone=tone)
            + email_detail_card([
                ("Quote reference", e(ref)),
                ("Facility", e(facility_name)),
                ("Previous status", e((old_status or "").title())),
                ("New status", e((new_status or "").title())),
            ])
            + f'<p style="margin:0 0 8px 0;">If you have any questions, reply to this email or contact us anytime.</p>'
            + _company_signature_html(company_info)
        ),
        eyebrow=status_title,
        company_info=company_info,
    )
    send_email([email], f"Quote Status Update: {status_title} - Hampton Scientific", html_content)


def send_modified_quote_email(
    contact_person: str,
    email: str,
    facility_name: str,
    items: list,
    subtotal: float,
    discount: float,
    tax_rate: float,
    tax_amount: float,
    total: float,
    validity_days: int,
    notes: str = "",
    include_vat: bool = True,
    quote_id: Optional[str] = None,
    quote_number: Optional[str] = None,
):
    """Send quotation email (plain professional body + PDF attachment)."""
    from datetime import datetime as _dt

    company_info = _get_company_info_from_db()
    qid = quote_id or ""
    qref = quote_number or (qid[:8].upper() if qid else "")
    customer_name = contact_person or facility_name or "Customer"

    quote_data = {
        "id": qid,
        "quote_number": quote_number,
        "facility_name": facility_name,
        "contact_person": contact_person,
        "email": email,
        "items": items,
        "subtotal": subtotal,
        "discount_amount": discount,
        "tax_rate": tax_rate,
        "tax_amount": tax_amount,
        "total": total,
        "validity_days": validity_days,
        "notes": notes or "",
        "additional_notes": notes or "",
        "include_vat": include_vat,
        "created_at": _dt.utcnow(),
    }

    subject_ref = qref or (qid[:8].upper() if qid else "")
    subject = f"Quotation from Hampton Scientific Limited - {subject_ref}" if subject_ref else "Quotation from Hampton Scientific Limited"

    item_rows, _ = email_item_rows(items, show_prices=True)
    vat_label = f"VAT ({float(tax_rate or 0):g}%)" if include_vat else "VAT (excluded)"
    totals_rows = [
        ("Subtotal", f"KES {float(subtotal or 0):,.0f}"),
    ]
    if float(discount or 0) > 0:
        totals_rows.append(("Discount", f"- KES {float(discount):,.0f}"))
    if include_vat:
        totals_rows.append((vat_label, f"KES {float(tax_amount or 0):,.0f}"))

    body = (
        email_greeting(
            customer_name,
            "Your quotation is ready. Please find a summary below and the full PDF attached for your records.",
        )
        + email_status_row([
            ("Request received", "done"),
            ("Quote prepared", "done"),
            ("Your review", "current"),
        ])
        + email_section_title("Quote summary")
        + email_detail_card([
            ("Quote reference", e(subject_ref)),
            ("Facility", e(facility_name)),
            ("Validity", f"{int(validity_days)} days"),
            ("Items", str(len(items or []))),
        ])
        + email_section_title("Line items")
        + email_items_table(
            item_rows,
            footer_label="Total",
            footer_value=f"KES {float(total or 0):,.0f}",
        )
        + email_totals_block(
            totals_rows,
            total_label=f"Total ({len(items or [])} item{'s' if len(items or []) != 1 else ''})",
            total_value=f"KES {float(total or 0):,.0f}",
        )
        + email_info_grid([
            ("Facility", e(facility_name or "—")),
            ("Contact", f"{e(contact_person or '—')}<br>{mailto(email)}"),
            ("Next step", "Review the attached PDF and reply to accept or request changes."),
        ])
        + (email_section_title("Notes") + email_panel(e(notes)) if notes else "")
        + email_highlight("The attached PDF is the official quotation. Reply to this email to proceed with an order.")
        + _company_signature_html(company_info)
    )
    html = _wrap_document_email("Your Quotation", body, eyebrow="Quotation", company_info=company_info)

    async def _send():
        pdf_b64 = await generate_quote_pdf(quote_data, company_info, is_modified=True)
        filename_ref = subject_ref or "Quote"
        await send_email_async(
            [email],
            subject,
            html,
            attachments=[{"filename": f"Quote_{filename_ref}.pdf", "content": pdf_b64}],
        )

    _run_coro(_send())


def send_invoice_email(
    contact_person: str,
    email: str,
    facility_name: str,
    invoice_number: str,
    items: list,
    subtotal: float,
    discount: float,
    tax_rate: float,
    tax_amount: float,
    total: float,
    due_date: str,
    payment_terms: str,
    notes: str = "",
    pdf_attachment: Optional[List[dict]] = None,
    is_paid: bool = False,
    include_vat: bool = True,
):
    """Send invoice email (plain professional body + PDF attachment)."""
    # pdf_attachment is ignored; we always generate the current PDF to guarantee consistency.
    _ = pdf_attachment

    from datetime import datetime as _dt

    def _parse_iso(s: str):
        if not s:
            return None
        try:
            return _dt.fromisoformat(str(s).replace("Z", "+00:00"))
        except Exception:
            return None

    company_info = _get_company_info_from_db()
    customer_name = contact_person or facility_name or "Customer"
    invoice_data = {
        "invoice_number": invoice_number,
        "facility_name": facility_name,
        "contact_person": contact_person,
        "email": email,
        "items": items,
        "subtotal": subtotal,
        "discount_amount": discount,
        "tax_rate": tax_rate,
        "tax_amount": tax_amount,
        "total": total,
        "due_date": _parse_iso(due_date),
        "payment_terms": payment_terms,
        "notes": notes or "",
        "include_vat": include_vat,
        "created_at": _dt.utcnow(),
    }

    subject = f"Invoice from Hampton Scientific Limited - {invoice_number}"
    item_rows, _ = email_item_rows(items, show_prices=True)
    due_display = e(due_date) if due_date else "See attached PDF"
    # Format ISO-ish due dates more nicely when possible
    parsed_due = _parse_iso(due_date)
    if parsed_due:
        try:
            due_display = parsed_due.strftime("%d %B %Y")
        except Exception:
            due_display = e(due_date)

    totals_rows = [("Subtotal", f"KES {float(subtotal or 0):,.0f}")]
    if float(discount or 0) > 0:
        totals_rows.append(("Discount", f"- KES {float(discount):,.0f}"))
    if include_vat:
        totals_rows.append((f"VAT ({float(tax_rate or 0):g}%)", f"KES {float(tax_amount or 0):,.0f}"))

    status_steps = [
        ("Invoice issued", "done"),
        ("Awaiting payment", "current" if not is_paid else "done"),
        ("Paid", "done" if is_paid else "todo"),
    ]

    body = (
        email_greeting(
            customer_name,
            "Please find your invoice summary below. The official PDF is attached for payment and your records.",
        )
        + email_status_row(status_steps)
        + email_section_title("Invoice summary")
        + email_detail_card([
            ("Invoice number", e(invoice_number)),
            ("Facility", e(facility_name)),
            ("Amount due", f"KES {float(total or 0):,.0f}"),
            ("Due date", due_display),
            ("Payment terms", e(payment_terms or "Net 14")),
        ])
        + email_section_title("Line items")
        + email_items_table(
            item_rows,
            footer_label="Total",
            footer_value=f"KES {float(total or 0):,.0f}",
        )
        + email_totals_block(
            totals_rows,
            total_label=f"Total ({len(items or [])} item{'s' if len(items or []) != 1 else ''})",
            total_value=f"KES {float(total or 0):,.0f}",
        )
        + email_info_grid([
            ("Bill to", f"{e(facility_name or '—')}<br>{e(contact_person or '')}"),
            ("Due date", due_display),
            ("Payment", "See bank &amp; M-Pesa details on the attached PDF."),
        ])
        + (email_section_title("Notes") + email_panel(e(notes)) if notes else "")
        + email_highlight(
            'Kindly refer to the <strong>Payment Information</strong> section on the attached PDF. '
            "Please let us know once payment has been processed so we can update your records."
        )
        + _company_signature_html(company_info)
    )
    html = _wrap_document_email("Your Invoice", body, eyebrow="Invoice", company_info=company_info)

    async def _send():
        pdf_b64 = await generate_invoice_pdf(invoice_data, company_info, is_paid=is_paid)
        await send_email_async(
            [email],
            subject,
            html,
            attachments=[{"filename": f"Invoice_{invoice_number}.pdf", "content": pdf_b64}],
        )

    _run_coro(_send())


def send_user_created_by_admin_email(first_name: str, email: str, temp_password: str, can_login: bool, facility_name: str):
    """Send email to user created by admin"""
    company_info = _get_company_info_from_db()
    login_url = f"{frontend_url.rstrip('/')}/login"
    if can_login:
        html_content = render_email(
            "Your Account Has Been Created",
            (
                f'<p style="margin:0 0 14px 0;">Dear {e(first_name_only(first_name))},</p>'
                '<p style="margin:0 0 14px 0;">An account has been created for you at Hampton Scientific. You can now access our portal to view quotes, place orders, and manage your profile.</p>'
                + email_detail_card([
                    ("Facility", e(facility_name)),
                    ("Email", mailto(email)),
                    ("Temporary password", f'<code style="background:#e8e4df; padding:2px 8px; border-radius:4px; font-size:13px;">{e(temp_password)}</code>'),
                ])
                + email_highlight("Please change your password after your first login for security.", tone="amber")
                + email_cta("Log in to your account", login_url)
                + _company_signature_html(company_info)
            ),
            eyebrow="Portal access",
            company_info=company_info,
        )
        send_email([email], "Your Hampton Scientific Account Has Been Created", html_content)
    else:
        phone = e(company_info.get("phone") or "")
        support_email = (company_info.get("email") or DEFAULT_COMPANY_EMAIL).strip()
        html_content = render_email(
            "Welcome to Hampton Scientific",
            (
                f'<p style="margin:0 0 14px 0;">Dear {e(first_name_only(first_name))},</p>'
                f'<p style="margin:0 0 14px 0;">Your facility <strong style="color:{INK};">{e(facility_name)}</strong> has been registered with Hampton Scientific.</p>'
                '<p style="margin:0 0 14px 0;">Our team will be in touch soon to discuss your medical equipment needs and provide personalized support.</p>'
                + email_detail_card([
                    ("Phone", phone),
                    ("Email", mailto(support_email)),
                ])
                + _company_signature_html(company_info)
            ),
            eyebrow="Facility registered",
            company_info=company_info,
        )
        send_email([email], "Welcome to Hampton Scientific", html_content)


def send_quote_followup_email(contact_person: str, email: str, facility_name: str, quote_id: str, items: list, custom_message: str = None):
    """Send follow-up email for a quoted price request"""
    company_info = _get_company_info_from_db()
    items_html = ""
    total = 0
    for item in items:
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
    ref = (quote_id or "")[:8].upper()
    html_content = render_email(
        "Quote Follow-Up",
        (
            f'<p style="margin:0 0 14px 0;">Dear {e(first_name_only(contact_person or facility_name))},</p>'
            f'<p style="margin:0 0 14px 0;">{e(message)}</p>'
            + email_detail_card([
                ("Quote reference", e(ref)),
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
    send_email([email], f"Quote Follow-Up - Hampton Scientific (Ref: {ref})", html_content)


def send_invoice_reminder_email(contact_person: str, email: str, facility_name: str, invoice_number: str, total: float, due_date: str, is_overdue: bool = False):
    """Send invoice payment reminder email"""
    company_info = _get_company_info_from_db()
    subject_line = "Invoice Overdue — Action Required" if is_overdue else "Invoice Reminder"
    intro = (
        "<strong>This invoice is now overdue.</strong> Please arrange payment as soon as possible."
        if is_overdue
        else "This is a friendly reminder about your upcoming invoice payment."
    )
    payment_rows = []
    if company_info.get("bank_name"):
        payment_rows.append(("Bank", e(company_info.get("bank_name"))))
    if company_info.get("bank_account_name"):
        payment_rows.append(("Account name", e(company_info.get("bank_account_name"))))
    if company_info.get("bank_account_number"):
        payment_rows.append(("Account number", e(company_info.get("bank_account_number"))))
    if company_info.get("mpesa_paybill"):
        payment_rows.append(("M-Pesa Paybill", e(company_info.get("mpesa_paybill"))))
    if company_info.get("mpesa_account_number"):
        payment_rows.append(("M-Pesa account", e(company_info.get("mpesa_account_number"))))

    html_content = render_email(
        subject_line,
        (
            f'<p style="margin:0 0 14px 0;">Dear {e(first_name_only(contact_person or facility_name))},</p>'
            + email_highlight(intro, tone="red" if is_overdue else "amber")
            + email_detail_card([
                ("Invoice number", e(invoice_number)),
                ("Amount due", f"KES {float(total or 0):,.0f}"),
                ("Due date", e(due_date)),
                ("Facility", e(facility_name)),
            ], accent="#c4704a" if is_overdue else GREEN)
            + (email_detail_card(payment_rows) if payment_rows else "")
            + '<p style="margin:0 0 8px 0;">If you have already made this payment, please disregard this reminder.</p>'
            + _company_signature_html(company_info)
        ),
        eyebrow="Payment reminder",
        company_info=company_info,
    )
    send_email([email], f"{subject_line} - {invoice_number} - Hampton Scientific", html_content)


def send_invoice_reminder_email_from_template(invoice: dict, *, is_overdue: bool = False) -> None:
    """Reminder email with modern shell + invoice PDF attachment."""
    contact_person = invoice.get("contact_person", "")
    email = invoice.get("email", "")
    facility_name = invoice.get("facility_name", "")
    invoice_number = invoice.get("invoice_number", "")
    include_vat = bool(invoice.get("include_vat", True))
    total = invoice.get("total", 0) or 0

    from utils.app_time import format_app
    due_date = invoice.get("due_date")
    due_date_str = format_app(due_date, "%B %d, %Y", default="N/A") if due_date else "N/A"

    subject_prefix = "Overdue Reminder - " if is_overdue else "Invoice Reminder - "
    subject_vat = "" if include_vat else "Exclusive VAT - "
    subject = f"{subject_prefix}{subject_vat}{invoice_number} - Hampton Scientific"

    company_info = _get_company_info_from_db()
    subject_line = "Invoice Overdue — Action Required" if is_overdue else "Invoice Reminder"
    intro = (
        "<strong>This invoice is now overdue.</strong> Please arrange payment as soon as possible."
        if is_overdue
        else "This is a friendly reminder about your upcoming invoice payment. The invoice PDF is attached for your records."
    )
    html = render_email(
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

    async def _send():
        pdf_b64 = await generate_invoice_pdf(invoice, company_info, is_paid=False)
        await send_email_async(
            [email],
            subject,
            html,
            attachments=[{"filename": f"Invoice_{invoice_number}.pdf", "content": pdf_b64}],
        )

    _run_coro(_send())

