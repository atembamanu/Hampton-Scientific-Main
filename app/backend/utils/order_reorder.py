"""Create a facility draft quote from an existing order so they can reorder."""
from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from db.models import Order, OrderItem, Organization, Quote, User
from repositories import quotes as quotes_repo
from utils.totals import DEFAULT_TAX_RATE, calculate_list_subtotal


def create_reorder_quote(db: Session, user: User, order: Order) -> dict:
    items = (
        db.query(OrderItem)
        .filter(OrderItem.order_id == order.id)
        .all()
    )
    if not items:
        raise HTTPException(status_code=400, detail="This order has no products to order again")

    org = db.query(Organization).filter(Organization.id == user.organization_id).one_or_none()
    source_quote = (
        db.query(Quote).filter(Quote.id == order.quote_id).one_or_none()
        if order.quote_id
        else None
    )

    payload_items = []
    for item in items:
        row = {
            "product_id": item.product_id or "",
            "product_name": item.product_name,
            "category": item.category or "General",
            "quantity": int(item.quantity or 1),
            "list_price": item.list_price,
            "unit_price": 0,
            "notes": item.notes,
        }
        payload_items.append(row)

    contact = " ".join(part for part in (user.first_name, user.last_name) if part).strip() or user.email
    notes = f"Reorder from {order.order_number}."
    if order.notes:
        notes = f"{notes} {order.notes}"

    quote_dict = {
        "facility_name": (org.name if org else None) or user.facility_name or "Facility",
        "contact_person": contact,
        "email": user.email,
        "phone": user.phone or (org.phone if org else None) or "N/A",
        "address": (org.address_line if org else None) or user.address,
        "user_id": user.id,
        "ordered_by_user_id": user.id,
        "organization_id": user.organization_id,
        "ordered_for_branch_id": order.ordered_for_branch_id,
        "delivery_location_id": order.delivery_location_id,
        "delivery_snapshot": order.delivery_snapshot,
        "additional_notes": notes,
        "items": payload_items,
        "status": "draft",
        "current_handler": "CUSTOMER_DRAFT",
        "assigned_sales_user_id": getattr(source_quote, "assigned_sales_user_id", None) if source_quote else None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "discount_amount": 0,
        "tax_rate": DEFAULT_TAX_RATE,
        "tax_amount": 0,
        "list_subtotal": calculate_list_subtotal(payload_items),
        "subtotal": 0,
        "total": 0,
    }
    created = quotes_repo.create_quote_with_items(db, quote_dict)
    return quotes_repo.strip_admin_pricing_fields(created)
