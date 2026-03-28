from __future__ import annotations

from collections.abc import Sequence
from typing import Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from db.models import Invoice, InvoiceItem, Quote, ModifiedQuote


def _serialize_invoice_with_items(invoice: Invoice, items: Sequence[InvoiceItem]) -> dict:
    return {
        "id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "quote_id": invoice.quote_id,
        "modified_quote_id": invoice.modified_quote_id,
        "user_id": invoice.user_id,
        "facility_name": invoice.facility_name,
        "contact_person": invoice.contact_person,
        "email": invoice.email,
        "phone": invoice.phone,
        "address": invoice.address,
        "subtotal": invoice.subtotal,
        "discount_amount": invoice.discount_amount,
        "tax_rate": invoice.tax_rate,
        "tax_amount": invoice.tax_amount,
        "total": invoice.total,
        "include_vat": getattr(invoice, "include_vat", True),
        "payment_terms": invoice.payment_terms,
        "due_date": invoice.due_date,
        "status": invoice.status,
        "notes": invoice.notes,
        "created_by": invoice.created_by,
        "created_at": invoice.created_at,
        "updated_at": invoice.updated_at,
        "paid_at": invoice.paid_at,
        "items": [
            {
                "id": item.id,
                "invoice_id": item.invoice_id,
                "product_id": item.product_id,
                "product_name": item.product_name,
                "category": item.category,
                "quantity": item.quantity,
                "original_price": item.original_price,
                "modified_price": item.modified_price,
                "discount_percent": item.discount_percent,
                "notes": item.notes,
            }
            for item in items
        ],
    }


def create_invoice_from_quote(
    db: Session,
    *,
    quote: Quote,
    modified_quote: Optional[ModifiedQuote],
    items_payload: list[dict],
    pricing: dict,
    meta: dict,
) -> dict:
    """
    Create Invoice + InvoiceItems from a Quote or ModifiedQuote.
    `pricing` contains subtotal/discount/tax_rate/tax_amount/total.
    `meta` contains invoice_number, payment_terms, due_date, notes, created_by.
    """
    invoice_id = str(uuid4())

    invoice = Invoice(
        id=invoice_id,
        invoice_number=meta["invoice_number"],
        quote_id=quote.id,
        modified_quote_id=modified_quote.id if modified_quote else None,
        user_id=quote.user_id,
        facility_name=quote.facility_name,
        contact_person=quote.contact_person,
        email=quote.email,
        phone=quote.phone,
        address=quote.address,
        subtotal=float(pricing.get("subtotal", 0) or 0),
        discount_amount=float(pricing.get("discount_amount", 0) or 0),
        tax_rate=float(pricing.get("tax_rate", 0) or 0),
        tax_amount=float(pricing.get("tax_amount", 0) or 0),
        total=float(pricing.get("total", 0) or 0),
        include_vat=bool(pricing.get("include_vat", True)),
        payment_terms=str(meta.get("payment_terms") or "Net 30"),
        due_date=meta.get("due_date"),
        status=meta.get("status", "pending"),
        notes=meta.get("notes"),
        created_by=meta.get("created_by"),
    )

    db.add(invoice)

    for item in items_payload or []:
        db.add(
            InvoiceItem(
                id=str(uuid4()),
                invoice_id=invoice_id,
                product_id=item.get("product_id"),
                product_name=item.get("product_name", ""),
                category=item.get("category"),
                quantity=int(item.get("quantity", 1) or 1),
                original_price=float(item.get("original_price", 0) or 0),
                modified_price=float(item.get("modified_price", 0) or 0),
                discount_percent=item.get("discount_percent"),
                notes=item.get("notes"),
            )
        )

    db.commit()
    db.refresh(invoice)

    items = (
        db.query(InvoiceItem)
        .filter(InvoiceItem.invoice_id == invoice_id)
        .order_by(InvoiceItem.id.asc())
        .all()
    )
    return _serialize_invoice_with_items(invoice, items)


def get_invoice_by_id(db: Session, invoice_id: str) -> Optional[dict]:
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).one_or_none()
    if not invoice:
        return None
    items = (
        db.query(InvoiceItem)
        .filter(InvoiceItem.invoice_id == invoice_id)
        .order_by(InvoiceItem.id.asc())
        .all()
    )
    return _serialize_invoice_with_items(invoice, items)


def get_invoice_by_number(db: Session, invoice_number: str) -> Optional[dict]:
    invoice = (
        db.query(Invoice)
        .filter(Invoice.invoice_number == invoice_number)
        .one_or_none()
    )
    if not invoice:
        return None
    items = (
        db.query(InvoiceItem)
        .filter(InvoiceItem.invoice_id == invoice.id)
        .order_by(InvoiceItem.id.asc())
        .all()
    )
    return _serialize_invoice_with_items(invoice, items)


def list_invoices_for_user(
    db: Session,
    user_id: str,
    limit: int = 100,
) -> list[dict]:
    invoices: Sequence[Invoice] = (
        db.query(Invoice)
        .filter(Invoice.user_id == user_id)
        .order_by(Invoice.created_at.desc())
        .limit(limit)
        .all()
    )
    if not invoices:
        return []

    invoice_ids = [inv.id for inv in invoices]
    items: Sequence[InvoiceItem] = (
        db.query(InvoiceItem)
        .filter(InvoiceItem.invoice_id.in_(invoice_ids))
        .all()
    )
    items_by_invoice: dict[str, list[InvoiceItem]] = {iid: [] for iid in invoice_ids}
    for item in items:
        items_by_invoice.setdefault(item.invoice_id, []).append(item)

    return [
        _serialize_invoice_with_items(inv, items_by_invoice.get(inv.id, []))
        for inv in invoices
    ]


def list_invoices_admin(
    db: Session,
    *,
    status_filter: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> tuple[list[dict], int]:
    query = db.query(Invoice)
    if status_filter and status_filter != "all":
        query = query.filter(Invoice.status == status_filter)

    total = query.count()
    offset = (page - 1) * limit
    invoices: Sequence[Invoice] = (
        query.order_by(Invoice.created_at.desc()).offset(offset).limit(limit).all()
    )

    if not invoices:
        return [], total

    invoice_ids = [inv.id for inv in invoices]
    items: Sequence[InvoiceItem] = (
        db.query(InvoiceItem)
        .filter(InvoiceItem.invoice_id.in_(invoice_ids))
        .all()
    )
    items_by_invoice: dict[str, list[InvoiceItem]] = {iid: [] for iid in invoice_ids}
    for item in items:
        items_by_invoice.setdefault(item.invoice_id, []).append(item)

    serialized = [
        _serialize_invoice_with_items(inv, items_by_invoice.get(inv.id, []))
        for inv in invoices
    ]
    return serialized, total


def mark_invoice_paid(
    db: Session,
    *,
    invoice_id: str,
    payment_method: str,
    marked_by: Optional[str],
    paid_at,
) -> bool:
    invoice: Optional[Invoice] = (
        db.query(Invoice).filter(Invoice.id == invoice_id).one_or_none()
    )
    if not invoice:
        return False

    invoice.status = "paid"
    invoice.notes = invoice.notes
    invoice.paid_at = paid_at
    # caller is responsible for recording who marked it as paid if needed
    db.add(invoice)
    db.commit()
    return True


