from __future__ import annotations

import json
from collections.abc import Sequence
from typing import Optional
from uuid import uuid4

from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from utils.list_query import csv_values
from db.models import (
    Quote,
    QuoteItem,
    QuoteMessage,
    ModifiedQuote,
    ModifiedQuoteItem,
    QuoteRevision,
    SiteSettings,
    Product,
    User,
)


# --------- Core helpers ----------

def unread_message_count(db: Session, quote_id: Optional[str], *, sender_role: str) -> int:
    if not quote_id:
        return 0
    return int(
        db.query(func.count(QuoteMessage.id))
        .filter(
            QuoteMessage.quote_id == quote_id,
            QuoteMessage.is_read.is_(False),
            QuoteMessage.sender_role == sender_role,
        )
        .scalar()
        or 0
    )


def attach_thread_unread(db: Session, payload: dict, *, quote_id: Optional[str] = None) -> dict:
    qid = quote_id or payload.get("quote_id") or payload.get("quoteId") or payload.get("id")
    payload["unread_admin_messages"] = unread_message_count(db, qid, sender_role="admin")
    payload["unread_customer_messages"] = unread_message_count(db, qid, sender_role="customer")
    return payload

def _lookup_product(db: Session, product_ref: str | None) -> Product | None:
    if not product_ref:
        return None
    row = db.query(Product).filter(Product.id == product_ref).one_or_none()
    if row:
        return row
    return db.query(Product).filter(Product.product_id == product_ref).one_or_none()


def enrich_quote_items_from_catalog(db: Session, items: list[dict]) -> list[dict]:
    """Snapshot list (selling) and buying prices from the product catalogue."""
    enriched: list[dict] = []
    for item in items or []:
        row = dict(item)
        product = _lookup_product(db, row.get("product_id"))
        if product:
            if row.get("list_price") is None:
                row["list_price"] = float(product.price or 0)
            if row.get("buying_price") is None:
                row["buying_price"] = float(getattr(product, "buying_price", 0) or 0)
        enriched.append(row)
    return enriched


CUSTOMER_SNAPSHOT_KEYS = (
    "items",
    "include_vat",
    "discount_amount",
    "tax_rate",
    "tax_amount",
    "subtotal",
    "list_subtotal",
    "total",
)


def customer_snapshot_from_payload(payload: dict) -> dict:
    items = [
        {k: v for k, v in item.items() if k != "buying_price"}
        for item in (payload.get("items") or [])
    ]
    snap = {key: payload.get(key) for key in CUSTOMER_SNAPSHOT_KEYS if key != "items"}
    snap["items"] = items
    return json.loads(json.dumps(snap, default=str))


def apply_customer_snapshot(payload: dict, snapshot: Optional[dict]) -> dict:
    if not snapshot:
        return payload
    merged = dict(payload)
    for key in CUSTOMER_SNAPSHOT_KEYS:
        if key in snapshot:
            merged[key] = snapshot[key]
    return merged


def strip_admin_pricing_fields(quote: dict) -> dict:
    """Remove admin-only cost fields before returning quotes to facilities."""
    payload = apply_customer_snapshot(dict(quote), quote.get("customer_snapshot"))
    payload.pop("customer_snapshot", None)
    payload["items"] = [
        {k: v for k, v in item.items() if k != "buying_price"}
        for item in (payload.get("items") or [])
    ]
    return payload


def _build_quote_items_from_payload(quote_id: str, items: list[dict]) -> list[QuoteItem]:
    quote_items: list[QuoteItem] = []
    for item in items or []:
        list_price = item.get("list_price")
        if list_price is None and item.get("unit_price"):
            # Legacy clients may send catalogue price as unit_price on submit
            list_price = item.get("unit_price")
        quoted_unit = float(item.get("unit_price", 0) or 0)
        if item.get("list_price") is not None:
            quoted_unit = 0
        quote_items.append(
            QuoteItem(
                id=str(uuid4()),
                quote_id=quote_id,
                product_id=item.get("product_id"),
                product_name=item.get("product_name", ""),
                category=item.get("category"),
                quantity=int(item.get("quantity", 1) or 1),
                quoted_quantity=item.get("quoted_quantity"),
                list_price=float(list_price or 0) if list_price is not None else None,
                buying_price=float(item.get("buying_price") or 0) if item.get("buying_price") is not None else None,
                unit_price=quoted_unit,
                customer_proposed_price=item.get("customer_proposed_price"),
                notes=item.get("notes"),
                admin_notes=item.get("admin_notes"),
            )
        )
    return quote_items


