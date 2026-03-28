from __future__ import annotations

from collections.abc import Sequence
from typing import Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from db.models import (
    Quote,
    QuoteItem,
    ModifiedQuote,
    ModifiedQuoteItem,
    QuoteRevision,
    SiteSettings,
)


# --------- Core helpers ----------

def _build_quote_items_from_payload(quote_id: str, items: list[dict]) -> list[QuoteItem]:
    quote_items: list[QuoteItem] = []
    for item in items or []:
        quote_items.append(
            QuoteItem(
                id=str(uuid4()),
                quote_id=quote_id,
                product_id=item.get("product_id"),
                product_name=item.get("product_name", ""),
                category=item.get("category"),
                quantity=int(item.get("quantity", 1) or 1),
                unit_price=float(item.get("unit_price", 0) or 0),
                customer_proposed_price=item.get("customer_proposed_price"),
                notes=item.get("notes"),
            )
        )
    return quote_items


def _serialize_quote_with_items(quote: Quote, items: Sequence[QuoteItem]) -> dict:
    return {
        "id": quote.id,
        "quote_number": getattr(quote, "quote_number", None),
        "user_id": quote.user_id,
        "facility_name": quote.facility_name,
        "contact_person": quote.contact_person,
        "email": quote.email,
        "phone": quote.phone,
        "address": quote.address,
        "additional_notes": quote.additional_notes,
        "status": quote.status,
        "customer_response": quote.customer_response,
        "customer_notes": quote.customer_notes,
        "current_handler": quote.current_handler,
        "discount_amount": quote.discount_amount,
        "tax_rate": quote.tax_rate,
        "tax_amount": quote.tax_amount,
        "subtotal": quote.subtotal,
        "total": quote.total,
        "include_vat": quote.include_vat,
        "validity_days": getattr(quote, "validity_days", None) or 30,
        "created_at": quote.created_at,
        "updated_at": quote.updated_at,
        "items": [
            {
                "id": item.id,
                "quote_id": item.quote_id,
                "product_id": item.product_id,
                "product_name": item.product_name,
                "category": item.category,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "customer_proposed_price": item.customer_proposed_price,
                "notes": item.notes,
            }
            for item in items
        ],
    }


# --------- Quote CRUD ----------

def create_quote_with_items(db: Session, data: dict) -> dict:
    """
    Create a Quote row plus associated QuoteItem rows and
    return a dict matching the legacy MongoDB shape.
    """
    quote_id = data.get("id") or str(uuid4())
    quote_number = data.get("quote_number")
    if not quote_number:
        # Simple sequential scheme, similar to invoices
        from datetime import datetime

        sequence_num = db.query(Quote).count() + 1
        quote_number = f"QUO-{datetime.utcnow().year}-{sequence_num:06d}"

    settings_row = (
        db.query(SiteSettings)
        .filter(SiteSettings.id == "site_settings")
        .one_or_none()
    )
    default_validity_days = (
        getattr(settings_row, "default_quote_validity_days", None) or 30
    )

    quote = Quote(
        id=quote_id,
        quote_number=quote_number,
        user_id=data.get("user_id"),
        facility_name=data["facility_name"],
        contact_person=data["contact_person"],
        email=data["email"],
        phone=data["phone"],
        address=data.get("address"),
        additional_notes=data.get("additional_notes"),
        status=data.get("status", "pending"),
        customer_response=data.get("customer_response"),
        customer_notes=data.get("customer_notes"),
        current_handler=data.get("current_handler", "ADMIN_REVIEW"),
        discount_amount=float(data.get("discount_amount", 0) or 0),
        tax_rate=float(data.get("tax_rate", 16) or 16),
        tax_amount=float(data.get("tax_amount", 0) or 0),
        subtotal=float(data.get("subtotal", 0) or 0),
        total=float(data.get("total", 0) or 0),
        include_vat=bool(data.get("include_vat", True)),
        # If the caller didn't provide validity_days, use company default.
        validity_days=int(data.get("validity_days", None) or default_validity_days or 30),
    )

    items_payload = data.get("items", [])
    quote_items = _build_quote_items_from_payload(quote_id, items_payload)

    db.add(quote)
    for item in quote_items:
        db.add(item)

    db.commit()

    # refresh to get timestamps
    db.refresh(quote)
    return _serialize_quote_with_items(quote, quote_items)


def get_quote_by_id(db: Session, quote_id: str) -> Optional[dict]:
    quote = db.query(Quote).filter(Quote.id == quote_id).one_or_none()
    if not quote:
        return None
    items = (
        db.query(QuoteItem)
        .filter(QuoteItem.quote_id == quote_id)
        .order_by(QuoteItem.id.asc())
        .all()
    )
    return _serialize_quote_with_items(quote, items)


