from __future__ import annotations

from datetime import datetime
from collections.abc import Sequence
from typing import Optional
from uuid import uuid4

from sqlalchemy.orm import Session
from sqlalchemy import and_, func, or_

from db.models import Invoice, InvoiceItem, Quote, ModifiedQuote
from utils.ops_stats import (
    INVOICE_AWAITING_PAYMENT,
    INVOICE_OVERDUE,
    INVOICE_PAID,
    OPEN_INVOICE_STATUSES,
    normalize_invoice_status,
)


def _invoice_status_clause(raw: str):
    """SQL clause for one display bucket (see utils/ops_stats.invoice_display_status)."""
    now = datetime.utcnow()
    value = (raw or "").strip().lower()
    if value in ("pending", "unpaid"):
        value = INVOICE_AWAITING_PAYMENT
    if value == INVOICE_OVERDUE:
        return and_(
            Invoice.status.notin_([INVOICE_PAID]),
            Invoice.due_date.isnot(None),
            Invoice.due_date < now,
        )
    if value in OPEN_INVOICE_STATUSES:
        return and_(
            or_(Invoice.status.is_(None), Invoice.status.in_(list(OPEN_INVOICE_STATUSES))),
            or_(Invoice.due_date.is_(None), Invoice.due_date >= now),
        )
    return Invoice.status == value


def _apply_invoice_status_filter(query, status: Optional[str]):
    """Filter by one or more comma-separated display buckets.

    "overdue" is derived from the due date; "awaiting_payment" (and its legacy
    aliases "pending"/"unpaid") means open and not yet past due.
    """
    parts = []
    for part in str(status or "").split(","):
        value = part.strip().lower()
        if value and value != "all" and value not in parts:
            parts.append(value)
    if not parts:
        return query
    if len(parts) == 1:
        return query.filter(_invoice_status_clause(parts[0]))
    return query.filter(or_(*[_invoice_status_clause(part) for part in parts]))


def _related_quote_and_order(db: Session, invoice: Invoice) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    from db.models import Order, Quote, Branch

    quote_number = None
    order_id = None
    order_number = None
    branch_name = None
    if invoice.quote_id:
        quote = db.query(Quote).filter(Quote.id == invoice.quote_id).one_or_none()
        quote_number = quote.quote_number if quote else None
        order = db.query(Order).filter(Order.quote_id == invoice.quote_id).first()
        if order:
            order_id = order.id
            order_number = order.order_number
    branch_id = getattr(invoice, "branch_id", None)
    if branch_id:
        branch = db.query(Branch).filter(Branch.id == branch_id).one_or_none()
        branch_name = branch.name if branch else None
    return quote_number, order_id, order_number, branch_name


def _serialize_invoice_with_items(
    invoice: Invoice,
    items: Sequence[InvoiceItem],
    db: Optional[Session] = None,
) -> dict:
    quote_number = None
    order_id = None
    order_number = None
    branch_name = None
    if db is not None:
        quote_number, order_id, order_number, branch_name = _related_quote_and_order(db, invoice)
    from repositories.quotes import attach_thread_unread
    from utils.totals import overlay_document_pricing
    payload = {
        "id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "organization_id": getattr(invoice, "organization_id", None),
        "quote_id": invoice.quote_id,
        "quote_number": quote_number,
        "order_id": order_id,
        "order_number": order_number,
        "branch_id": getattr(invoice, "branch_id", None),
        "branch_name": branch_name,
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
                "list_price": item.original_price,
                "original_price": item.original_price,
                "unit_price": item.modified_price,
                "modified_price": item.modified_price,
                "discount_percent": item.discount_percent,
                "notes": item.notes,
            }
            for item in items
        ],
    }
    priced = overlay_document_pricing(payload)
    if db is not None:
        return attach_thread_unread(db, priced, quote_id=invoice.quote_id)
    return priced


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
        organization_id=getattr(quote, "organization_id", None),
        branch_id=getattr(quote, "ordered_for_branch_id", None),
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
        status=normalize_invoice_status(meta.get("status")),
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
    return _serialize_invoice_with_items(invoice, items, db)


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
    return _serialize_invoice_with_items(invoice, items, db)


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
    return _serialize_invoice_with_items(invoice, items, db)