def _serialize_quote_with_items(quote: Quote, items: Sequence[QuoteItem]) -> dict:
    from utils.totals import overlay_document_pricing

    payload = {
        "id": quote.id,
        "quote_number": getattr(quote, "quote_number", None),
        "user_id": quote.user_id,
        "organization_id": getattr(quote, "organization_id", None),
        "ordered_by_user_id": getattr(quote, "ordered_by_user_id", None),
        "ordered_for_branch_id": getattr(quote, "ordered_for_branch_id", None),
        "delivery_location_id": getattr(quote, "delivery_location_id", None),
        "delivery_snapshot": getattr(quote, "delivery_snapshot", None),
        "facility_name": quote.facility_name,
        "contact_person": quote.contact_person,
        "requested_by": quote.contact_person,
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
        "list_subtotal": getattr(quote, "list_subtotal", 0) or 0,
        "delivery_charge": getattr(quote, "delivery_charge", 0) or 0,
        "total": quote.total,
        "include_vat": quote.include_vat,
        "customer_snapshot": getattr(quote, "customer_snapshot", None),
        "validity_days": getattr(quote, "validity_days", None) or 30,
        "quoted_at": getattr(quote, "quoted_at", None),
        "quoted_by_user_id": getattr(quote, "quoted_by_user_id", None),
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
                "quoted_quantity": getattr(item, "quoted_quantity", None) or item.quantity,
                "list_price": getattr(item, "list_price", None),
                "buying_price": getattr(item, "buying_price", None),
                "unit_price": item.unit_price,
                "quoted_unit_price": item.unit_price if (item.unit_price or 0) > 0 else None,
                "customer_proposed_price": item.customer_proposed_price,
                "notes": item.notes,
                "admin_notes": getattr(item, "admin_notes", None),
            }
            for item in items
        ],
    }
    return overlay_document_pricing(payload, items)


# --------- Quote CRUD ----------

def generate_qt_quote_reference(db: Session, preferred: Optional[str] = None) -> str:
    """Allocate a unique QT{YYYYMMDD}{id} reference."""
    from utils.document_refs import generate_quote_reference

    return generate_quote_reference(db, preferred)


def create_quote_with_items(db: Session, data: dict) -> dict:
    """
    Create a Quote row plus associated QuoteItem rows and
    return a dict matching the legacy MongoDB shape.
    """
    quote_id = data.get("id") or str(uuid4())
    preferred_number = data.get("quote_number")
    if preferred_number:
        quote_number = generate_qt_quote_reference(db, preferred_number)
    else:
        quote_number = generate_qt_quote_reference(db)

    settings_row = (
        db.query(SiteSettings)
        .filter(SiteSettings.id == "site_settings")
        .one_or_none()
    )
    default_validity_days = (
        getattr(settings_row, "default_quote_validity_days", None) or 30
    )
    from utils.totals import DEFAULT_TAX_RATE
    default_tax = getattr(settings_row, "default_tax_rate", None) or DEFAULT_TAX_RATE

    quote = Quote(
        id=quote_id,
        quote_number=quote_number,
        user_id=data.get("user_id"),
        organization_id=data.get("organization_id"),
        ordered_by_user_id=data.get("ordered_by_user_id"),
        ordered_for_branch_id=data.get("ordered_for_branch_id"),
        delivery_location_id=data.get("delivery_location_id"),
        delivery_snapshot=data.get("delivery_snapshot"),
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
        tax_rate=float(data.get("tax_rate") or default_tax),
        tax_amount=float(data.get("tax_amount", 0) or 0),
        subtotal=float(data.get("subtotal", 0) or 0),
        list_subtotal=float(data.get("list_subtotal", 0) or 0),
        delivery_charge=float(data.get("delivery_charge", 0) or 0),
        total=float(data.get("total", 0) or 0),
        include_vat=bool(data.get("include_vat", True)),
        quoted_at=data.get("quoted_at"),
        quoted_by_user_id=data.get("quoted_by_user_id"),
        assigned_admin_id=data.get("assigned_admin_id"),
        assigned_sales_user_id=data.get("assigned_sales_user_id"),
        # If the caller didn't provide validity_days, use company default.
        validity_days=int(data.get("validity_days", None) or default_validity_days or 30),
    )

    items_payload = enrich_quote_items_from_catalog(db, data.get("items", []))
    quote_items = _build_quote_items_from_payload(quote_id, items_payload)

    db.add(quote)
    for item in quote_items:
        db.add(item)

    quote.customer_snapshot = customer_snapshot_from_payload(
        _serialize_quote_with_items(quote, quote_items)
    )
    db.commit()

    # refresh to get timestamps
    db.refresh(quote)
    return _serialize_quote_with_items(quote, quote_items)