def list_quotes_for_user(
    db: Session, user_id: str, limit: int = 100
) -> list[dict]:
    quotes: Sequence[Quote] = (
        db.query(Quote)
        .filter(Quote.user_id == user_id)
        .order_by(Quote.created_at.desc())
        .limit(limit)
        .all()
    )
    if not quotes:
        return []

    quote_ids = [q.id for q in quotes]
    items: Sequence[QuoteItem] = (
        db.query(QuoteItem)
        .filter(QuoteItem.quote_id.in_(quote_ids))
        .all()
    )
    items_by_quote: dict[str, list[QuoteItem]] = {qid: [] for qid in quote_ids}
    for item in items:
        items_by_quote.setdefault(item.quote_id, []).append(item)

    return [
        _serialize_quote_with_items(q, items_by_quote.get(q.id, [])) for q in quotes
    ]


def list_quotes_admin(
    db: Session,
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
) -> tuple[list[dict], int]:
    query = db.query(Quote)
    if status:
        query = query.filter(Quote.status == status)

    total = query.count()
    quotes: Sequence[Quote] = (
        query.order_by(Quote.created_at.desc()).offset(skip).limit(limit).all()
    )

    if not quotes:
        return [], total

    quote_ids = [q.id for q in quotes]
    items: Sequence[QuoteItem] = (
        db.query(QuoteItem)
        .filter(QuoteItem.quote_id.in_(quote_ids))
        .all()
    )
    items_by_quote: dict[str, list[QuoteItem]] = {qid: [] for qid in quote_ids}
    for item in items:
        items_by_quote.setdefault(item.quote_id, []).append(item)

    serialized = [
        _serialize_quote_with_items(q, items_by_quote.get(q.id, [])) for q in quotes
    ]
    return serialized, total


def update_quote_status(
    db: Session,
    quote_id: str,
    new_status: str,
    new_handler: str,
) -> bool:
    quote: Optional[Quote] = (
        db.query(Quote).filter(Quote.id == quote_id).one_or_none()
    )
    if not quote:
        return False

    quote.status = new_status
    quote.current_handler = new_handler
    db.add(quote)
    db.commit()
    return True


# --------- Modified quotes / revisions ----------

def create_modified_quote_with_items(
    db: Session,
    original_quote: Quote,
    items_payload: list[dict],
    pricing: dict,
    meta: dict,
) -> dict:
    """
    Create a ModifiedQuote + ModifiedQuoteItems + QuoteRevision rows.
    `pricing` contains subtotal/discount/tax_rate/tax_amount/total.
    `meta` contains validity_days, terms_and_conditions, notes, modified_by.
    """
    modified_id = str(uuid4())

    modified = ModifiedQuote(
        id=modified_id,
        original_quote_id=original_quote.id,
        user_id=original_quote.user_id,
        facility_name=original_quote.facility_name,
        contact_person=original_quote.contact_person,
        email=original_quote.email,
        phone=original_quote.phone,
        address=original_quote.address,
        subtotal=float(pricing.get("subtotal", 0) or 0),
        discount_amount=float(pricing.get("discount_amount", 0) or 0),
        tax_rate=float(pricing.get("tax_rate", 0) or 0),
        tax_amount=float(pricing.get("tax_amount", 0) or 0),
        total=float(pricing.get("total", 0) or 0),
        validity_days=int(meta.get("validity_days", 30) or 30),
        terms_and_conditions=meta.get("terms_and_conditions"),
        notes=meta.get("notes"),
        modified_by=meta.get("modified_by"),
    )

    db.add(modified)

    # Items
    for item in items_payload or []:
        db.add(
            ModifiedQuoteItem(
                id=str(uuid4()),
                modified_quote_id=modified_id,
                product_id=item.get("product_id"),
                product_name=item.get("product_name", ""),
                category=item.get("category"),
                quantity=int(item.get("quantity", 1) or 1),
                original_price=float(item.get("original_price", 0) or 0),
                modified_price=float(item.get("modified_price", 0) or 0),
                customer_proposed_price=item.get("customer_proposed_price"),
                discount_percent=item.get("discount_percent"),
                notes=item.get("notes"),
            )
        )

    # Revision snapshot
    revision = QuoteRevision(
        id=str(uuid4()),
        quote_id=original_quote.id,
        revised_by="admin",
        revised_by_id=meta.get("modified_by"),
        discount_amount=float(pricing.get("discount_amount", 0) or 0),
        tax_rate=float(pricing.get("tax_rate", 0) or 0),
        subtotal=float(pricing.get("subtotal", 0) or 0),
        total=float(pricing.get("total", 0) or 0),
        notes=meta.get("notes"),
    )
    db.add(revision)

    db.commit()

    return {
        "id": modified.id,
        "original_quote_id": modified.original_quote_id,
        "user_id": modified.user_id,
        "facility_name": modified.facility_name,
        "contact_person": modified.contact_person,
        "email": modified.email,
        "phone": modified.phone,
        "address": modified.address,
        "subtotal": modified.subtotal,
        "discount_amount": modified.discount_amount,
        "tax_rate": modified.tax_rate,
        "tax_amount": modified.tax_amount,
        "total": modified.total,
        "validity_days": modified.validity_days,
        "terms_and_conditions": modified.terms_and_conditions,
        "notes": modified.notes,
    }