def get_invoice_by_id_or_number(db: Session, key: str) -> Optional[dict]:
    return get_invoice_by_id(db, key) or get_invoice_by_number(db, key)


def list_invoices_for_organization(
    db: Session,
    organization_id: str,
    branch_ids: Optional[list[str]] = None,
    limit: int = 200,
) -> list[dict]:
    q = db.query(Invoice).filter(Invoice.organization_id == organization_id)
    if branch_ids:
        q = q.filter(Invoice.branch_id.in_(branch_ids))
    invoices: Sequence[Invoice] = q.order_by(Invoice.created_at.desc()).limit(limit).all()
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
        _serialize_invoice_with_items(inv, items_by_invoice.get(inv.id, []), db)
        for inv in invoices
    ]


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
        _serialize_invoice_with_items(inv, items_by_invoice.get(inv.id, []), db)
        for inv in invoices
    ]


def list_invoices_facility(
    db: Session,
    *,
    organization_id: Optional[str] = None,
    user_id: Optional[str] = None,
    branch_ids: Optional[list[str]] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    from_date=None,
    to_date=None,
    page: int = 1,
    limit: int = 10,
) -> tuple[list[dict], int, float]:
    q = db.query(Invoice)
    if organization_id:
        q = q.filter(Invoice.organization_id == organization_id)
    elif user_id:
        q = q.filter(Invoice.user_id == user_id)
    if branch_ids is not None:
        q = q.filter(Invoice.branch_id.in_(branch_ids))
    q = _apply_invoice_status_filter(q, status)
    if search and search.strip():
        like = f"%{search.strip()}%"
        q = q.filter(
            or_(
                Invoice.invoice_number.ilike(like),
                Invoice.facility_name.ilike(like),
                Invoice.contact_person.ilike(like),
                Invoice.email.ilike(like),
            )
        )
    if from_date:
        q = q.filter(Invoice.created_at >= from_date)
    if to_date:
        q = q.filter(Invoice.created_at < to_date)

    total = q.count()
    amount_total = float(
        q.with_entities(func.coalesce(func.sum(Invoice.total), 0)).order_by(None).scalar() or 0
    )
    skip = (page - 1) * limit
    invoices = q.order_by(Invoice.created_at.desc()).offset(skip).limit(limit).all()
    if not invoices:
        return [], total, amount_total
    invoice_ids = [inv.id for inv in invoices]
    items: Sequence[InvoiceItem] = (
        db.query(InvoiceItem).filter(InvoiceItem.invoice_id.in_(invoice_ids)).all()
    )
    items_by_invoice: dict[str, list[InvoiceItem]] = {iid: [] for iid in invoice_ids}
    for item in items:
        items_by_invoice.setdefault(item.invoice_id, []).append(item)
    serialized = [
        _serialize_invoice_with_items(inv, items_by_invoice.get(inv.id, []), db)
        for inv in invoices
    ]
    return serialized, total, amount_total


def list_invoices_admin(
    db: Session,
    *,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    from_date=None,
    to_date=None,
    page: int = 1,
    limit: int = 20,
) -> tuple[list[dict], int]:
    query = db.query(Invoice)
    if status_filter and status_filter != "all":
        query = _apply_invoice_status_filter(query, status_filter)
    if search and search.strip():
        like = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Invoice.invoice_number.ilike(like),
                Invoice.facility_name.ilike(like),
                Invoice.contact_person.ilike(like),
                Invoice.email.ilike(like),
            )
        )
    if from_date:
        query = query.filter(Invoice.created_at >= from_date)
    if to_date:
        query = query.filter(Invoice.created_at < to_date)

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
        _serialize_invoice_with_items(inv, items_by_invoice.get(inv.id, []), db)
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


