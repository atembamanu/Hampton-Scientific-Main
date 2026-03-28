"""
Shared context builders for Quote/Invoice documents.

These functions produce the *exact* context used by both:
- PDF generation (Playwright + Jinja2 templates)
- Email rendering (same Jinja2 templates)

This ensures totals, VAT labels, company/payment details, and references are consistent everywhere.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict


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
    # Normalize invoice pricing and VAT behaviour to match the rest of the app.
    subtotal = float(invoice_data.get("subtotal", 0) or 0)
    discount = float(invoice_data.get("discount_amount", 0) or 0)
    tax_rate = float(invoice_data.get("tax_rate", 0) or 0)
    stored_tax = float(invoice_data.get("tax_amount", 0) or 0)
    stored_total = float(invoice_data.get("total", subtotal - discount + stored_tax) or 0)
    include_vat = bool(invoice_data.get("include_vat", True))

    if include_vat and tax_rate > 0:
        tax_amount = stored_tax
        total = stored_total
        vat_label = f"VAT ({_fmt_rate(tax_rate)}%)"
    else:
        tax_amount = 0.0
        total = subtotal - discount
        display_rate = int(tax_rate) if tax_rate else 16
        vat_label = f"Excl. VAT({display_rate}%)"

    created_at = invoice_data.get("created_at") or datetime.utcnow()
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
        "customer_email": invoice_data.get("email", ""),
        "customer_phone": invoice_data.get("phone", ""),
        "customer_address": invoice_data.get("address", ""),
        "invoice_ref": invoice_data.get("invoice_number", ""),
        "invoice_date": created_at.strftime("%B %d, %Y") if hasattr(created_at, "strftime") else str(created_at),
        "due_date": due_date.strftime("%B %d, %Y") if due_date and hasattr(due_date, "strftime") else "",
        "currency": "KES",
        "items": [
            {
                "description": item.get("product_name", ""),
                "qty": int(item.get("quantity", 1) or 1),
                "price": float(item.get("modified_price") or item.get("original_price") or 0),
                "amount": float(
                    (item.get("modified_price") or item.get("original_price") or 0)
                    * (item.get("quantity") or 1)
                ),
            }
            for item in invoice_data.get("items", [])
        ],
        "subtotal": subtotal,
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


def build_quote_context(
    quote_data: Dict[str, Any],
    company_info: Dict[str, Any],
    *,
    is_modified: bool = False,
    logo_data: str = "",
) -> Dict[str, Any]:
    subtotal = float(quote_data.get("subtotal", 0) or 0)
    discount = float(quote_data.get("discount_amount", 0) or 0)
    tax_rate = float(quote_data.get("tax_rate", 0) or 0)
    stored_tax = float(quote_data.get("tax_amount", 0) or 0)
    stored_total = float(quote_data.get("total", subtotal - discount + stored_tax) or 0)
    include_vat = bool(quote_data.get("include_vat", True))

    if include_vat and tax_rate > 0:
        tax_amount = stored_tax
        total = stored_total
        vat_label = f"VAT ({_fmt_rate(tax_rate)}%)"
    else:
        tax_amount = 0.0
        total = subtotal - discount
        display_rate = int(tax_rate) if tax_rate else 16
        vat_label = f"Excl. VAT({display_rate}%)"

    created_at = quote_data.get("created_at") or datetime.utcnow()
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
        "customer_email": quote_data.get("email", ""),
        "customer_phone": quote_data.get("phone", ""),
        "customer_address": quote_data.get("address", ""),
        "quote_ref": quote_ref,
        "quote_date": created_at.strftime("%B %d, %Y") if hasattr(created_at, "strftime") else str(created_at),
        "due_date": due_date.strftime("%B %d, %Y") if due_date and hasattr(due_date, "strftime") else "",
        "currency": "KES",
        "items": [
            {
                "description": item.get("product_name", ""),
                "qty": int(item.get("quantity", 1) or 1),
                "price": float(
                    item.get("modified_price")
                    or item.get("original_price")
                    or item.get("unit_price")
                    or 0
                ),
                "amount": float(
                    (
                        item.get("modified_price")
                        or item.get("original_price")
                        or item.get("unit_price")
                        or 0
                    )
                    * (item.get("quantity") or 1)
                ),
            }
            for item in quote_data.get("items", [])
        ],
        "subtotal": subtotal,
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

