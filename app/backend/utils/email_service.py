import os
import asyncio
import logging
import resend
import base64
from typing import List, Optional
from pathlib import Path

from env_loader import load_app_env
from .constants import COMPANY_LOGO
from jinja2 import Environment, FileSystemLoader, select_autoescape

from db.session import SessionLocal
from db.models import SiteSettings
from utils.document_context import build_invoice_context, build_quote_context
from utils.pdf import generate_invoice_pdf, generate_quote_pdf


load_app_env()

logger = logging.getLogger(__name__)
frontend_url = os.environ['FRONTEND_URL'] 

# Module-level company info cache (set from server.py)
_company_info = {}

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
    name = company_info.get("company_name") or "Hampton Scientific Limited"
    phone = company_info.get("phone") or ""
    website = (company_info.get("website") or "").strip()
    address = (company_info.get("address") or "").strip()
    location = address or "Nairobi, Kenya"
    web_line = f"Web: {website}" if website else "Web: www.hamptonscientific.com"
    phone_line = f"Phone: {phone}" if phone else "Phone: 0742 687 661"
    return (
        f"<p style=\"margin:0;\"><strong>{name}</strong><br>"
        f"{location}<br>"
        f"{phone_line}<br>"
        f"{web_line}</p>"
    )


def _wrap_plain_email(body_html: str) -> str:
    # Keep it extremely compatible across clients (Gmail, mobile).
    return (
        "<div style=\"font-family: Arial, sans-serif; font-size: 14px; color:#111;\">"
        f"{body_html}"
        "</div>"
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

# Resend configuration
RESEND_API_KEY = os.environ["RESEND_API_KEY"] if "RESEND_API_KEY" in os.environ else ""
SENDER_EMAIL = os.environ["SENDER_EMAIL"] if "SENDER_EMAIL" in os.environ else "onboarding@resend.dev"
ADMIN_EMAIL = os.environ["ADMIN_EMAIL"] if "ADMIN_EMAIL" in os.environ else "info@hamptonscientific.com"

# Initialize Resend
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY
    logger.info("Resend API initialized")
else:
    logger.warning("RESEND_API_KEY not configured - emails will be logged only")


async def send_email_async(to_emails: List[str], subject: str, html_content: str, attachments: Optional[List[dict]] = None) -> dict:
    """
    Send email using Resend API (async, non-blocking)
    attachments: List of dicts with 'filename' and 'content' (base64 encoded)
    """
    if not RESEND_API_KEY:
        logger.info(f"[MOCK EMAIL] To: {to_emails}, Subject: {subject}")
        return {"status": "mocked", "message": "Email logged (no API key configured)"}
    
    params = {
        "from": SENDER_EMAIL,
        "to": to_emails,
        "subject": subject,
        "html": html_content
    }
    
    if attachments:
        params["attachments"] = attachments
    
    try:
        # Run sync SDK in thread to keep FastAPI non-blocking
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent successfully to {to_emails}")
        return {"status": "success", "email_id": result.get("id")}
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        return {"status": "error", "error": str(e)}


def send_email(to_emails: List[str], subject: str, html_content: str, attachments: Optional[List[dict]] = None) -> bool:
    """
    Synchronous email sending (for backwards compatibility)
    """
    if not RESEND_API_KEY:
        logger.info(f"[MOCK EMAIL] To: {to_emails}, Subject: {subject}")
        return True
    
    params = {
        "from": SENDER_EMAIL,
        "to": to_emails,
        "subject": subject,
        "html": html_content
    }
    
    if attachments:
        params["attachments"] = attachments
    
    try:
        resend.Emails.send(params)
        logger.info(f"Email sent successfully to {to_emails}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        return False


# Email Templates - accept dynamic company info
def get_email_header(company_info=None):
    ci = company_info or _company_info or {}
    name = ci.get("company_name", "Hampton Scientific Limited")
    return f"""
    <div style="background: linear-gradient(135deg, #006332 0%, #00a550 100%); padding: 30px 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-family: 'Space Grotesk', sans-serif;">{name}</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 16px;">Medical Supplier &amp; Trainer</p>
    
    </div>
    """
# <img src="{COMPANY_LOGO}/hampton-logo.svg" alt="{name}" style="height: 50px; margin-bottom: 10px; filter: brightness(0) invert(1);" />

def get_email_footer(company_info=None):
    ci = company_info or _company_info or {}
    name = ci.get("company_name", "Hampton Scientific Limited")
    address = ci.get("address", "")
    po_box = ci.get("po_box", "")
    phone = ci.get("phone", "")
    email = ci.get("email", "")
    addr_line = f"{address}<br>{po_box}" if address and po_box else (address or po_box)
    contact_parts = []
    if phone: contact_parts.append(f"Phone: {phone}")
    if email: contact_parts.append(f"Email: {email}")
    contact_line = " | ".join(contact_parts)
    return f"""
    <div style="background-color: #f8f9fa; padding: 25px 20px; text-align: center; border-top: 1px solid #e9ecef;">
        <p style="color: #555; font-size: 14px; margin: 0 0 8px 0; font-weight: 600;">{name}</p>
        {f'<p style="color: #666; font-size: 13px; margin: 0 0 8px 0; line-height: 1.6;">{addr_line}</p>' if addr_line else ''}
        {f'<p style="color: #666; font-size: 13px; margin: 0 0 12px 0;">{contact_line}</p>' if contact_line else ''}
    </div>
    """


def send_contact_inquiry_email(name: str, email: str, phone: str, subject: str, message: str):
    """Send notification email for contact inquiry"""
    admin_html = f"""
    <html>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                {get_email_header()}
                <div style="padding: 30px;">
                    <h2 style="color: #006332; margin-top: 0;">New Contact Inquiry</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #006332;">
                        <p style="margin: 8px 0;"><strong>Name:</strong> {name}</p>
                        <p style="margin: 8px 0;"><strong>Email:</strong> <a href="mailto:{email}" style="color: #006332;">{email}</a></p>
                        <p style="margin: 8px 0;"><strong>Phone:</strong> {phone}</p>
                        <p style="margin: 8px 0;"><strong>Subject:</strong> {subject}</p>
                    </div>
                    <h3 style="color: #333;">Message:</h3>
                    <div style="background-color: #fff; padding: 15px; border: 1px solid #e9ecef; border-radius: 8px;">
                        <p style="margin: 0; white-space: pre-wrap;">{message}</p>
                    </div>
                </div>
                {get_email_footer()}
            </div>
        </body>
    </html>
    """
    send_email([ADMIN_EMAIL], f"New Contact Inquiry: {subject}", admin_html)
    
    # User confirmation
    user_html = f"""
    <html>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                {get_email_header()}
                <div style="padding: 30px;">
                    <h2 style="color: #006332; margin-top: 0;">Thank You for Contacting Us</h2>
                    <p>Dear {name},</p>
                    <p>Thank you for reaching out to Hampton Scientific. We have received your inquiry and our team will respond within 24 hours.</p>
                    <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0; color: #2e7d32;"><strong>Reference:</strong> Your message about "{subject}"</p>
                    </div>
                    <p>Best regards,<br><strong>Hampton Scientific Team</strong></p>
                </div>
                {get_email_footer()}
            </div>
        </body>
    </html>
    """
    send_email([email], "We've Received Your Inquiry - Hampton Scientific", user_html)


def send_quote_request_email(facility_name: str, contact_person: str, email: str, phone: str, items: list):
    """Send notification email for quote request"""
    items_html = ""
    total_value = 0
    for item in items:
        unit_price = item.get('unit_price', 0) or 0
        quantity = item.get('quantity', 1)
        subtotal = unit_price * quantity
        total_value += subtotal
        items_html += f"""
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef;">{item['product_name']}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef; text-align: center;">{quantity}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef; text-align: right;">KES {unit_price:,.0f}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef; text-align: right; font-weight: bold;">KES {subtotal:,.0f}</td>
        </tr>
        """
    
    admin_html = f"""
    <html>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
            <div style="max-width: 700px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                {get_email_header()}
                <div style="padding: 30px;">
                    <h2 style="color: #006332; margin-top: 0;">New Quote Request</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #006332;">
                        <p style="margin: 8px 0;"><strong>Facility:</strong> {facility_name}</p>
                        <p style="margin: 8px 0;"><strong>Contact:</strong> {contact_person}</p>
                        <p style="margin: 8px 0;"><strong>Email:</strong> <a href="mailto:{email}" style="color: #006332;">{email}</a></p>
                        <p style="margin: 8px 0;"><strong>Phone:</strong> {phone}</p>
                    </div>
                    <h3 style="color: #333;">Requested Items ({len(items)}):</h3>
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                        <thead>
                            <tr style="background: linear-gradient(135deg, #006332 0%, #00a550 100%);">
                                <th style="padding: 12px; text-align: left; color: white;">Product</th>
                                <th style="padding: 12px; text-align: center; color: white;">Qty</th>
                                <th style="padding: 12px; text-align: right; color: white;">Unit Price</th>
                                <th style="padding: 12px; text-align: right; color: white;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items_html}
                        </tbody>
                        <tfoot>
                            <tr style="background-color: #f8f9fa;">
                                <td colspan="3" style="padding: 15px; text-align: right; font-weight: bold;">Estimated Total:</td>
                                <td style="padding: 15px; text-align: right; font-weight: bold; color: #006332; font-size: 18px;">KES {total_value:,.0f}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                {get_email_footer()}
            </div>
        </body>
    </html>
    """
    send_email([ADMIN_EMAIL], f"New Quote Request from {facility_name}", admin_html)
    
    # User confirmation - NO pricing shown
    user_html = f"""
    <html>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.8; color: #333; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                {get_email_header()}
                <div style="padding: 30px;">
                    <h2 style="color: #006332; margin-top: 0; font-size: 22px;">Quote Request Received!</h2>
                    <p style="font-size: 16px;">Dear {contact_person},</p>
                    <p style="font-size: 16px;">Thank you for your quote request. We have received your request for <strong>{len(items)} item(s)</strong> and will send you a detailed quotation within 24-48 hours.</p>
                    <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                        <p style="margin: 0; font-size: 18px; color: #2e7d32;"><strong>Your request is being reviewed</strong></p>
                        <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">You will receive a detailed quotation with pricing shortly</p>
                    </div>
                    <p style="font-size: 16px;">If you have any urgent queries, please contact us at <strong>{_company_info.get('phone', '')}</strong>.</p>
                    <p style="font-size: 16px;">Best regards,<br><strong>{_company_info.get('company_name', 'Hampton Scientific')} Team</strong></p>
                </div>
                {get_email_footer()}
            </div>
        </body>
    </html>
    """
    send_email([email], "Quote Request Received - Hampton Scientific", user_html)


def send_training_registration_email(facility_name: str, contact_person: str, email: str, phone: str, training_type: str, message: str = ""):
    """Send notification email for training registration"""
    admin_html = f"""
    <html>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                {get_email_header()}
                <div style="padding: 30px;">
                    <h2 style="color: #006332; margin-top: 0;">New Training Registration</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #006332;">
                        <p style="margin: 8px 0;"><strong>Facility:</strong> {facility_name}</p>
                        <p style="margin: 8px 0;"><strong>Contact:</strong> {contact_person}</p>
                        <p style="margin: 8px 0;"><strong>Email:</strong> <a href="mailto:{email}" style="color: #006332;">{email}</a></p>
                        <p style="margin: 8px 0;"><strong>Phone:</strong> {phone}</p>
                        <p style="margin: 8px 0;"><strong>Training Type:</strong> {training_type}</p>
                    </div>
                    {f'<div style="margin-top: 20px;"><h3>Additional Notes:</h3><p>{message}</p></div>' if message else ''}
                </div>
                {get_email_footer()}
            </div>
        </body>
    </html>
    """
    send_email([ADMIN_EMAIL], f"New Training Registration: {training_type}", admin_html)
    
    user_html = f"""
    <html>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                {get_email_header()}
                <div style="padding: 30px;">
                    <h2 style="color: #006332; margin-top: 0;">Training Registration Confirmed!</h2>
                    <p>Dear {contact_person},</p>
                    <p>Thank you for registering for our training program. We will contact you shortly to schedule your training session.</p>
                    <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                        <p style="margin: 0; font-size: 16px; color: #2e7d32;"><strong>{training_type}</strong></p>
                    </div>
                    <p>Best regards,<br><strong>Hampton Scientific Team</strong></p>
                </div>
                {get_email_footer()}
            </div>
        </body>
    </html>
    """
    send_email([email], "Training Registration Confirmed - Hampton Scientific", user_html)


def send_newsletter_welcome_email(email: str):
    """Send welcome email for newsletter subscription"""
    html_content = f"""
    <html>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                {get_email_header()}
                <div style="padding: 30px;">
                    <h2 style="color: #006332; margin-top: 0;">Welcome to Our Newsletter!</h2>
                    <p>Thank you for subscribing to the Hampton Scientific newsletter.</p>
                    <p>You'll now receive updates about:</p>
                    <ul style="padding-left: 20px;">
                        <li>New medical equipment and supplies</li>
                        <li>Training programs and workshops</li>
                        <li>Industry news and innovations</li>
                        <li>Special offers and promotions</li>
                    </ul>
                    <p>Best regards,<br><strong>Hampton Scientific Team</strong></p>
                </div>
                {get_email_footer()}
            </div>
        </body>
    </html>
    """
    send_email([email], "Welcome to Hampton Scientific Newsletter", html_content)


def send_password_reset_email(email: str, reset_token: str, reset_url: str):
    """Send password reset email"""
    html_content = f"""
    <html>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                {get_email_header()}
                <div style="padding: 30px;">
                    <h2 style="color: #006332; margin-top: 0;">Reset Your Password</h2>
                    <p>We received a request to reset your password. Click the button below to create a new password:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{reset_url}" style="background: linear-gradient(135deg, #006332 0%, #00a550 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
                    </div>
                    <p style="color: #666; font-size: 14px;">This link will expire in 1 hour for security reasons.</p>
                    <p style="color: #666; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email.</p>
                    <hr style="border: none; border-top: 1px solid #e9ecef; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px;">If the button doesn't work, copy and paste this link into your browser:<br><a href="{reset_url}" style="color: #006332; word-break: break-all;">{reset_url}</a></p>
                </div>
                {get_email_footer()}
            </div>
        </body>
    </html>
    """
    send_email([email], "Reset Your Password - Hampton Scientific", html_content)


def send_welcome_email(first_name: str, email: str):
    """Send welcome email after registration"""
    html_content = f"""
    <html>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                {get_email_header()}
                <div style="padding: 30px;">
                    <h2 style="color: #006332; margin-top: 0;">Welcome to Hampton Scientific!</h2>
                    <p>Dear {first_name},</p>
                    <p>Thank you for creating an account with Hampton Scientific. You can now:</p>
                    <ul style="padding-left: 20px;">
                        <li>Request quotes for medical equipment</li>
                        <li>Track your quote history</li>
                        <li>Register for training programs</li>
                        <li>Get personalized support</li>
                    </ul>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="https://hamptonscientific.com/products" style="background: linear-gradient(135deg, #006332 0%, #00a550 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Browse Products</a>
                    </div>
                    <p>Best regards,<br><strong>Hampton Scientific Team</strong></p>
                </div>
                {get_email_footer()}
            </div>
        </body>
    </html>
    """
    send_email([email], "Welcome to Hampton Scientific!", html_content)


def send_quote_status_update_email(contact_person: str, email: str, facility_name: str, old_status: str, new_status: str, quote_id: str):
    """Send email notification when quote status changes"""
    status_messages = {
        "quoted": ("Quote Ready", "Your official quotation has been prepared and is ready for review."),
        "invoiced": ("Invoice Created", "An invoice has been created for your quote."),
        "completed": ("Order Completed", "Your order has been completed successfully. Thank you for choosing Hampton Scientific!"),
        "cancelled": ("Quote Cancelled", "Your quote request has been cancelled. If you have any questions, please contact us.")
    }
    
    status_title, status_message = status_messages.get(new_status, ("Status Updated", f"Your quote status has been updated to {new_status}."))
    
    status_color = {
        "quoted": "#3b82f6",
        "invoiced": "#22c55e",
        "completed": "#22c55e",
        "cancelled": "#ef4444"
    }.get(new_status, "#6b7280")
    
    html_content = f"""
    <html>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                {get_email_header()}
                <div style="padding: 30px;">
                    <h2 style="color: #006332; margin-top: 0;">Quote Status Update</h2>
                    <p>Dear {contact_person},</p>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid {status_color};">
                        <p style="margin: 0 0 10px 0; font-size: 18px; font-weight: bold; color: {status_color};">{status_title}</p>
                        <p style="margin: 0; color: #666;">{status_message}</p>
                    </div>
                    
                    <div style="background-color: #fff; padding: 15px; border: 1px solid #e9ecef; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Quote Reference:</strong> {quote_id[:8].upper()}</p>
                        <p style="margin: 5px 0;"><strong>Facility:</strong> {facility_name}</p>
                        <p style="margin: 5px 0;"><strong>Previous Status:</strong> {old_status.title()}</p>
                        <p style="margin: 5px 0;"><strong>New Status:</strong> <span style="color: {status_color}; font-weight: bold;">{new_status.title()}</span></p>
                    </div>
                    
                    <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
                    
                    <p>Best regards,<br><strong>Hampton Scientific Team</strong></p>
                </div>
                {get_email_footer()}
            </div>
        </body>
    </html>
    """
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

    body = (
        f"<p>Dear {customer_name},</p>"
        "<p>Please find the attached quotation as per your recent request.</p>"
        "<p>Thank you for choosing Hampton Scientific Limited as your trusted medical supplier and trainer. "
        "We are committed to providing you with high-quality medical equipment and professional training services to support your operations.</p>"
        f"<p>This quotation is valid for {int(validity_days)} days. Should you have any questions or wish to proceed with an order, please feel free to contact us.</p>"
        "<p>Best regards,</p>"
        f"{_company_signature_html(company_info)}"
    )
    html = _wrap_plain_email(body)

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
    body = (
        f"<p>Dear {customer_name},</p>"
        "<p>Please find the attached invoice regarding your recent order/service.</p>"
        "<p>Thank you for choosing Hampton Scientific Limited as your trusted medical supplier and trainer. "
        "We appreciate your partnership and remain dedicated to delivering excellence in both our medical supplies and our specialized training programs.</p>"
        "<p>Kindly refer to the \"Payment Information\" section on the attached document for our bank and M-Pesa details. "
        "Please let us know once the payment has been processed so we can update your records.</p>"
        "<p>Best regards,</p>"
        f"{_company_signature_html(company_info)}"
    )
    html = _wrap_plain_email(body)

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
    if can_login:
        html_content = f"""
        <html>
            <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
                <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    {get_email_header()}
                    <div style="padding: 30px;">
                        <h2 style="color: #006332; margin-top: 0;">Your Account Has Been Created</h2>
                        <p>Dear {first_name},</p>
                        <p>An account has been created for you at Hampton Scientific. You can now access our portal to view quotes, place orders, and manage your profile.</p>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #006332;">
                            <p style="margin: 8px 0;"><strong>Facility:</strong> {facility_name}</p>
                            <p style="margin: 8px 0;"><strong>Email:</strong> {email}</p>
                            <p style="margin: 8px 0;"><strong>Temporary Password:</strong> <code style="background: #e9ecef; padding: 2px 8px; border-radius: 4px;">{temp_password}</code></p>
                        </div>
                        
                        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 0; color: #92400e;">⚠️ Please change your password after your first login for security.</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="https://hamptonscientific.com/login" style="background: linear-gradient(135deg, #006332 0%, #00a550 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Login to Your Account</a>
                        </div>
                        
                        <p>Best regards,<br><strong>Hampton Scientific Team</strong></p>
                    </div>
                    {get_email_footer()}
                </div>
            </body>
        </html>
        """
        send_email([email], "Your Hampton Scientific Account Has Been Created", html_content)
    else:
        html_content = f"""
        <html>
            <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
                <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    {get_email_header()}
                    <div style="padding: 30px;">
                        <h2 style="color: #006332; margin-top: 0;">Welcome to Hampton Scientific</h2>
                        <p>Dear {first_name},</p>
                        <p>Your facility <strong>{facility_name}</strong> has been registered with Hampton Scientific.</p>
                        <p>Our team will be in touch with you soon to discuss your medical equipment needs and provide personalized support.</p>
                        <p>If you need immediate assistance, please contact us at:</p>
                        <ul style="padding-left: 20px;">
                            <li>Phone: 0717 023 814</li>
                            <li>Email: info@hamptonscientific.com</li>
                        </ul>
                        <p>Best regards,<br><strong>Hampton Scientific Team</strong></p>
                    </div>
                    {get_email_footer()}
                </div>
            </body>
        </html>
        """
        send_email([email], "Welcome to Hampton Scientific", html_content)


def send_quote_followup_email(contact_person: str, email: str, facility_name: str, quote_id: str, items: list, custom_message: str = None):
    """Send follow-up email for a quoted price request"""
    items_html = ""
    total = 0
    for item in items:
        price = item.get("unit_price", 0) or 0
        qty = item.get("quantity", 1)
        line_total = price * qty
        total += line_total
        items_html += f"""
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">{item.get('product_name', '')}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: center;">{qty}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: right;">KES {price:,.0f}</td>
        </tr>
        """
    
    message = custom_message or "We wanted to follow up on the quotation we sent you. Please review the items below and let us know if you have any questions or would like to proceed with your order."
    
    html_content = f"""
    <html>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                {get_email_header()}
                <div style="padding: 30px;">
                    <h2 style="color: #006332; margin-top: 0;">Quote Follow-Up</h2>
                    <p>Dear {contact_person or facility_name},</p>
                    <p>{message}</p>
                    
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Quote Reference:</strong> {quote_id[:8].upper()}</p>
                        <p style="margin: 5px 0;"><strong>Facility:</strong> {facility_name}</p>
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
                    <p>Best regards,<br><strong>Hampton Scientific Team</strong></p>
                </div>
                {get_email_footer()}
            </div>
        </body>
    </html>
    """
    send_email([email], f"Quote Follow-Up - Hampton Scientific (Ref: {quote_id[:8].upper()})", html_content)


def send_invoice_reminder_email(contact_person: str, email: str, facility_name: str, invoice_number: str, total: float, due_date: str, is_overdue: bool = False):
    """Send invoice payment reminder email"""
    subject_line = "Invoice Overdue - Action Required" if is_overdue else "Invoice Reminder"
    
    html_content = f"""
    <html>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                {get_email_header()}
                <div style="padding: 30px;">
                    <h2 style="color: #333; margin-top: 0;">{subject_line}</h2>
                    <p>Dear {contact_person or facility_name},</p>
                    
                    {"<p style='color: #333;'><strong>This invoice is now overdue. Please arrange payment as soon as possible.</strong></p>" if is_overdue else "<p>This is a friendly reminder about your upcoming invoice payment.</p>"}
                    
                    <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #333;">
                        <p style="margin: 5px 0;"><strong>Invoice Number:</strong> {invoice_number}</p>
                        <p style="margin: 5px 0;"><strong>Amount Due:</strong> <span style="font-size: 1.2em; color: #006332;">KES {total:,.0f}</span></p>
                        <p style="margin: 5px 0;"><strong>Due Date:</strong> <span style="color: #333; font-weight: bold;">{due_date}</span></p>
                    </div>
                    
                    <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <h4 style="margin: 0 0 10px 0; color: #006332;">Payment Information</h4>
                        <p style="margin: 5px 0;"><strong>Bank:</strong> Kenya Commercial Bank</p>
                        <p style="margin: 5px 0;"><strong>Account Name:</strong> Hampton Scientific Limited</p>
                        <p style="margin: 5px 0;"><strong>Account Number:</strong> 1234567890</p>
                    </div>
                    
                    <p>If you have already made this payment, please disregard this reminder.</p>
                    <p>Best regards,<br><strong>Hampton Scientific Team</strong></p>
                </div>
                {get_email_footer()}
            </div>
        </body>
    </html>
    """
    send_email([email], f"{subject_line} - {invoice_number} - Hampton Scientific", html_content)


def send_invoice_reminder_email_from_template(invoice: dict, *, is_overdue: bool = False) -> None:
    """
    Reminder email that renders using `invoice_template.html` and attaches the invoice PDF,
    so reminder content stays consistent with the invoice PDF.
    """
    contact_person = invoice.get("contact_person", "")
    email = invoice.get("email", "")
    invoice_number = invoice.get("invoice_number", "")
    include_vat = bool(invoice.get("include_vat", True))

    subject_prefix = "Overdue Reminder - " if is_overdue else "Invoice Reminder - "
    subject_vat = "" if include_vat else "Exclusive VAT - "
    subject = f"{subject_prefix}{subject_vat}{invoice_number} - Hampton Scientific"

    company_info = _get_company_info_from_db()

    context = build_invoice_context(
        invoice,
        company_info,
        is_paid=False,
        logo_data="",
        paid_stamp_data="",
    )

    async def _send():
        pdf_b64 = await generate_invoice_pdf(invoice, company_info, is_paid=False)
        await _send_document_email(
            to_email=email,
            subject=subject,
            template_name="invoice_template.html",
            context=context,
            pdf_filename=f"Invoice_{invoice_number}.pdf",
            pdf_base64=pdf_b64,
        )

    _run_coro(_send())

