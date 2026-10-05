import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from deps import get_db
from models.order import OrderCreate, OrderStatusUpdate
from utils.permissions import (
    require_facility_user,
    require_branch_access,
    get_user_accessible_branch_ids,
    resolve_write_branch_id,
    resolve_list_branch_ids,
)
from db.models import User, Order, OrderItem, Branch, DeliveryLocation, Quote, QuoteItem
from utils.order_from_quote import create_order_from_quote, quote_has_quoted_prices
from utils.order_lifecycle import apply_order_lifecycle_timestamps
from utils.live_events import publish_entity_event
from utils.list_query import csv_values, parse_day_start, parse_day_end, clamp_page, paginated_payload

router = APIRouter()


def _serialize_order(db: Session, order: Order) -> dict:
    items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
    branch = db.query(Branch).filter(Branch.id == order.ordered_for_branch_id).one_or_none()
    ordered_by = db.query(User).filter(User.id == order.ordered_by_user_id).one_or_none()
    delivery = None
    if order.delivery_location_id:
        delivery = db.query(DeliveryLocation).filter(DeliveryLocation.id == order.delivery_location_id).one_or_none()

    snapshot = order.delivery_snapshot or {}
    quote = db.query(Quote).filter(Quote.id == order.quote_id).one_or_none() if order.quote_id else None
    from utils.totals import overlay_document_pricing
    payload = {
        "id": order.id,
        "orderNumber": order.order_number,
        "organizationId": order.organization_id,
        "orderedByUserId": order.ordered_by_user_id,
        "orderedForBranchId": order.ordered_for_branch_id,
        "deliveryLocationId": order.delivery_location_id,
        "quoteId": order.quote_id,
        "quoteNumber": quote.quote_number if quote else None,
        "status": order.status,
        "deliverySnapshot": snapshot,
        "notes": order.notes,
        "orderedByName": f"{ordered_by.first_name} {ordered_by.last_name}" if ordered_by else None,
        "orderedByJobTitle": ordered_by.job_title if ordered_by else None,
        "orderedForBranchName": branch.name if branch else None,
        "deliveryLabel": delivery.label if delivery else snapshot.get("label"),
        "items": [
            {
                "id": i.id,
                "product_id": i.product_id,
                "product_name": i.product_name,
                "category": i.category,
                "quantity": i.quantity,
                "list_price": getattr(i, "list_price", None),
                "unit_price": i.unit_price,
                "agreed_unit_price": i.unit_price,
                "notes": i.notes,
            }
            for i in items
        ],
        "subtotal": sum((i.unit_price or 0) * (i.quantity or 1) for i in items),
        "tax_rate": getattr(quote, "tax_rate", None) if quote else None,
        "include_vat": getattr(quote, "include_vat", True) if quote else True,
        "delivery_charge": getattr(quote, "delivery_charge", 0) if quote else 0,
        "orderedAt": getattr(order, "ordered_at", None) or order.created_at,
        "dispatchedAt": getattr(order, "dispatched_at", None),
        "deliveredAt": getattr(order, "delivered_at", None),
        "createdAt": order.created_at,
        "updatedAt": order.updated_at,
    }
    from repositories.quotes import attach_thread_unread
    from utils.totals import overlay_document_pricing
    return attach_thread_unread(db, overlay_document_pricing(payload, items), quote_id=order.quote_id)


def _next_order_number(db: Session, quote_number: Optional[str] = None) -> str:
    from utils.document_refs import generate_order_reference

    return generate_order_reference(db, quote_number)


@router.get("")
async def list_orders(
    branch_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    page: Optional[int] = None,
    limit: int = 10,
    user: User = Depends(require_facility_user),
    db: Session = Depends(get_db),
):
    q = db.query(Order).filter(Order.organization_id == user.organization_id)
    branch_ids = resolve_list_branch_ids(db, user, branch_id)
    if branch_ids is not None:
        q = q.filter(Order.ordered_for_branch_id.in_(branch_ids))

    statuses = csv_values(status)
    if statuses:
        q = q.filter(Order.status.in_(statuses))

    start = parse_day_start(from_date)
    end = parse_day_end(to_date)
    if start:
        q = q.filter(Order.created_at >= start)
    if end:
        q = q.filter(Order.created_at < end)

    if search and search.strip():
        like = f"%{search.strip()}%"
        name_match = (
            db.query(User.id)
            .filter(
                User.id == Order.ordered_by_user_id,
                or_(
                    User.first_name.ilike(like),
                    User.last_name.ilike(like),
                    func.concat(User.first_name, " ", User.last_name).ilike(like),
                ),
            )
            .exists()
        )
        quote_match = (
            db.query(Quote.id)
            .filter(Quote.id == Order.quote_id, Quote.quote_number.ilike(like))
            .exists()
        )
        q = q.filter(or_(Order.order_number.ilike(like), name_match, quote_match))

    total = q.count()
    page_n, limit_n, skip = clamp_page(page or 1, limit)
    fetch_limit = limit_n if page is not None else 200
    orders = q.order_by(Order.created_at.desc()).offset(skip if page is not None else 0).limit(fetch_limit).all()
    items = [_serialize_order(db, o) for o in orders]
    if page is None:
        return items
    return paginated_payload(items, total, page_n, limit_n)


@router.post("")
async def create_order(
    payload: OrderCreate,
    user: User = Depends(require_facility_user),
    db: Session = Depends(get_db),
):
    branch_id = resolve_write_branch_id(db, user, payload.orderedForBranchId)

    if user.role == "branch_user":
        from db.models import Organization

        org = db.query(Organization).filter(Organization.id == user.organization_id).one()
        settings = org.settings or {}
        if not settings.get("branch_users_can_order_directly", True):
            raise HTTPException(status_code=403, detail="Branch users cannot place orders directly")

    now = datetime.utcnow()
    order_id = str(uuid.uuid4())
    quote_number = None
    if payload.quoteId:
        source_quote = db.query(Quote).filter(Quote.id == payload.quoteId).one_or_none()
        quote_number = source_quote.quote_number if source_quote else None
    order = Order(
        id=order_id,
        order_number=_next_order_number(db, quote_number),
        organization_id=user.organization_id,
        ordered_by_user_id=user.id,
        ordered_for_branch_id=branch_id,
        delivery_location_id=payload.deliveryLocationId,
        quote_id=payload.quoteId,
        status=payload.status or "quote_requested",
        delivery_snapshot=payload.deliverySnapshot,
        notes=payload.notes,
        ordered_at=now,
        created_at=now,
        updated_at=now,
    )
    db.add(order)

    for item in payload.items:
        db.add(
            OrderItem(
                id=str(uuid.uuid4()),
                order_id=order_id,
                product_id=item.product_id,
                product_name=item.product_name,
                category=item.category,
                quantity=item.quantity,
                unit_price=item.unit_price,
                notes=item.notes,
            )
        )

    db.commit()
    db.refresh(order)
    publish_entity_event(
        "order.updated",
        entity_type="order",
        entity_id=order.id,
        organization_id=order.organization_id,
        order_id=order.id,
        quote_id=order.quote_id,
    )
    return _serialize_order(db, order)


@router.get("/{order_id}")
async def get_order(
    order_id: str,
    user: User = Depends(require_facility_user),
    db: Session = Depends(get_db),
):
    order = (
        db.query(Order)
        .filter(Order.id == order_id, Order.organization_id == user.organization_id)
        .one_or_none()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    require_branch_access(db, user, order.ordered_for_branch_id)
    return _serialize_order(db, order)


@router.post("/{order_id}/reorder")
async def reorder_order(
    order_id: str,
    user: User = Depends(require_facility_user),
    db: Session = Depends(get_db),
):
    """Create a draft quote from this order so the facility can adjust and resubmit."""
    from utils.order_reorder import create_reorder_quote

    order = (
        db.query(Order)
        .filter(Order.id == order_id, Order.organization_id == user.organization_id)
        .one_or_none()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    require_branch_access(db, user, order.ordered_for_branch_id)
    return create_reorder_quote(db, user, order)


@router.patch("/{order_id}/status")
async def update_order_status(
    order_id: str,
    payload: OrderStatusUpdate,
    user: User = Depends(require_facility_user),
    db: Session = Depends(get_db),
):
    if user.role not in ("org_admin", "branch_admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    order = (
        db.query(Order)
        .filter(Order.id == order_id, Order.organization_id == user.organization_id)
        .one_or_none()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = payload.status
    order.updated_at = datetime.utcnow()
    apply_order_lifecycle_timestamps(order, new_status=payload.status, now=order.updated_at)
    db.commit()
    publish_entity_event(
        "order.updated",
        entity_type="order",
        entity_id=order.id,
        organization_id=order.organization_id,
        order_id=order.id,
        quote_id=order.quote_id,
    )
    return _serialize_order(db, order)


@router.post("/from-quote/{quote_id}")
async def convert_quote_to_order(
    quote_id: str,
    user: User = Depends(require_facility_user),
    db: Session = Depends(get_db),
):
    quote = db.query(Quote).filter(Quote.id == quote_id).one_or_none()
    if not quote or quote.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Quote not found")

    branch_id = quote.ordered_for_branch_id
    if branch_id:
        require_branch_access(db, user, branch_id)

    if quote.status not in ("quoted", "accepted") or quote.current_handler not in (
        "CUSTOMER_REVIEW",
        "LOCKED_APPROVED",
        "ADMIN_INVOICING",
    ):
        raise HTTPException(status_code=400, detail="Quote is not ready for order conversion")

    items = db.query(QuoteItem).filter(QuoteItem.quote_id == quote_id).all()
    if not quote_has_quoted_prices(items):
        raise HTTPException(status_code=400, detail="Quote has no quoted prices yet")

    if quote.customer_response != "accepted":
        raise HTTPException(
            status_code=400,
            detail="Accept the quote before converting to an order",
        )

    order = create_order_from_quote(db, quote, items, acting_user_id=user.id)
    publish_entity_event(
        "order.updated",
        entity_type="order",
        entity_id=order.id,
        organization_id=quote.organization_id,
        order_id=order.id,
        quote_id=quote.id,
    )
    return _serialize_order(db, order)
