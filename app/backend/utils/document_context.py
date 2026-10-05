"""
Shared context builders for Quote/Invoice documents.

These functions produce the *exact* context used by both:
- PDF generation (Playwright + Jinja2 templates)
- Email rendering (same Jinja2 templates)

This ensures totals, VAT labels, company/payment details, and references are consistent everywhere.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict

from utils.app_time import format_app, utc_now

DOCUMENT_DATE_FORMAT = "%B %d, %Y"


def _document_date(value: Any) -> str:
    """Render a stored (UTC) datetime as a calendar date in the company time zone."""
    if not value:
        return ""
    if isinstance(value, datetime):
        return format_app(value, DOCUMENT_DATE_FORMAT)
    if isinstance(value, date):
        return value.strftime(DOCUMENT_DATE_FORMAT)
    return str(value)


def document_branch_name(data: Dict[str, Any] | None) -> str:
    if not data:
        return ""
    name = str(data.get("branch_name") or "").strip()
    if name:
        return name
    snap = data.get("delivery_snapshot")
    if isinstance(snap, dict):
        return str(snap.get("branch_name") or "").strip()
    return ""


def _line_qty(item: Dict[str, Any]) -> int:
    return int(item.get("quoted_quantity") or item.get("quantity") or 1)


def _fmt_rate(rate: float) -> str:
    try:
        return str(int(rate)) if float(rate).is_integer() else str(rate)
    except Exception:
        return str(rate)


def build_invoice_context(
    invoice_data: Dict[str, Any],
    company_info: Dict[str, Any],
    *,
    is_paid: bool = False,
    logo_data: str = "",
    paid_stamp_data: str = "",
) -> Dict[str, Any]:
    from utils.totals import overlay_document_pricing, DEFAULT_TAX_RATE

    priced = overlay_document_pricing(dict(invoice_data), invoice_data.get("items"))
    include_vat = bool(priced.get("include_vat", True))
    tax_rate = float(priced.get("tax_rate") or 0)
    tax_amount = float(priced.get("tax_amount") or 0)
    total = float(priced.get("total") or 0)
    display_subtotal = float(priced.get("list_subtotal") or 0)
    discount = float(priced.get("discount_amount") or 0)

    if include_vat and tax_rate > 0:
        vat_label = f"VAT ({_fmt_rate(tax_rate)}%)"
    else:
        tax_amount = 0.0
        total = float(priced.get("quoted_subtotal") or priced.get("subtotal") or 0)
        display_rate = tax_rate if tax_rate > 0 else DEFAULT_TAX_RATE
        vat_label = f"Excl. VAT({_fmt_rate(display_rate)}%)"

    created_at = invoice_data.get("created_at") or utc_now()
    due_date = invoice_data.get("due_date")
    terms_text = (
        invoice_data.get("terms_text")
        or invoice_data.get("terms_and_conditions")
        or company_info.get("default_payment_terms")
        or invoice_data.get("payment_terms")
        or "Net 14"
    )

    return {
        "company": {
            "name": company_info.get("company_name", "Hampton Scientific Limited"),
            "address_line1": company_info.get("address", ""),
            "address_line2": company_info.get("po_box", ""),
            "email": company_info.get("email", ""),
            "phone": company_info.get("phone", ""),
            "website": company_info.get("website", ""),
        },
        "customer_name": invoice_data.get("facility_name", ""),
        "customer_branch": document_branch_name(invoice_data),
        "customer_email": invoice_data.get("email", ""),
        "customer_phone": invoice_data.get("phone", ""),
        "customer_address": invoice_data.get("address", ""),
        "invoice_ref": invoice_data.get("invoice_number", ""),
        "invoice_date": _document_date(created_at),
        "due_date": _document_date(due_date),
        "currency": "KES",
        "items": [
            {
                "description": item.get("product_name", ""),
                "qty": _line_qty(item),
                "price": float(item.get("modified_price") or item.get("original_price") or 0),
                "amount": float(
                    (item.get("modified_price") or item.get("original_price") or 0)
                    * _line_qty(item)
                ),
            }
            for item in invoice_data.get("items", [])
        ],
        "subtotal": display_subtotal,
        "discount": discount,
        "discount_label": "Discount",
        "vat_label": vat_label,
        "tax_amount": tax_amount,
        "total": total,
        "terms_text": terms_text,
        "is_paid": is_paid,
        # Payment info from company settings
        "bank_name": company_info.get("bank_name", ""),
        "bank_account_name": company_info.get("bank_account_name", ""),
        "bank_account_number": company_info.get("bank_account_number", ""),
        "mpesa_paybill": company_info.get("mpesa_paybill", ""),
        "mpesa_account_number": company_info.get("mpesa_account_number", ""),
        "mpesa_account_name": company_info.get("mpesa_account_name", ""),
        "logo_data": logo_data,
        "paid_stamp_data": paid_stamp_data,
    }


def build_delivery_note_context(
    invoice_data: Dict[str, Any],
    company_info: Dict[str, Any],
    *,
    logo_data: str = "",
) -> Dict[str, Any]:
    """Build Jinja context for a Delivery Note PDF from invoice data."""
    created_at = invoice_data.get("created_at") or utc_now()
    despatch_at = utc_now()
    invoice_number = invoice_data.get("invoice_number", "") or ""

    contact_person = invoice_data.get("contact_person") or ""
    facility_name = invoice_data.get("facility_name") or ""
    branch_name = document_branch_name(invoice_data)
    address = invoice_data.get("address") or ""
    phone = invoice_data.get("phone") or ""

    items = []
    for item in invoice_data.get("items", []):
        qty = int(item.get("quantity", 1) or 1)
        product_id = item.get("product_id") or ""
        item_id = item.get("id") or ""
        item_number = product_id or (item_id[:8].upper() if item_id else "")
        items.append(
            {
                "item_number": item_number,
                "description": item.get("product_name") or "",
                "ordered": qty,
                "delivered": qty,
                "outstanding": 0,
            }
        )

    return {
        "logo_data": logo_data,
        "company": {
            "name": company_info.get("company_name", "Hampton Scientific Limited"),
            "address_line1": company_info.get("address", ""),
            "address_line2": company_info.get("po_box", ""),
            "email": company_info.get("email", ""),
            "phone": company_info.get("phone", ""),
            "website": company_info.get("website", ""),
        },
        "delivery_note_number": f"DN-{invoice_number}" if invoice_number else "DN-",
        "order_number": invoice_number,
        "order_date": _document_date(created_at),
        "despatch_date": _document_date(despatch_at),
        "delivery_method": "As arranged",
        "shipping": {
            "name": contact_person,
            "company": facility_name,
            "branch": branch_name,
            "address": address,
            "phone": phone,
        },
        "invoice_address": {
            "name": contact_person,
            "company": facility_name,
            "branch": branch_name,
            "address": address,
            "phone": phone,
        },
        "items": items,
        "enquiry_contact_name": company_info.get("company_name", "Hampton Scientific Limited"),
        "enquiry_phone": company_info.get("phone", ""),
        "enquiry_email": (
            (company_info.get("email") or "").strip()
            or "admin@hamptonscientific.com"
        ),
    }


def build_quote_context(
    quote_data: Dict[str, Any],
    company_info: Dict[str, Any],
    *,
    is_modified: bool = False,
    logo_data: str = "",
) -> Dict[str, Any]:
    from utils.totals import overlay_document_pricing, DEFAULT_TAX_RATE

    priced = overlay_document_pricing(dict(quote_data), quote_data.get("items"))
    include_vat = bool(priced.get("include_vat", True))
    tax_rate = float(priced.get("tax_rate") or 0)
    tax_amount = float(priced.get("tax_amount") or 0)
    total = float(priced.get("total") or 0)
    display_subtotal = float(priced.get("list_subtotal") or 0)
    discount = float(priced.get("discount_amount") or 0)

    if include_vat and tax_rate > 0:
        vat_label = f"VAT ({_fmt_rate(tax_rate)}%)"
    else:
        tax_amount = 0.0
        total = float(priced.get("quoted_subtotal") or priced.get("subtotal") or 0)
        display_rate = tax_rate if tax_rate > 0 else DEFAULT_TAX_RATE
        vat_label = f"Excl. VAT({_fmt_rate(display_rate)}%)"

    created_at = quote_data.get("created_at") or utc_now()
    validity_days = int(quote_data.get("validity_days", 30) or 30)
    due_date = created_at + timedelta(days=validity_days) if hasattr(created_at, "__add__") else ""
    terms_text = (
        quote_data.get("terms_text")
        or quote_data.get("terms_and_conditions")
        or f"This quotation is valid for {validity_days} days."
    )

    quote_ref = quote_data.get("quote_number") or (quote_data.get("id") or "")[:8].upper()

    return {
        "logo_data": logo_data,
        "company": {
            "name": company_info.get("company_name", "Hampton Scientific Limited"),
            "address_line1": company_info.get("address", ""),
            "address_line2": company_info.get("po_box", ""),
            "email": company_info.get("email", ""),
            "phone": company_info.get("phone", ""),
            "website": company_info.get("website", ""),
        },
        "customer_name": quote_data.get("facility_name", ""),
        "customer_branch": document_branch_name(quote_data),
        "customer_email": quote_data.get("email", ""),
        "customer_phone": quote_data.get("phone", ""),
        "customer_address": quote_data.get("address", ""),
        "quote_ref": quote_ref,
        "quote_date": _document_date(created_at),
        "due_date": _document_date(due_date),
        "currency": "KES",
        "items": [
            {
                "description": item.get("product_name", ""),
                "qty": _line_qty(item),
                "price": float(
                    item.get("modified_price")
                    or (
                        item.get("unit_price")
                        if float(item.get("unit_price") or 0) > 0
                        else None
                    )
                    or item.get("original_price")
                    or item.get("list_price")
                    or 0
                ),
                "amount": float(
                    (
                        item.get("modified_price")
                        or (
                            item.get("unit_price")
                            if float(item.get("unit_price") or 0) > 0
                            else None
                        )
                        or item.get("original_price")
                        or item.get("list_price")
                        or 0
                    )
                    * _line_qty(item)
                ),
            }
            for item in quote_data.get("items", [])
        ],
        "subtotal": display_subtotal,
        "discount": discount,
        "discount_label": "Discount",
        "vat_label": vat_label,
        "tax_amount": tax_amount,
        "total": total,
        "terms_text": terms_text,
        "validity_days": validity_days,
        "is_modified": is_modified,
        # Payment info from company settings
        "bank_name": company_info.get("bank_name", ""),
        "bank_account_name": company_info.get("bank_account_name", ""),
        "bank_account_number": company_info.get("bank_account_number", ""),
        "mpesa_paybill": company_info.get("mpesa_paybill", ""),
        "mpesa_account_number": company_info.get("mpesa_account_number", ""),
        "mpesa_account_name": company_info.get("mpesa_account_name", ""),
        "notes": quote_data.get("notes") or quote_data.get("additional_notes") or "",
    }

