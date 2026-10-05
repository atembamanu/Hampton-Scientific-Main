"""
Smoke-verify all outbound email templates + PDF attachment generation.

Usage (inside backend container):
  python scripts/verify_email_templates.py
  python scripts/verify_email_templates.py --send
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import sys
from datetime import datetime, timedelta

from utils.email_layout import GREEN_LIGHT, render_email
from utils.email_service import (
    _get_company_info_from_db,
    _smtp_configured,
    send_contact_inquiry_email,
    send_email_async,
    send_invoice_email,
    send_invoice_reminder_email,
    send_invoice_reminder_email_from_template,
    send_modified_quote_email,
    send_newsletter_welcome_email,
    send_password_reset_email,
    send_quote_followup_email,
    send_quote_request_email,
    send_quote_status_update_email,
    send_training_registration_email,
    send_user_created_by_admin_email,
    send_welcome_email,
)
from utils.pdf import generate_invoice_pdf, generate_quote_pdf


REQUIRED_MARKERS = (
    "Hampton Scientific Limited",
    GREEN_LIGHT,
    "Medical supplier",
)
FORBIDDEN_MARKERS = (
    "box-shadow:0 12px 40px",
    "linear-gradient(135deg, #006332",
)


def _assert_shell(html: str, label: str) -> None:
    for marker in REQUIRED_MARKERS:
        if marker not in html:
            raise AssertionError(f"{label}: missing shell marker {marker!r}")
    # Copper must not be the secondary header strip — strip uses GREEN_LIGHT.
    if f'background:{GREEN_LIGHT}' not in html and f'background: {GREEN_LIGHT}' not in html:
        # render uses f-string without space
        if f"background:{GREEN_LIGHT}" not in html:
            raise AssertionError(f"{label}: secondary strip is not light green")
    for bad in FORBIDDEN_MARKERS:
        if bad in html:
            raise AssertionError(f"{label}: forbidden style still present: {bad}")
    if "box-shadow:0 12px 40px" in html:
        raise AssertionError(f"{label}: card box-shadow still present")


def _check_render_helpers() -> None:
    html = render_email(
        "Shell Check",
        "<p>Body</p>",
        eyebrow="Verification",
        company_info={"company_name": "Hampton Scientific Limited", "email": "info@hamptonscientific.com"},
    )
    _assert_shell(html, "render_email")
    print("OK  shared shell")


async def _check_pdfs() -> tuple[str, str]:
    company = _get_company_info_from_db()
    items = [
        {
            "product_name": "Verification Item",
            "quantity": 2,
            "unit_price": 1500,
            "original_price": 1500,
            "modified_price": 1500,
        }
    ]
    quote_data = {
        "id": "verify-quote-001",
        "quote_number": "Q-VERIFY",
        "facility_name": "Verify Facility",
        "contact_person": "Verifier",
        "email": "manuatemba@gmail.com",
        "items": items,
        "subtotal": 3000,
        "discount_amount": 0,
        "tax_rate": 16,
        "tax_amount": 480,
        "total": 3480,
        "validity_days": 30,
        "notes": "Verification",
        "include_vat": True,
        "created_at": datetime.utcnow(),
    }
    invoice_data = {
        "invoice_number": "INV-VERIFY",
        "facility_name": "Verify Facility",
        "contact_person": "Verifier",
        "email": "manuatemba@gmail.com",
        "items": items,
        "subtotal": 3000,
        "discount_amount": 0,
        "tax_rate": 16,
        "tax_amount": 480,
        "total": 3480,
        "due_date": datetime.utcnow() + timedelta(days=14),
        "payment_terms": "Net 14",
        "notes": "Verification",
        "include_vat": True,
        "created_at": datetime.utcnow(),
    }
    quote_b64 = await generate_quote_pdf(quote_data, company, is_modified=True)
    inv_b64 = await generate_invoice_pdf(invoice_data, company, is_paid=False)
    for label, b64 in (("quote PDF", quote_b64), ("invoice PDF", inv_b64)):
        raw = base64.b64decode(b64)
        if not raw.startswith(b"%PDF"):
            raise AssertionError(f"{label}: not a valid PDF ({raw[:8]!r})")
        if len(raw) < 1000:
            raise AssertionError(f"{label}: suspiciously small ({len(raw)} bytes)")
        print(f"OK  {label} ({len(raw)} bytes)")
    return quote_b64, inv_b64


def _check_template_builders() -> None:
    """Call each builder path and inspect HTML without sending."""
    from utils.email_layout import email_detail_card, mailto
    from utils.email_service import (
        _company_signature_html,
        _wrap_document_email,
    )
    from utils.email_followup import get_quote_followup_html, get_invoice_reminder_html

    company = _get_company_info_from_db()
    samples = {
        "document wrap": _wrap_document_email(
            "Your Quotation",
            "<p>Attached.</p>" + email_detail_card([("Ref", "Q-1")]) + _company_signature_html(company),
            eyebrow="Quotation",
            company_info=company,
        ),
        "quote followup helper": get_quote_followup_html(
            {
                "id": "abcdefgh",
                "facility_name": "Verify Facility",
                "contact_person": "Verifier",
                "items": [{"product_name": "Item", "quantity": 1, "unit_price": 100}],
            }
        ),
        "invoice reminder helper": get_invoice_reminder_html(
            {
                "facility_name": "Verify Facility",
                "contact_person": "Verifier",
                "invoice_number": "INV-1",
                "total": 1000,
                "due_date": datetime.utcnow(),
            },
            is_overdue=False,
        ),
    }
    for label, html in samples.items():
        _assert_shell(html, label)
        print(f"OK  {label}")


async def _send_pdf_backed(to_email: str) -> None:
    """Generate PDFs and send with attachments on the current event loop."""
    company = _get_company_info_from_db()
    items = [
        {
            "product_name": "Audit Item",
            "quantity": 2,
            "original_price": 1500,
            "modified_price": 1500,
            "unit_price": 1500,
        }
    ]
    quote_data = {
        "id": "smoke-quote-pdf",
        "quote_number": "Q-SMOKE",
        "facility_name": "Verify Facility",
        "contact_person": "Verifier",
        "email": to_email,
        "items": items,
        "subtotal": 3000,
        "discount_amount": 0,
        "tax_rate": 16,
        "tax_amount": 480,
        "total": 3480,
        "validity_days": 30,
        "notes": "Smoke quote with PDF",
        "include_vat": True,
        "created_at": datetime.utcnow(),
    }
    invoice_data = {
        "invoice_number": "INV-SMOKE-PDF",
        "facility_name": "Verify Facility",
        "contact_person": "Verifier",
        "email": to_email,
        "items": items,
        "subtotal": 3000,
        "discount_amount": 0,
        "tax_rate": 16,
        "tax_amount": 480,
        "total": 3480,
        "due_date": datetime.utcnow() + timedelta(days=14),
        "payment_terms": "Net 14",
        "notes": "Smoke invoice with PDF",
        "include_vat": True,
        "created_at": datetime.utcnow(),
    }

    from utils.email_layout import email_detail_card, email_highlight, e
    from utils.email_service import _company_signature_html, _wrap_document_email

    quote_b64 = await generate_quote_pdf(quote_data, company, is_modified=True)
    inv_b64 = await generate_invoice_pdf(invoice_data, company, is_paid=False)
    assert base64.b64decode(quote_b64).startswith(b"%PDF")
    assert base64.b64decode(inv_b64).startswith(b"%PDF")

    quote_html = _wrap_document_email(
        "Your Quotation",
        (
            f'<p style="margin:0 0 14px 0;">Dear Verifier,</p>'
            '<p style="margin:0 0 14px 0;">Please find the attached quotation (smoke test).</p>'
            + email_detail_card([
                ("Quote reference", "Q-SMOKE"),
                ("Facility", "Verify Facility"),
                ("Validity", "30 days"),
            ])
            + _company_signature_html(company)
        ),
        eyebrow="Quotation",
        company_info=company,
    )
    _assert_shell(quote_html, "quote email")
    inv_html = _wrap_document_email(
        "Your Invoice",
        (
            f'<p style="margin:0 0 14px 0;">Dear Verifier,</p>'
            '<p style="margin:0 0 14px 0;">Please find the attached invoice (smoke test).</p>'
            + email_detail_card([
                ("Invoice number", "INV-SMOKE-PDF"),
                ("Amount due", "KES 3,480"),
            ])
            + email_highlight("Payment details are on the attached PDF.")
            + _company_signature_html(company)
        ),
        eyebrow="Invoice",
        company_info=company,
    )
    _assert_shell(inv_html, "invoice email")

    q_result = await send_email_async(
        [to_email],
        "Quotation from Hampton Scientific Limited - Q-SMOKE",
        quote_html,
        attachments=[{"filename": "Quote_Q-SMOKE.pdf", "content": quote_b64}],
    )
    i_result = await send_email_async(
        [to_email],
        "Invoice from Hampton Scientific Limited - INV-SMOKE-PDF",
        inv_html,
        attachments=[{"filename": "Invoice_INV-SMOKE-PDF.pdf", "content": inv_b64}],
    )
    rem_html = render_email(
        "Invoice Reminder",
        (
            '<p style="margin:0 0 14px 0;">Dear Verifier,</p>'
            + email_highlight("Friendly reminder — invoice PDF attached.")
            + email_detail_card([
                ("Invoice number", "INV-SMOKE-REM"),
                ("Amount due", "KES 3,480"),
            ])
            + _company_signature_html(company)
        ),
        eyebrow="Payment reminder",
        company_info=company,
    )
    rem_result = await send_email_async(
        [to_email],
        "Invoice Reminder - INV-SMOKE-REM - Hampton Scientific",
        rem_html,
        attachments=[{"filename": "Invoice_INV-SMOKE-REM.pdf", "content": inv_b64}],
    )
    print(f"OK  quote+PDF → {q_result}")
    print(f"OK  invoice+PDF → {i_result}")
    print(f"OK  reminder+PDF → {rem_result}")


async def _send_smoke(to_email: str) -> None:
    if not _smtp_configured():
        raise RuntimeError("SMTP is not configured — cannot send smoke emails")

    print(f"Sending smoke emails to {to_email} …")
    send_contact_inquiry_email("Verifier", to_email, "0742000000", "Template Audit", "Smoke contact inquiry.")
    send_quote_request_email(
        "Verify Facility",
        "Verifier",
        to_email,
        "0742000000",
        [{"product_name": "Audit Item", "quantity": 1, "unit_price": 2500}],
    )
    send_training_registration_email(
        "Verify Facility", "Verifier", to_email, "0742000000", "Equipment Training", "Smoke training."
    )
    send_newsletter_welcome_email(to_email)
    send_welcome_email("Verifier", to_email)
    send_password_reset_email(to_email, "smoke-token", "https://hamptonscientific.com/reset?token=smoke")
    send_quote_status_update_email("Verifier", to_email, "Verify Facility", "submitted", "quoted", "smokequote01")
    send_user_created_by_admin_email("Verifier", to_email, "TempPass123!", True, "Verify Facility")
    send_quote_followup_email(
        "Verifier",
        to_email,
        "Verify Facility",
        "smokequote01",
        [{"product_name": "Audit Item", "quantity": 1, "unit_price": 2500}],
    )
    send_invoice_reminder_email(
        "Verifier",
        to_email,
        "Verify Facility",
        "INV-SMOKE",
        3480,
        "October 19, 2026",
        is_overdue=False,
    )
    await _send_pdf_backed(to_email)
    result = await send_email_async(
        [to_email],
        "Hampton Scientific — email audit complete",
        render_email(
            "Email Audit Complete",
            "<p>All template smoke sends completed, including quote/invoice PDFs.</p>",
            eyebrow="Verification",
            company_info=_get_company_info_from_db(),
        ),
    )
    print(f"OK  direct async send → {result}")


async def _run_all(send: bool, to_email: str) -> None:
    print("=== Email template verification ===")
    print(f"SMTP configured: {_smtp_configured()}")
    _check_render_helpers()
    _check_template_builders()
    await _check_pdfs()
    if send:
        await _send_smoke(to_email)
        print("=== Smoke sends completed ===")
    else:
        print("=== Template/PDF checks passed (use --send to deliver) ===")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--send", action="store_true", help="Actually send smoke emails")
    parser.add_argument("--to", default="manuatemba@gmail.com")
    parser.add_argument("--pdf-only", action="store_true", help="Only send PDF-backed emails")
    args = parser.parse_args()

    if args.pdf_only:
        async def _pdf():
            await _send_pdf_backed(args.to)
        asyncio.run(_pdf())
        return 0

    asyncio.run(_run_all(args.send, args.to))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise
