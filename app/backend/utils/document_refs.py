"""Shared quote / order / invoice reference numbers.

Format: PREFIX + YYYYMMDD + system sequence (unpadded).
Examples: QT202609271, ORD202609271, IN202609271
"""
from __future__ import annotations

import re
from typing import Optional

from utils.app_time import app_date_stamp

from sqlalchemy.orm import Session

QUOTE_PREFIX = "QT"
ORDER_PREFIX = "ORD"
INVOICE_PREFIX = "IN"

_NEW_REF = re.compile(r"^(QT|ORD|IN)(\d{8})(\d+)$", re.IGNORECASE)
_DASHED = re.compile(
    r"^(QT|ORD|INV|IN)[-]?(\d{8}|\d{4})[-]?(\d+)$",
    re.IGNORECASE,
)


def parse_document_stem(ref: Optional[str]) -> Optional[str]:
    """Return YYYYMMDD + unpadded sequence from an existing reference."""
    if not ref:
        return None
    compact = str(ref).replace("-", "").upper()
    m = _NEW_REF.match(compact)
    if m:
        return f"{m.group(2)}{int(m.group(3))}"
    m = _DASHED.match(str(ref).upper())
    if m:
        date_part, seq = m.group(2), m.group(3)
        if len(date_part) == 4:
            date_part = f"{date_part}0101"
        return f"{date_part}{int(seq)}"
    return None


def format_reference(kind: str, stem: str) -> str:
    prefix = {"quote": QUOTE_PREFIX, "order": ORDER_PREFIX, "invoice": INVOICE_PREFIX}[kind]
    return f"{prefix}{stem}"


def sibling_reference(source_ref: Optional[str], kind: str) -> Optional[str]:
    stem = parse_document_stem(source_ref)
    if not stem:
        return None
    return format_reference(kind, stem)


def is_canonical_reference(ref: Optional[str], kind: str) -> bool:
    if not ref:
        return False
    prefix = {"quote": QUOTE_PREFIX, "order": ORDER_PREFIX, "invoice": INVOICE_PREFIX}[kind]
    return bool(re.match(rf"^{prefix}\d{{8}}\d+$", str(ref).upper()))


def _next_quote_seq(db: Session) -> int:
    from db.models import Quote

    return (db.query(Quote).count() or 0) + 1


def generate_quote_reference(db: Session, preferred: Optional[str] = None) -> str:
    from db.models import Quote

    if preferred:
        exists = db.query(Quote).filter(Quote.quote_number == preferred).one_or_none()
        if not exists:
            return preferred

    today = app_date_stamp()
    start = _next_quote_seq(db)
    for seq in range(start, start + 10000):
        candidate = f"{QUOTE_PREFIX}{today}{seq}"
        if not db.query(Quote).filter(Quote.quote_number == candidate).first():
            return candidate
    raise ValueError("Could not allocate quote reference")


def generate_order_reference(db: Session, quote_number: Optional[str] = None) -> str:
    from db.models import Order

    sibling = sibling_reference(quote_number, "order")
    if sibling and not db.query(Order).filter(Order.order_number == sibling).first():
        return sibling

    today = app_date_stamp()
    start = (db.query(Order).count() or 0) + 1
    for seq in range(start, start + 10000):
        candidate = f"{ORDER_PREFIX}{today}{seq}"
        if not db.query(Order).filter(Order.order_number == candidate).first():
            return candidate
    raise ValueError("Could not allocate order reference")


def generate_invoice_reference(db: Session, quote_number: Optional[str] = None) -> str:
    from db.models import Invoice

    sibling = sibling_reference(quote_number, "invoice")
    if sibling and not db.query(Invoice).filter(Invoice.invoice_number == sibling).first():
        return sibling

    today = app_date_stamp()
    start = (db.query(Invoice).count() or 0) + 1
    for seq in range(start, start + 10000):
        candidate = f"{INVOICE_PREFIX}{today}{seq}"
        if not db.query(Invoice).filter(Invoice.invoice_number == candidate).first():
            return candidate
    raise ValueError("Could not allocate invoice reference")


def migrate_document_references(db: Session) -> int:
    """Rewrite legacy hyphenated references to the shared QT/ORD/IN scheme."""
    from db.models import Invoice, Order, Quote

    quotes = db.query(Quote).order_by(Quote.created_at.asc(), Quote.id.asc()).all()
    if not quotes:
        return 0

    already_canonical = all(is_canonical_reference(q.quote_number, "quote") for q in quotes)
    orders = db.query(Order).all()
    invoices = db.query(Invoice).all()
    orders_ok = all(is_canonical_reference(o.order_number, "order") for o in orders)
    invoices_ok = all(is_canonical_reference(i.invoice_number, "invoice") for i in invoices)
    if already_canonical and orders_ok and invoices_ok:
        return 0

    for q in quotes:
        q.quote_number = f"_mig_q_{q.id}"
    for o in orders:
        o.order_number = f"_mig_o_{o.id}"
    for inv in invoices:
        inv.invoice_number = f"_mig_i_{inv.id}"
    db.flush()

    quote_by_id = {}
    for i, q in enumerate(quotes, start=1):
        date = app_date_stamp(q.created_at)
        q.quote_number = f"{QUOTE_PREFIX}{date}{i}"
        quote_by_id[q.id] = q.quote_number

    used_orders: set[str] = set()
    for i, o in enumerate(orders, start=1):
        candidate = sibling_reference(quote_by_id.get(o.quote_id), "order")
        if not candidate or candidate in used_orders:
            date = app_date_stamp(o.created_at)
            candidate = f"{ORDER_PREFIX}{date}{i}"
        o.order_number = candidate
        used_orders.add(candidate)

    used_invoices: set[str] = set()
    for i, inv in enumerate(invoices, start=1):
        candidate = sibling_reference(quote_by_id.get(inv.quote_id), "invoice")
        if not candidate or candidate in used_invoices:
            date = app_date_stamp(inv.created_at)
            candidate = f"{INVOICE_PREFIX}{date}{i}"
        inv.invoice_number = candidate
        used_invoices.add(candidate)

    db.commit()
    return len(quotes) + len(orders) + len(invoices)