def _attach_unread_admin_messages(db: Session, payloads: list[dict]) -> list[dict]:
    ids = [p.get("id") for p in payloads if p.get("id")]
    counts = {}
    if ids:
        from sqlalchemy import func

        rows = (
            db.query(QuoteMessage.quote_id, func.count(QuoteMessage.id))
            .filter(
                QuoteMessage.quote_id.in_(ids),
                QuoteMessage.is_read.is_(False),
                QuoteMessage.sender_role == "admin",
            )
            .group_by(QuoteMessage.quote_id)
            .all()
        )
        counts = {qid: int(n) for qid, n in rows}
    for payload in payloads:
        payload["unread_messages"] = counts.get(payload.get("id"), 0)
    return payloads


def _fill_requested_by(db: Session, quotes: Sequence[Quote], payloads: list[dict]) -> list[dict]:
    user_ids = [q.ordered_by_user_id for q in quotes if getattr(q, "ordered_by_user_id", None)]
    names = {}
    if user_ids:
        for user in db.query(User).filter(User.id.in_(user_ids)).all():
            names[user.id] = f"{user.first_name} {user.last_name}".strip()
    for quote, payload in zip(quotes, payloads):
        if not payload.get("requested_by"):
            payload["requested_by"] = names.get(quote.ordered_by_user_id)
    return payloads


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
    payload = _serialize_quote_with_items(quote, items)
    if not payload.get("requested_by") and getattr(quote, "ordered_by_user_id", None):
        requester = db.query(User).filter(User.id == quote.ordered_by_user_id).one_or_none()
        if requester:
            payload["requested_by"] = f"{requester.first_name} {requester.last_name}".strip()
    _attach_unread_admin_messages(db, [payload])
    return payload


def list_quotes_for_organization(
    db: Session,
    organization_id: str,
    branch_ids: Optional[list[str]] = None,
    limit: int = 200,
) -> list[dict]:
    q = db.query(Quote).filter(Quote.organization_id == organization_id)
    if branch_ids:
        q = q.filter(Quote.ordered_for_branch_id.in_(branch_ids))
    quotes: Sequence[Quote] = q.order_by(Quote.created_at.desc()).limit(limit).all()
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

    payloads = [
        _serialize_quote_with_items(q, items_by_quote.get(q.id, []))
        for q in quotes
    ]
    return _attach_unread_admin_messages(db, payloads)


def _serialize_quote_rows(db: Session, quotes: Sequence[Quote]) -> list[dict]:
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
    payloads = [
        _serialize_quote_with_items(q, items_by_quote.get(q.id, []))
        for q in quotes
    ]
    return _attach_unread_admin_messages(db, _fill_requested_by(db, quotes, payloads))


def list_quotes_facility(
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
) -> tuple[list[dict], int]:
    q = db.query(Quote)
    if organization_id:
        q = q.filter(Quote.organization_id == organization_id)
    elif user_id:
        q = q.filter(Quote.user_id == user_id)
    if branch_ids is not None:
        q = q.filter(Quote.ordered_for_branch_id.in_(branch_ids))
    statuses = csv_values(status)
    if statuses:
        q = q.filter(Quote.status.in_(statuses))
    if search and search.strip():
        like = f"%{search.strip()}%"
        q = q.filter(
            or_(
                Quote.quote_number.ilike(like),
                Quote.facility_name.ilike(like),
                Quote.contact_person.ilike(like),
                Quote.email.ilike(like),
                Quote.phone.ilike(like),
            )
        )
    if from_date:
        q = q.filter(Quote.created_at >= from_date)
    if to_date:
        q = q.filter(Quote.created_at < to_date)

    total = q.count()
    skip = (page - 1) * limit
    rows = q.order_by(Quote.created_at.desc()).offset(skip).limit(limit).all()
    return _serialize_quote_rows(db, rows), total


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

    payloads = [
        _serialize_quote_with_items(q, items_by_quote.get(q.id, [])) for q in quotes
    ]
    return _attach_unread_admin_messages(db, payloads)


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
                buying_price=float(item.get("buying_price", 0) or 0) if item.get("buying_price") is not None else None,
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

