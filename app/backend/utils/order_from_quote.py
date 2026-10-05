"""Create an order from an accepted quote, preserving quoted/agreed prices."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from db.models import Order, OrderItem, Quote, QuoteItem, Branch, User


def _next_order_number(db: Session, quote_number: Optional[str] = None) -> str:
    from utils.document_refs import generate_order_reference

    return generate_order_reference(db, quote_number)


def quote_has_quoted_prices(items: list[QuoteItem]) -> bool:
    return any((item.unit_price or 0) > 0 for item in items)


def create_order_from_quote(
    db: Session,
    quote: Quote,
    items: list[QuoteItem],
    *,
    acting_user_id: Optional[str] = None,
) -> Order:
    """Create order from quote using quoted unit prices as agreed prices."""
    if not quote_has_quoted_prices(items):
        raise HTTPException(
            status_code=400,
            detail="Quote has no quoted prices yet. Wait for admin quotation.",
        )

    existing = db.query(Order).filter(Order.quote_id == quote.id).first()
    if existing:
        return existing

    branch_id = quote.ordered_for_branch_id
    if not branch_id:
        main = (
            db.query(Branch)
            .filter(Branch.organization_id == quote.organization_id, Branch.is_main == True)
            .first()
        )
        branch_id = main.id if main else None
    if not branch_id:
        raise HTTPException(status_code=400, detail="Quote has no branch assigned")

    now = datetime.utcnow()
    order_id = str(uuid.uuid4())
    order = Order(
        id=order_id,
        order_number=_next_order_number(db, quote.quote_number),
        organization_id=quote.organization_id,
        ordered_by_user_id=quote.ordered_by_user_id or acting_user_id,
        ordered_for_branch_id=branch_id,
        delivery_location_id=quote.delivery_location_id,
        assigned_sales_user_id=getattr(quote, "assigned_sales_user_id", None),
        status="order_placed",
        delivery_status="pending",
        delivery_snapshot=quote.delivery_snapshot,
        ordered_at=now,
        created_at=now,
        updated_at=now,
    )
    db.add(order)

    for qi in items:
        qty = int(getattr(qi, "quoted_quantity", None) or qi.quantity or 1)
        agreed = float(qi.unit_price or 0)
        db.add(
            OrderItem(
                id=str(uuid.uuid4()),
                order_id=order_id,
                product_id=qi.product_id,
                product_name=qi.product_name,
                category=qi.category,
                quantity=qty,
                list_price=float(getattr(qi, "list_price", 0) or 0) or None,
                buying_price=float(getattr(qi, "buying_price", 0) or 0) or None,
                unit_price=agreed,
                notes=qi.notes,
            )
        )

    quote.customer_response = quote.customer_response or "accepted"
    quote.status = "accepted"
    quote.current_handler = "LOCKED_APPROVED"
    quote.updated_at = now
    db.add(quote)
    db.commit()
    db.refresh(order)
    return order
