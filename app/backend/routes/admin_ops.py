import csv
import uuid
from datetime import datetime, timedelta
from types import SimpleNamespace
from io import StringIO
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, model_validator
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import or_, and_, func

from deps import get_db
from models.user import UserResponse
from utils.auth import get_admin_user
from utils.permissions import can_see_buying_price, require_company_permission
from utils.activity import log_activity, serialize_event
from utils.list_query import clamp_page, csv_values, paginated_payload, parse_day_end, parse_day_start
from utils.ops_stats import (
    ACTIVE_ORDER_STATUSES,
    DELIVERY_ORDER_STATUSES,
    FULFILMENT_ORDER_STATUSES,
    invoice_display_status,
)
from utils.quote_ops import (
    OVERRIDE_TARGETS_REQUIRING_PRICES,
    VALID_ACTIONS,
    all_lines_priced,
    apply_status_override,
    apply_workflow_action,
    available_status_overrides,
    compute_ops_status,
    paginate_by_ops_status,
    quote_has_order,
)
from utils.live_events import publish_entity_event
from utils.chat_attachments import (
    sanitize_attachments,
    save_chat_upload,
    serialize_quote_message,
)
from utils.sales_scope import (
    apply_order_scope,
    apply_quote_scope,
    assert_order_visible,
    assert_quote_visible,
    is_sales,
    require_assigner,
    resolve_sales_assignee_id,
    visible_organization_ids,
    _sales_agent_or_none,
)
from utils.order_lifecycle import apply_order_lifecycle_timestamps
from utils.quote_items import apply_quote_item_updates, recalc_quote_totals, sync_quote_items
from utils.facility_auth import serialize_organization, serialize_branch
from db.models import (
    User,
    Quote,
    QuoteItem,
    QuoteMessage,
    ActivityEvent,
    Order,
    OrderItem,
    Invoice,
    Organization,
    Branch,
    Shipment,
    ShipmentItem,
    ContactInquiry,
    Product,
    DeliveryLocation,
    UserBranchAssignment,
)

router = APIRouter()


class MessageAttachmentIn(BaseModel):
    type: str
    name: Optional[str] = None
    url: str
    mime: Optional[str] = None


class MessageCreate(BaseModel):
    body: str = ""
    attachments: List[MessageAttachmentIn] = []
    # "general" | "information_request" — the latter moves the quote to Awaiting Information.
    message_type: str = "general"


class WorkflowAction(BaseModel):
    action: str
    notes: Optional[str] = None


class StatusOverride(BaseModel):
    status: str
    note: str


class OrderStatusUpdate(BaseModel):
    status: Optional[str] = None
    deliveryStatus: Optional[str] = None
    notes: Optional[str] = None
    deliverySnapshot: Optional[dict] = None
    delivery_snapshot: Optional[dict] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_delivery(cls, data):
        if isinstance(data, dict) and data.get("deliverySnapshot") is None and data.get("delivery_snapshot") is not None:
            data = dict(data)
            data["deliverySnapshot"] = data.get("delivery_snapshot")
        return data


class QuoteItemDraft(BaseModel):
    id: Optional[str] = None
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    category: Optional[str] = None
    buying_price: Optional[float] = None
    unit_price: Optional[float] = None
    quoted_quantity: Optional[int] = None
    quantity: Optional[int] = None
    list_price: Optional[float] = None
    admin_notes: Optional[str] = None
    notes: Optional[str] = None


class QuoteOpsUpdate(BaseModel):
    delivery_snapshot: Optional[dict] = None
    items: Optional[List[QuoteItemDraft]] = None
    discount_amount: Optional[float] = None
    tax_rate: Optional[float] = None
    include_vat: Optional[bool] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_delivery(cls, data):
        if isinstance(data, dict) and data.get("delivery_snapshot") is None and data.get("deliverySnapshot") is not None:
            data = dict(data)
            data["delivery_snapshot"] = data.get("deliverySnapshot")
        return data


class ShipmentCreate(BaseModel):
    status: str = "processing"
    notes: Optional[str] = None
    items: List[dict] = []


class ShipmentStatusUpdate(BaseModel):
    status: str


def _actor_name(user) -> str:
    first = getattr(user, "firstName", None) or getattr(user, "first_name", None) or ""
    last = getattr(user, "lastName", None) or getattr(user, "last_name", None) or ""
    return f"{first} {last}".strip() or getattr(user, "email", "Admin")


def _quote_for_staff(db: Session, quote_id: str, user) -> Quote:
    quote = db.query(Quote).filter(Quote.id == quote_id).one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    assert_quote_visible(db, user, quote)
    return quote


def _order_for_staff(db: Session, order_id: str, user) -> Order:
    order = db.query(Order).filter(Order.id == order_id).one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    assert_order_visible(db, user, order)
    return order


def _serialize_quote_ops(db: Session, quote: Quote, items: Optional[list] = None, hide_buying: bool = False) -> dict:
    if items is None:
        items = db.query(QuoteItem).filter(QuoteItem.quote_id == quote.id).all()
    order = quote_has_order(db, quote.id)
    org = db.query(Organization).filter(Organization.id == quote.organization_id).one_or_none() if quote.organization_id else None
    branch = db.query(Branch).filter(Branch.id == quote.ordered_for_branch_id).one_or_none() if quote.ordered_for_branch_id else None
    snapshot = quote.delivery_snapshot if isinstance(quote.delivery_snapshot, dict) else {}
    branch_name = (branch.name if branch else None) or snapshot.get("branch_name")
    requested_by = db.query(User).filter(User.id == (quote.ordered_by_user_id or quote.user_id)).one_or_none()
    assigned = db.query(User).filter(User.id == quote.assigned_admin_id).one_or_none() if getattr(quote, "assigned_admin_id", None) else None
    sales_agent = db.query(User).filter(User.id == quote.assigned_sales_user_id).one_or_none() if getattr(quote, "assigned_sales_user_id", None) else None
    unread = (
        db.query(func.count(QuoteMessage.id))
        .filter(QuoteMessage.quote_id == quote.id, QuoteMessage.is_read.is_(False), QuoteMessage.sender_role == "customer")
        .scalar()
        or 0
    )
    ops_status = compute_ops_status(quote, has_order=bool(order))
    invoice = db.query(Invoice).filter(Invoice.quote_id == quote.id).first()
    product_ids = [it.product_id for it in items if it.product_id]
    products = (
        {p.id: p for p in db.query(Product).filter(Product.id.in_(product_ids)).all()}
        if product_ids
        else {}
    )
    payload = {
        "id": quote.id,
        "quote_number": quote.quote_number,
        "status": quote.status,
        "ops_status": ops_status,
        "available_actions": VALID_ACTIONS.get(ops_status, []),
        "available_status_overrides": available_status_overrides(ops_status),
        "all_lines_priced": all_lines_priced(items),
        "current_handler": quote.current_handler,
        "customer_response": quote.customer_response,
        "customer_notes": quote.customer_notes,
        "facility_name": quote.facility_name,
        "contact_person": quote.contact_person,
        "email": quote.email,
        "phone": quote.phone,
        "address": quote.address,
        "additional_notes": quote.additional_notes,
        "organization_id": quote.organization_id,
        "organization_name": org.name if org else quote.facility_name,
        "ordered_for_branch_id": quote.ordered_for_branch_id,
        "branch_name": branch_name,
        "is_guest": not bool(quote.organization_id),
        "ordered_by_user_id": quote.ordered_by_user_id,
        "requested_by": f"{requested_by.first_name} {requested_by.last_name}".strip() if requested_by else quote.contact_person,
        "assigned_admin_id": getattr(quote, "assigned_admin_id", None),
        "assigned_admin_name": f"{assigned.first_name} {assigned.last_name}".strip() if assigned else None,
        "assigned_sales_user_id": getattr(quote, "assigned_sales_user_id", None),
        "assigned_sales_name": f"{sales_agent.first_name} {sales_agent.last_name}".strip() if sales_agent else None,
        "item_count": len(items),
        "items": [
            {
                "id": it.id,
                "product_id": it.product_id,
                "product_name": it.product_name,
                "category": it.category,
                "quantity": it.quantity,
                "quoted_quantity": getattr(it, "quoted_quantity", None) or it.quantity,
                "list_price": getattr(it, "list_price", None),
                "buying_price": getattr(it, "buying_price", None),
                "unit_price": it.unit_price,
                "notes": it.notes,
                "admin_notes": getattr(it, "admin_notes", None),
                "in_stock": products[it.product_id].in_stock if it.product_id and it.product_id in products else None,
            }
            for it in items
        ],
        "discount_amount": quote.discount_amount,
        "tax_rate": quote.tax_rate,
        "tax_amount": quote.tax_amount,
        "subtotal": quote.subtotal,
        "list_subtotal": getattr(quote, "list_subtotal", 0) or 0,
        "delivery_charge": getattr(quote, "delivery_charge", 0) or 0,
        "total": quote.total,
        "include_vat": quote.include_vat,
        "quoted_at": getattr(quote, "quoted_at", None),
        "created_at": quote.created_at,
        "updated_at": quote.updated_at,
        "unread_messages": unread,
        "order_id": order.id if order else None,
        "order_number": order.order_number if order else None,
        "invoice_id": invoice.id if invoice else None,
        "invoice_number": invoice.invoice_number if invoice else None,
        "invoice_status": invoice.status if invoice else None,
        "delivery_snapshot": quote.delivery_snapshot,
        "delivery_location_id": quote.delivery_location_id,
        "last_activity": quote.updated_at or quote.created_at,
    }
    if hide_buying:
        payload["items"] = [
            {k: v for k, v in item.items() if k != "buying_price"}
            for item in payload["items"]
        ]
    from utils.totals import overlay_document_pricing
    return overlay_document_pricing(payload)


def _serialize_order_admin(db: Session, order: Order) -> dict:
    items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
    branch = db.query(Branch).filter(Branch.id == order.ordered_for_branch_id).one_or_none()
    org = db.query(Organization).filter(Organization.id == order.organization_id).one_or_none()
    ordered_by = db.query(User).filter(User.id == order.ordered_by_user_id).one_or_none()
    quote = db.query(Quote).filter(Quote.id == order.quote_id).one_or_none() if order.quote_id else None
    invoice = db.query(Invoice).filter(Invoice.quote_id == order.quote_id).first() if order.quote_id else None
    shipments = db.query(Shipment).filter(Shipment.order_id == order.id).order_by(Shipment.created_at.asc()).all()
    shipment_payload = []
    for ship in shipments:
        s_items = db.query(ShipmentItem).filter(ShipmentItem.shipment_id == ship.id).all()
        shipment_payload.append({
            "id": ship.id,
            "status": ship.status,
            "notes": ship.notes,
            "created_at": ship.created_at,
            "items": [
                {"id": si.id, "product_name": si.product_name, "quantity": si.quantity}
                for si in s_items
            ],
        })
    subtotal = sum((i.unit_price or 0) * (i.quantity or 1) for i in items)
    delivery_status = getattr(order, "delivery_status", None) or (
        shipments[-1].status if shipments else "pending"
    )
    sales_id = getattr(order, "assigned_sales_user_id", None) or (getattr(quote, "assigned_sales_user_id", None) if quote else None)
    sales_agent = db.query(User).filter(User.id == sales_id).one_or_none() if sales_id else None
    payload = {
        "id": order.id,
        "orderNumber": order.order_number,
        "status": order.status,
        "deliveryStatus": delivery_status,
        "invoiceStatus": invoice.status if invoice else "none",
        "invoiceId": invoice.id if invoice else None,
        "invoiceNumber": invoice.invoice_number if invoice else None,
        "organizationId": order.organization_id,
        "organizationName": org.name if org else None,
        "orderedForBranchId": order.ordered_for_branch_id,
        "orderedForBranchName": branch.name if branch else None,
        "orderedByUserId": order.ordered_by_user_id,
        "orderedByName": f"{ordered_by.first_name} {ordered_by.last_name}" if ordered_by else None,
        "quoteId": order.quote_id,
        "quoteNumber": quote.quote_number if quote else None,
        "assigned_sales_user_id": sales_id,
        "assigned_sales_name": f"{sales_agent.first_name} {sales_agent.last_name}".strip() if sales_agent else None,
        "deliverySnapshot": order.delivery_snapshot,
        "notes": order.notes,
        "subtotal": subtotal,
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
        "shipments": shipment_payload,
        "orderedAt": getattr(order, "ordered_at", None) or order.created_at,
        "dispatchedAt": getattr(order, "dispatched_at", None),
        "deliveredAt": getattr(order, "delivered_at", None),
        "createdAt": order.created_at,
        "updatedAt": order.updated_at,
    }
    from repositories.quotes import attach_thread_unread
    from utils.totals import overlay_document_pricing
    payload["tax_rate"] = getattr(quote, "tax_rate", None) if quote else None
    payload["include_vat"] = getattr(quote, "include_vat", True) if quote else True
    payload["delivery_charge"] = getattr(quote, "delivery_charge", 0) if quote else 0
    return attach_thread_unread(db, overlay_document_pricing(payload, items), quote_id=order.quote_id)


@router.get("/ops-stats")
async def get_ops_stats(
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    quotes = apply_quote_scope(db.query(Quote), db, current_user).all()
    orders = apply_order_scope(db.query(Order), db, current_user).all()
    invoices = [] if is_sales(current_user) else db.query(Invoice).all()
    quote_ids_with_orders = {o.quote_id for o in orders if o.quote_id}

    new_requests = 0
    awaiting_customer = 0
    accepted_awaiting_order = 0
    awaiting_information = 0
    for q in quotes:
        ops = compute_ops_status(q, has_order=q.id in quote_ids_with_orders)
        if ops == "submitted":
            new_requests += 1
        elif ops == "awaiting_customer":
            awaiting_customer += 1
        elif ops == "accepted":
            accepted_awaiting_order += 1
        elif ops == "awaiting_information":
            awaiting_information += 1

    active_orders = sum(1 for o in orders if (o.status or "") in ACTIVE_ORDER_STATUSES)
    fulfilment = sum(1 for o in orders if (o.status or "") in FULFILMENT_ORDER_STATUSES)
    deliveries = sum(1 for o in orders if (o.status or "") in DELIVERY_ORDER_STATUSES)
    outstanding = 0
    awaiting_payment = 0
    overdue = 0
    now = datetime.utcnow()
    for inv in invoices:
        bucket = invoice_display_status(inv.status, inv.due_date, now)
        if bucket == "paid":
            continue
        outstanding += 1
        if bucket == "overdue":
            overdue += 1
        else:
            awaiting_payment += 1

    unread_messages = (
        apply_quote_scope(
            db.query(func.count(QuoteMessage.id)).join(Quote, Quote.id == QuoteMessage.quote_id),
            db,
            current_user,
        )
        .filter(QuoteMessage.is_read.is_(False), QuoteMessage.sender_role == "customer")
        .scalar()
        or 0
    )
    inquiries = db.query(func.count(ContactInquiry.id)).filter(ContactInquiry.status == "new").scalar() or 0

    return {
        "new_quote_requests": new_requests,
        "quotes_awaiting_customer": awaiting_customer,
        "accepted_awaiting_order": accepted_awaiting_order,
        "awaiting_information": awaiting_information,
        "active_orders": active_orders,
        "orders_requiring_fulfilment": fulfilment,
        "deliveries_in_progress": deliveries,
        "outstanding_invoices": outstanding,
        "awaiting_payment_invoices": awaiting_payment,
        "overdue_invoices": overdue,
        "unread_customer_messages": unread_messages,
        "new_inquiries": inquiries,
    }


@router.get("/ops/quotes")
async def list_ops_quotes(
    status: Optional[str] = None,
    ops_status: Optional[str] = None,
    organization_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    search: Optional[str] = None,
    assigned_admin_id: Optional[str] = None,
    assigned_sales_user_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    page: Optional[int] = None,
    limit: int = 200,
    skip: int = 0,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    q = db.query(Quote)
    statuses = csv_values(status)
    if statuses:
        q = q.filter(Quote.status.in_(statuses))
    else:
        q = q.filter(Quote.status != "draft")
    org_ids = csv_values(organization_id)
    if org_ids:
        q = q.filter(Quote.organization_id.in_(org_ids))
    branch_ids = csv_values(branch_id)
    if branch_ids:
        q = q.filter(Quote.ordered_for_branch_id.in_(branch_ids))
    admin_ids = csv_values(assigned_admin_id)
    if admin_ids:
        q = q.filter(Quote.assigned_admin_id.in_(admin_ids))
    sales_ids = csv_values(assigned_sales_user_id)
    if sales_ids:
        q = q.filter(Quote.assigned_sales_user_id.in_(sales_ids))
    q = apply_quote_scope(q, db, current_user)
    if search:
        like = f"%{search}%"
        q = q.filter(
            or_(
                Quote.quote_number.ilike(like),
                Quote.facility_name.ilike(like),
                Quote.contact_person.ilike(like),
                Quote.email.ilike(like),
            )
        )
    if from_date:
        try:
            q = q.filter(Quote.created_at >= parse_day_start(from_date))
        except ValueError:
            pass
    if to_date:
        try:
            q = q.filter(Quote.created_at < parse_day_end(to_date))
        except ValueError:
            pass

    wanted_ops = [value for value in csv_values(ops_status) if value != "all"]
    if page is not None:
        page_n, limit_n, skip_n = clamp_page(page, limit)
        id_rows = (
            q.with_entities(Quote.id, Quote.status, Quote.current_handler)
            .order_by(Quote.created_at.desc())
            .all()
        )
        order_ids = {
            row[0]
            for row in db.query(Order.quote_id).filter(Order.quote_id.isnot(None)).distinct().all()
        }
        light = [
            SimpleNamespace(id=row.id, status=row.status, current_handler=row.current_handler)
            for row in id_rows
        ]
        page_light, total = paginate_by_ops_status(light, order_ids, wanted_ops, skip_n, limit_n)
        page_ids = [row.id for row in page_light]
        by_id = {
            row.id: row
            for row in (db.query(Quote).filter(Quote.id.in_(page_ids)).all() if page_ids else [])
        }
        rows = [by_id[qid] for qid in page_ids if qid in by_id]
    else:
        rows = q.order_by(Quote.created_at.desc()).offset(skip).limit(limit).all()
        total = None
    quote_ids = [r.id for r in rows]
    items = db.query(QuoteItem).filter(QuoteItem.quote_id.in_(quote_ids)).all() if quote_ids else []
    items_by = {qid: [] for qid in quote_ids}
    for it in items:
        items_by.setdefault(it.quote_id, []).append(it)

    hide_buying = not can_see_buying_price(current_user.role)
    payload = [_serialize_quote_ops(db, row, items_by.get(row.id, []), hide_buying=hide_buying) for row in rows]
    if page is None:
        if wanted_ops:
            payload = [p for p in payload if p["ops_status"] in wanted_ops]
        return {"quotes": payload, "total": len(payload)}
    body = paginated_payload(payload, total, page_n, limit_n)
    body["quotes"] = payload
    return body


@router.get("/ops/quotes/{quote_id}")
async def get_ops_quote(
    quote_id: str,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    quote = _quote_for_staff(db, quote_id, current_user)
    return _serialize_quote_ops(db, quote, hide_buying=not can_see_buying_price(current_user.role))


class SalesAssignBody(BaseModel):
    assigned_sales_user_id: Optional[str] = None


def _assign_sales_to_quote(db: Session, quote: Quote, agent_id: Optional[str], actor) -> None:
    quote.assigned_sales_user_id = agent_id
    db.query(Order).filter(Order.quote_id == quote.id).update(
        {"assigned_sales_user_id": agent_id},
        synchronize_session=False,
    )
    name = _actor_name(actor)
    agent = db.query(User).filter(User.id == agent_id).one_or_none() if agent_id else None
    agent_name = f"{agent.first_name} {agent.last_name}".strip() if agent else "unassigned"
    log_activity(
        db,
        entity_type="quote",
        entity_id=quote.id,
        event_type="assignment",
        summary=f"{name} assigned this quote to {agent_name}",
        actor_id=actor.id,
        actor_name=name,
        actor_role=actor.role,
        field_name="assigned_sales_user_id",
        new_value=agent_id,
        is_customer_visible=False,
    )


@router.post("/ops/quotes/{quote_id}/assign")
async def assign_quote_sales_agent(
    quote_id: str,
    payload: SalesAssignBody,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    require_assigner(current_user)
    quote = _quote_for_staff(db, quote_id, current_user)
    agent_id = None
    if payload.assigned_sales_user_id:
        agent = _sales_agent_or_none(db, payload.assigned_sales_user_id)
        agent_id = agent.id if agent else None
    _assign_sales_to_quote(db, quote, agent_id, current_user)
    db.commit()
    db.refresh(quote)
    return _serialize_quote_ops(db, quote, hide_buying=not can_see_buying_price(current_user.role))


@router.get("/ops/quotes/{quote_id}/download")
async def download_ops_quote_pdf(
    quote_id: str,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    quote = _quote_for_staff(db, quote_id, current_user)
    from routes.quotes import _stream_quote_pdf
    return await _stream_quote_pdf(db, quote)


def _merge_delivery_snapshot(existing, incoming: dict) -> dict:
    merged = dict(existing or {})
    for key, value in (incoming or {}).items():
        merged[key] = value
    return dict(merged)


def _apply_delivery_snapshot(entity, incoming: dict) -> None:
    entity.delivery_snapshot = _merge_delivery_snapshot(getattr(entity, "delivery_snapshot", None), incoming)
    flag_modified(entity, "delivery_snapshot")


@router.patch("/ops/quotes/{quote_id}")
async def update_ops_quote(
    quote_id: str,
    payload: QuoteOpsUpdate,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    quote = _quote_for_staff(db, quote_id, current_user)
    if quote_has_order(db, quote.id):
        raise HTTPException(status_code=400, detail="This quote has been converted to an order and cannot be edited")
    actor = _actor_name(current_user)
    changed = False
    event_type = "quote.updated"
    if payload.delivery_snapshot is not None:
        _apply_delivery_snapshot(quote, payload.delivery_snapshot)
        linked_order = quote_has_order(db, quote.id)
        if linked_order:
            _apply_delivery_snapshot(linked_order, payload.delivery_snapshot)
        log_activity(
            db,
            entity_type="quote",
            entity_id=quote.id,
            event_type="delivery_update",
            summary=f"{actor} updated delivery details",
            actor_id=current_user.id,
            actor_name=actor,
            actor_role="admin",
        )
        changed = True
        event_type = "delivery.updated"
    existing_items = db.query(QuoteItem).filter(QuoteItem.quote_id == quote_id).all()
    if payload.items is not None:
        from repositories.quotes import customer_snapshot_from_payload, _serialize_quote_with_items
        if not quote.customer_snapshot:
            quote.customer_snapshot = customer_snapshot_from_payload(
                _serialize_quote_with_items(quote, existing_items)
            )
            flag_modified(quote, "customer_snapshot")
        existing_items = sync_quote_items(
            db,
            quote_id,
            existing_items,
            payload.items,
            allow_buying=can_see_buying_price(current_user.role),
        )
        recalc_quote_totals(
            quote,
            existing_items,
            discount=payload.discount_amount if payload.discount_amount is not None else quote.discount_amount,
            tax_rate=payload.tax_rate if payload.tax_rate is not None else quote.tax_rate,
            include_vat=payload.include_vat if payload.include_vat is not None else quote.include_vat,
        )
        log_activity(
            db,
            entity_type="quote",
            entity_id=quote.id,
            event_type="pricing_saved",
            summary=f"{actor} saved quote pricing",
            actor_id=current_user.id,
            actor_name=actor,
            actor_role="admin",
        )
        changed = True
        event_type = "quote.drafted"
    elif payload.discount_amount is not None or payload.tax_rate is not None or payload.include_vat is not None:
        recalc_quote_totals(
            quote,
            existing_items,
            discount=payload.discount_amount,
            tax_rate=payload.tax_rate,
            include_vat=payload.include_vat,
        )
        changed = True
        event_type = "quote.drafted" if event_type != "delivery.updated" else event_type
    if changed:
        quote.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(quote)
        publish_entity_event(
            event_type,
            entity_type="quote",
            entity_id=quote.id,
            organization_id=quote.organization_id,
            quote_id=quote.id,
            staff_only=event_type in ("quote.drafted", "quote.priced"),
        )
    return _serialize_quote_ops(db, quote, hide_buying=not can_see_buying_price(current_user.role))


@router.post("/ops/quotes/{quote_id}/workflow")
async def quote_workflow(
    quote_id: str,
    body: WorkflowAction,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    quote = _quote_for_staff(db, quote_id, current_user)

    order = quote_has_order(db, quote_id)
    ops = compute_ops_status(quote, has_order=bool(order))
    action = (body.action or "").strip()
    if action not in VALID_ACTIONS.get(ops, []):
        raise HTTPException(status_code=400, detail=f"Action '{action}' is not valid for status '{ops}'")

    actor = _actor_name(current_user)

    if action == "create_order":
        items = db.query(QuoteItem).filter(QuoteItem.quote_id == quote_id).all()
        if not all_lines_priced(items):
            raise HTTPException(status_code=400, detail="Every line needs a quoted price before an order can be created")
        created = create_order_from_quote(db, quote, items, acting_user_id=current_user.id)
        log_activity(
            db,
            entity_type="quote",
            entity_id=quote.id,
            event_type="order_created",
            summary=f"{actor} created order {created.order_number}",
            actor_id=current_user.id,
            actor_name=actor,
            actor_role="admin",
        )
        log_activity(
            db,
            entity_type="order",
            entity_id=created.id,
            event_type="created",
            summary=f"Order {created.order_number} created from {quote.quote_number}",
            actor_id=current_user.id,
            actor_name=actor,
            actor_role="admin",
            commit=True,
        )
        publish_entity_event(
            "order.updated",
            entity_type="order",
            entity_id=created.id,
            organization_id=quote.organization_id,
            quote_id=quote.id,
            order_id=created.id,
        )
        publish_entity_event(
            "quote.updated",
            entity_type="quote",
            entity_id=quote.id,
            organization_id=quote.organization_id,
            quote_id=quote.id,
        )
        return {"message": "Order created", "order": _serialize_order_admin(db, created)}

    if action in ("send_quote", "resend"):
        items = db.query(QuoteItem).filter(QuoteItem.quote_id == quote_id).all()
        if not all_lines_priced(items):
            raise HTTPException(status_code=400, detail="Every line needs a quoted price before the quote can be sent")

    previous = quote.status
    previous_handler = quote.current_handler
    try:
        new_status, new_handler = apply_workflow_action(quote, action)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    quote.status = new_status
    quote.current_handler = new_handler
    if action in ("send_quote", "resend"):
        quote.customer_response = None
        quote.quoted_at = datetime.utcnow()
        quote.quoted_by_user_id = current_user.id
    if not quote.assigned_admin_id:
        quote.assigned_admin_id = current_user.id
    quote.updated_at = datetime.utcnow()
    summary = f"{actor} performed '{action.replace('_', ' ')}'"
    if body.notes and body.notes.strip():
        summary = f"{summary}: {body.notes.strip()}"
    log_activity(
        db,
        entity_type="quote",
        entity_id=quote.id,
        event_type="status_change",
        summary=summary,
        actor_id=current_user.id,
        actor_name=actor,
        actor_role="admin",
        field_name="status",
        previous_value=f"{previous}/{previous_handler}",
        new_value=f"{new_status}/{new_handler}",
        is_customer_visible=action in ("send_quote", "resend", "request_information"),
        commit=True,
    )
    publish_entity_event(
        "quote.updated",
        entity_type="quote",
        entity_id=quote.id,
        organization_id=quote.organization_id,
        quote_id=quote.id,
    )
    return _serialize_quote_ops(db, quote, hide_buying=not can_see_buying_price(current_user.role))


@router.post("/ops/quotes/{quote_id}/status")
async def override_quote_status(
    quote_id: str,
    body: StatusOverride,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Staff move a quote to an explicit status on the customer's behalf.

    A note is mandatory and is recorded in the activity trail. Setting
    "accepted" does not create an order; staff then click Create Order.
    """
    quote = _quote_for_staff(db, quote_id, current_user)

    note = (body.note or "").strip()
    if len(note) < 3:
        raise HTTPException(status_code=400, detail="A note explaining the status change is required")

    order = quote_has_order(db, quote_id)
    ops = compute_ops_status(quote, has_order=bool(order))
    target = (body.status or "").strip().lower()
    if target not in available_status_overrides(ops):
        raise HTTPException(status_code=400, detail=f"Cannot change a quote from '{ops}' to '{target}'")

    if target in OVERRIDE_TARGETS_REQUIRING_PRICES:
        items = db.query(QuoteItem).filter(QuoteItem.quote_id == quote_id).all()
        if not all_lines_priced(items):
            raise HTTPException(status_code=400, detail="Every line needs a quoted price before the quote can be marked as sent or accepted")

    try:
        new_status, new_handler, customer_response = apply_status_override(target)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    actor = _actor_name(current_user)
    previous = quote.status
    previous_handler = quote.current_handler
    now = datetime.utcnow()
    quote.status = new_status
    quote.current_handler = new_handler
    quote.customer_response = customer_response
    if target == "awaiting_customer" and not quote.quoted_at:
        quote.quoted_at = now
        quote.quoted_by_user_id = current_user.id
    if target == "rejected":
        quote.customer_notes = note
    if not quote.assigned_admin_id:
        quote.assigned_admin_id = current_user.id
    quote.updated_at = now

    label = target.replace("_", " ")
    log_activity(
        db,
        entity_type="quote",
        entity_id=quote.id,
        event_type="status_override",
        summary=f"{actor} changed status to '{label}': {note}",
        actor_id=current_user.id,
        actor_name=actor,
        actor_role="admin",
        field_name="status",
        previous_value=f"{previous}/{previous_handler}",
        new_value=f"{new_status}/{new_handler}",
        is_customer_visible=target in ("awaiting_customer", "accepted", "rejected", "cancelled"),
        commit=True,
    )
    publish_entity_event(
        "quote.updated",
        entity_type="quote",
        entity_id=quote.id,
        organization_id=quote.organization_id,
        quote_id=quote.id,
    )
    return _serialize_quote_ops(db, quote, hide_buying=not can_see_buying_price(current_user.role))


def _serialize_message(msg: QuoteMessage) -> dict:
    return serialize_quote_message(msg)


@router.get("/ops/quotes/{quote_id}/messages")
async def list_quote_messages_admin(
    quote_id: str,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    quote = _quote_for_staff(db, quote_id, current_user)
    messages = (
        db.query(QuoteMessage)
        .filter(QuoteMessage.quote_id == quote_id)
        .order_by(QuoteMessage.created_at.asc())
        .all()
    )
    unread = [m for m in messages if m.sender_role == "customer" and not m.is_read]
    for m in unread:
        m.is_read = True
    if unread:
        db.commit()
    return [_serialize_message(m) for m in messages]


@router.post("/ops/quotes/{quote_id}/messages")
async def send_quote_message_admin(
    quote_id: str,
    body: MessageCreate,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    quote = _quote_for_staff(db, quote_id, current_user)
    text = (body.body or "").strip()
    attachments = sanitize_attachments([a.model_dump() for a in (body.attachments or [])])
    if not text and not attachments:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    message_type = (body.message_type or "general").strip().lower()
    if message_type not in ("general", "information_request"):
        raise HTTPException(status_code=400, detail="message_type must be 'general' or 'information_request'")
    ops = compute_ops_status(quote, has_order=bool(quote_has_order(db, quote_id)))
    request_info = message_type == "information_request"
    if request_info and "request_information" not in VALID_ACTIONS.get(ops, []) and ops != "awaiting_information":
        raise HTTPException(status_code=400, detail=f"Cannot request information while the quote is '{ops.replace('_', ' ')}'")

    actor = _actor_name(current_user)
    msg = QuoteMessage(
        id=str(uuid.uuid4()),
        quote_id=quote_id,
        sender_id=current_user.id,
        sender_role="admin",
        sender_name=actor,
        body=text,
        attachments=attachments,
        is_read=False,
        created_at=datetime.utcnow(),
    )
    db.add(msg)
    log_activity(
        db,
        entity_type="quote",
        entity_id=quote_id,
        event_type="message",
        summary=f"{actor} sent a message to the customer" if not request_info else f"{actor} requested more information from the customer",
        actor_id=current_user.id,
        actor_name=actor,
        actor_role="admin",
    )

    status_changed = False
    if request_info:
        if "request_information" in VALID_ACTIONS.get(ops, []):
            previous = quote.status
            previous_handler = quote.current_handler
            quote.status, quote.current_handler = apply_workflow_action(quote, "request_information")
            if not quote.assigned_admin_id:
                quote.assigned_admin_id = current_user.id
            quote.updated_at = datetime.utcnow()
            status_changed = True
            log_activity(
                db,
                entity_type="quote",
                entity_id=quote.id,
                event_type="status_change",
                summary=f"Quote moved to awaiting information",
                actor_id=current_user.id,
                actor_name=actor,
                actor_role="admin",
                field_name="status",
                previous_value=f"{previous}/{previous_handler}",
                new_value=f"{quote.status}/{quote.current_handler}",
                is_customer_visible=True,
            )

    db.commit()
    db.refresh(msg)
    publish_entity_event(
        "message.created",
        entity_type="quote",
        entity_id=quote_id,
        organization_id=quote.organization_id,
        quote_id=quote_id,
    )
    if status_changed:
        publish_entity_event(
            "quote.updated",
            entity_type="quote",
            entity_id=quote_id,
            organization_id=quote.organization_id,
            quote_id=quote_id,
        )
    return _serialize_message(msg)


@router.post("/ops/quotes/{quote_id}/messages/attachments")
async def upload_quote_message_attachment_admin(
    quote_id: str,
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    quote = _quote_for_staff(db, quote_id, current_user)
    content = await file.read()
    return save_chat_upload(file, content)


@router.get("/ops/quotes/{quote_id}/timeline")
async def quote_timeline(
    quote_id: str,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    quote = _quote_for_staff(db, quote_id, current_user)
    events = (
        db.query(ActivityEvent)
        .filter(ActivityEvent.entity_type == "quote", ActivityEvent.entity_id == quote_id)
        .order_by(ActivityEvent.created_at.asc())
        .all()
    )
    payload = [serialize_event(e) for e in events]
    if not payload:
        payload.append({
            "id": "created",
            "entity_type": "quote",
            "entity_id": quote_id,
            "event_type": "submitted",
            "actor_name": quote.contact_person,
            "actor_role": "customer",
            "summary": f"{quote.contact_person} submitted quote {quote.quote_number or quote_id[:8]}",
            "created_at": quote.created_at,
            "is_customer_visible": True,
        })
    return payload


def _message_rows(db: Session, messages: list) -> list:
    quote_ids = {m.quote_id for m in messages}
    quotes = {q.id: q for q in db.query(Quote).filter(Quote.id.in_(quote_ids)).all()} if quote_ids else {}
    return [
        {
            **_serialize_message(m),
            "quote_number": quotes.get(m.quote_id).quote_number if quotes.get(m.quote_id) else None,
            "facility_name": quotes.get(m.quote_id).facility_name if quotes.get(m.quote_id) else None,
        }
        for m in messages
    ]


@router.get("/ops/messages")
async def list_unread_customer_messages(
    unread: bool = False,
    search: Optional[str] = None,
    page: Optional[int] = None,
    limit: int = 20,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    query = (
        db.query(QuoteMessage)
        .join(Quote, Quote.id == QuoteMessage.quote_id)
        .filter(QuoteMessage.sender_role == "customer")
    )
    query = apply_quote_scope(query, db, current_user)
    if unread:
        query = query.filter(QuoteMessage.is_read.is_(False))
    if search and search.strip():
        like = f"%{search.strip()}%"
        query = query.filter(
            or_(
                QuoteMessage.sender_name.ilike(like),
                QuoteMessage.body.ilike(like),
                Quote.quote_number.ilike(like),
                Quote.facility_name.ilike(like),
            )
        )
    query = query.order_by(QuoteMessage.is_read.asc(), QuoteMessage.created_at.desc())
    if page is None:
        return _message_rows(db, query.limit(100).all())
    page_n, limit_n, skip = clamp_page(page, limit)
    total = query.count()
    body = paginated_payload(_message_rows(db, query.offset(skip).limit(limit_n).all()), total, page_n, limit_n)
    body["messages"] = body["items"]
    return body


@router.get("/ops/orders")
async def list_admin_orders(
    status: Optional[str] = None,
    organization_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    assigned_sales_user_id: Optional[str] = None,
    search: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    page: Optional[int] = None,
    limit: int = 20,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    q = db.query(Order)
    q = apply_order_scope(q, db, current_user)
    statuses = csv_values(status)
    if statuses:
        q = q.filter(Order.status.in_(statuses))
    org_ids = csv_values(organization_id)
    if org_ids:
        q = q.filter(Order.organization_id.in_(org_ids))
    sales_ids = csv_values(assigned_sales_user_id)
    if sales_ids:
        q = q.filter(Order.assigned_sales_user_id.in_(sales_ids))
    branch_ids = csv_values(branch_id)
    if branch_ids:
        q = q.filter(Order.ordered_for_branch_id.in_(branch_ids))
    if search:
        like = f"%{search}%"
        q = q.filter(or_(Order.order_number.ilike(like), Order.notes.ilike(like)))
    if from_date:
        try:
            q = q.filter(Order.created_at >= parse_day_start(from_date))
        except ValueError:
            pass
    if to_date:
        try:
            q = q.filter(Order.created_at < parse_day_end(to_date))
        except ValueError:
            pass
    ordered = q.order_by(Order.created_at.desc())
    if page is None:
        return [_serialize_order_admin(db, o) for o in ordered.limit(200).all()]
    page_n, limit_n, skip = clamp_page(page, limit)
    total = q.count()
    body = paginated_payload(
        [_serialize_order_admin(db, o) for o in ordered.offset(skip).limit(limit_n).all()],
        total,
        page_n,
        limit_n,
    )
    body["orders"] = body["items"]
    return body


@router.get("/ops/orders/{order_id}")
async def get_admin_order(
    order_id: str,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    order = _order_for_staff(db, order_id, current_user)
    return _serialize_order_admin(db, order)


@router.post("/ops/orders/{order_id}/assign")
async def assign_order_sales_agent(
    order_id: str,
    payload: SalesAssignBody,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    require_assigner(current_user)
    order = _order_for_staff(db, order_id, current_user)
    agent_id = None
    if payload.assigned_sales_user_id:
        agent = _sales_agent_or_none(db, payload.assigned_sales_user_id)
        agent_id = agent.id if agent else None
    order.assigned_sales_user_id = agent_id
    if order.quote_id:
        quote = db.query(Quote).filter(Quote.id == order.quote_id).one_or_none()
        if quote:
            quote.assigned_sales_user_id = agent_id
    name = _actor_name(current_user)
    agent = db.query(User).filter(User.id == agent_id).one_or_none() if agent_id else None
    agent_name = f"{agent.first_name} {agent.last_name}".strip() if agent else "unassigned"
    log_activity(
        db,
        entity_type="order",
        entity_id=order.id,
        event_type="assignment",
        summary=f"{name} assigned this order to {agent_name}",
        actor_id=current_user.id,
        actor_name=name,
        actor_role=current_user.role,
        field_name="assigned_sales_user_id",
        new_value=agent_id,
        is_customer_visible=False,
    )
    db.commit()
    db.refresh(order)
    return _serialize_order_admin(db, order)


@router.patch("/ops/orders/{order_id}")
async def update_admin_order(
    order_id: str,
    payload: OrderStatusUpdate,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    order = _order_for_staff(db, order_id, current_user)
    existing_invoice = (
        db.query(Invoice).filter(Invoice.quote_id == order.quote_id).first()
        if order.quote_id
        else None
    )
    if existing_invoice:
        raise HTTPException(status_code=400, detail="This order has been invoiced and cannot be edited")
    previous = order.status
    previous_delivery = getattr(order, "delivery_status", None)
    if payload.status:
        order.status = payload.status
    if payload.deliveryStatus:
        order.delivery_status = payload.deliveryStatus
    if payload.notes is not None:
        order.notes = payload.notes
    if payload.deliverySnapshot is not None:
        _apply_delivery_snapshot(order, payload.deliverySnapshot)
        if order.quote_id:
            source_quote = db.query(Quote).filter(Quote.id == order.quote_id).one_or_none()
            if source_quote:
                _apply_delivery_snapshot(source_quote, payload.deliverySnapshot)
        actor = _actor_name(current_user)
        log_activity(
            db,
            entity_type="order",
            entity_id=order.id,
            event_type="delivery_update",
            summary=f"{actor} updated delivery details",
            actor_id=current_user.id,
            actor_name=actor,
            actor_role="admin",
        )
    order.updated_at = datetime.utcnow()
    apply_order_lifecycle_timestamps(
        order,
        new_status=payload.status if payload.status else None,
        new_delivery_status=payload.deliveryStatus if payload.deliveryStatus else None,
        now=order.updated_at,
    )
    actor = _actor_name(current_user)
    if payload.status and payload.status != previous:
        log_activity(
            db,
            entity_type="order",
            entity_id=order.id,
            event_type="status_change",
            summary=f"{actor} changed order status to {payload.status.replace('_', ' ')}",
            actor_id=current_user.id,
            actor_name=actor,
            actor_role="admin",
            field_name="status",
            previous_value=previous,
            new_value=payload.status,
        )
    if payload.deliveryStatus and payload.deliveryStatus != previous_delivery:
        log_activity(
            db,
            entity_type="order",
            entity_id=order.id,
            event_type="status_change",
            summary=f"{actor} changed delivery status to {payload.deliveryStatus.replace('_', ' ')}",
            actor_id=current_user.id,
            actor_name=actor,
            actor_role="admin",
            field_name="delivery_status",
            previous_value=previous_delivery,
            new_value=payload.deliveryStatus,
            is_customer_visible=True,
        )
    db.commit()
    event_name = "delivery.updated" if payload.deliverySnapshot or payload.deliveryStatus else "order.updated"
    publish_entity_event(
        event_name,
        entity_type="order",
        entity_id=order.id,
        organization_id=order.organization_id,
        order_id=order.id,
        quote_id=order.quote_id,
    )
    return _serialize_order_admin(db, order)


@router.post("/ops/orders/{order_id}/shipments")
async def create_shipment(
    order_id: str,
    payload: ShipmentCreate,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    order = _order_for_staff(db, order_id, current_user)
    ship_id = str(uuid.uuid4())
    ship = Shipment(
        id=ship_id,
        order_id=order_id,
        status=payload.status or "processing",
        notes=payload.notes,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(ship)
    for item in payload.items or []:
        db.add(
            ShipmentItem(
                id=str(uuid.uuid4()),
                shipment_id=ship_id,
                order_item_id=item.get("order_item_id"),
                product_id=item.get("product_id"),
                product_name=item.get("product_name") or "Item",
                quantity=int(item.get("quantity") or 1),
            )
        )
    actor = _actor_name(current_user)
    log_activity(
        db,
        entity_type="order",
        entity_id=order_id,
        event_type="shipment_created",
        summary=f"{actor} created a shipment ({payload.status})",
        actor_id=current_user.id,
        actor_name=actor,
        actor_role="admin",
        commit=True,
    )
    publish_entity_event(
        "order.updated",
        entity_type="order",
        entity_id=order_id,
        organization_id=order.organization_id,
        order_id=order_id,
        quote_id=order.quote_id,
    )
    return _serialize_order_admin(db, order)


@router.patch("/ops/orders/{order_id}/shipments/{shipment_id}")
async def update_shipment(
    order_id: str,
    shipment_id: str,
    payload: ShipmentStatusUpdate,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    order = _order_for_staff(db, order_id, current_user)
    ship = (
        db.query(Shipment)
        .filter(Shipment.id == shipment_id, Shipment.order_id == order_id)
        .one_or_none()
    )
    if not ship:
        raise HTTPException(status_code=404, detail="Shipment not found")
    previous = ship.status
    ship.status = payload.status
    ship.updated_at = datetime.utcnow()
    actor = _actor_name(current_user)
    log_activity(
        db,
        entity_type="order",
        entity_id=order_id,
        event_type="shipment_status",
        summary=f"{actor} updated shipment to {payload.status.replace('_', ' ')}",
        actor_id=current_user.id,
        actor_name=actor,
        actor_role="admin",
        field_name="shipment_status",
        previous_value=previous,
        new_value=payload.status,
        is_customer_visible=True,
        commit=True,
    )
    publish_entity_event(
        "order.updated",
        entity_type="order",
        entity_id=order_id,
        organization_id=order.organization_id,
        order_id=order_id,
        quote_id=order.quote_id,
    )
    return _serialize_order_admin(db, order)


@router.get("/ops/orders/{order_id}/timeline")
async def order_timeline(
    order_id: str,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    order = _order_for_staff(db, order_id, current_user)
    filters = [
        and_(ActivityEvent.entity_type == "order", ActivityEvent.entity_id == order_id)
    ]
    if order.quote_id:
        filters.append(
            and_(ActivityEvent.entity_type == "quote", ActivityEvent.entity_id == order.quote_id)
        )
    events = (
        db.query(ActivityEvent)
        .filter(or_(*filters))
        .order_by(ActivityEvent.created_at.asc())
        .all()
    )
    return [serialize_event(e) for e in events]


@router.get("/ops/admins")
async def list_ops_admins(
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    admins = (
        db.query(User)
        .filter(User.role.in_(("admin", "operations", "sales")), User.organization_id.is_(None))
        .order_by(User.first_name.asc())
        .all()
    )
    return [
        {
            "id": u.id,
            "name": f"{u.first_name} {u.last_name}".strip(),
            "email": u.email,
        }
        for u in admins
    ]


@router.get("/ops/delivery-locations")
async def list_ops_delivery_locations(
    organization_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    search: Optional[str] = None,
    current_user: UserResponse = Depends(get_admin_user),
    _: UserResponse = Depends(require_company_permission("deliveries")),
    db: Session = Depends(get_db),
):
    q = db.query(DeliveryLocation)
    org_ids = csv_values(organization_id)
    if org_ids:
        q = q.filter(DeliveryLocation.organization_id.in_(org_ids))
    branch_ids = csv_values(branch_id)
    if branch_ids:
        q = q.filter(DeliveryLocation.branch_id.in_(branch_ids))
    if search:
        like = f"%{search}%"
        q = q.filter(
            or_(
                DeliveryLocation.label.ilike(like),
                DeliveryLocation.address_line.ilike(like),
                DeliveryLocation.contact_name.ilike(like),
            )
        )
    locations = q.order_by(DeliveryLocation.label.asc()).limit(500).all()
    org_ids = {loc.organization_id for loc in locations if loc.organization_id}
    branch_ids = {loc.branch_id for loc in locations if loc.branch_id}
    orgs = {o.id: o for o in db.query(Organization).filter(Organization.id.in_(org_ids)).all()} if org_ids else {}
    branches = {b.id: b for b in db.query(Branch).filter(Branch.id.in_(branch_ids)).all()} if branch_ids else {}
    return [
        {
            "id": loc.id,
            "label": loc.label,
            "contactName": loc.contact_name,
            "phone": loc.phone,
            "email": loc.email,
            "addressLine": loc.address_line,
            "county": loc.county,
            "country": loc.country,
            "deliveryInstructions": loc.delivery_instructions,
            "isDefault": loc.is_default,
            "organizationId": loc.organization_id,
            "organizationName": orgs[loc.organization_id].name if loc.organization_id in orgs else None,
            "branchId": loc.branch_id,
            "branchName": branches[loc.branch_id].name if loc.branch_id in branches else None,
        }
        for loc in locations
    ]


@router.get("/ops/organizations")
async def list_admin_organizations(
    search: Optional[str] = None,
    facility_type: Optional[str] = None,
    county: Optional[str] = None,
    page: Optional[int] = None,
    limit: int = 20,
    scope: Optional[str] = None,
    current_user: UserResponse = Depends(require_company_permission("facilities", "quotes", "orders")),
    db: Session = Depends(get_db),
):
    q = db.query(Organization)
    filter_scope = (scope or "").strip().lower() or None
    if filter_scope not in (None, "quotes", "orders"):
        raise HTTPException(status_code=400, detail="scope must be quotes or orders")
    scoped_ids = visible_organization_ids(db, current_user, scope=filter_scope)
    if scoped_ids is not None:
        if not scoped_ids:
            q = q.filter(Organization.id.is_(None))
        else:
            q = q.filter(Organization.id.in_(scoped_ids))
    if search:
        like = f"%{search}%"
        q = q.filter(or_(
            Organization.name.ilike(like),
            Organization.email.ilike(like),
            Organization.phone.ilike(like),
            Organization.county.ilike(like),
        ))
    facility_types = csv_values(facility_type)
    if facility_types:
        q = q.filter(Organization.facility_type.in_(facility_types))
    counties = csv_values(county)
    if counties:
        q = q.filter(Organization.county.in_(counties))

    from utils.list_query import clamp_page, paginated_payload

    paginate = page is not None
    if paginate:
        page_n, limit_n, skip = clamp_page(page, limit)
        total = q.count()
        orgs = q.order_by(Organization.name.asc()).offset(skip).limit(limit_n).all()
    else:
        orgs = q.order_by(Organization.name.asc()).all()
        page_n = limit_n = total = None

    org_ids = [org.id for org in orgs]
    branch_counts = dict(
        db.query(Branch.organization_id, func.count(Branch.id))
        .filter(Branch.organization_id.in_(org_ids))
        .group_by(Branch.organization_id)
        .all()
    ) if org_ids else {}
    quote_counts = dict(
        db.query(Quote.organization_id, func.count(Quote.id))
        .filter(Quote.organization_id.in_(org_ids))
        .group_by(Quote.organization_id)
        .all()
    ) if org_ids else {}
    order_counts = dict(
        db.query(Order.organization_id, func.count(Order.id))
        .filter(Order.organization_id.in_(org_ids))
        .group_by(Order.organization_id)
        .all()
    ) if org_ids else {}

    branches_by_org = {}
    if not paginate and org_ids:
        for branch in db.query(Branch).filter(Branch.organization_id.in_(org_ids)).order_by(Branch.name.asc()).all():
            branches_by_org.setdefault(branch.organization_id, []).append(serialize_branch(branch))

    payload = []
    for org in orgs:
        item = {
            **serialize_organization(org),
            "branchCount": branch_counts.get(org.id, 0),
            "quoteCount": quote_counts.get(org.id, 0),
            "orderCount": order_counts.get(org.id, 0),
        }
        if not paginate:
            item["branches"] = branches_by_org.get(org.id, [])
        payload.append(item)

    if not paginate:
        return payload

    facility_types = [
        row[0] for row in db.query(Organization.facility_type).distinct().order_by(Organization.facility_type.asc()).all()
        if row[0]
    ]
    counties = [
        row[0] for row in db.query(Organization.county).distinct().order_by(Organization.county.asc()).all()
        if row[0]
    ]
    result = paginated_payload(payload, total, page_n, limit_n)
    result["facilityTypes"] = facility_types
    result["counties"] = counties
    return result


@router.get("/ops/organizations/export")
async def export_admin_organizations(
    search: Optional[str] = None,
    facility_type: Optional[str] = None,
    county: Optional[str] = None,
    current_user: UserResponse = Depends(get_admin_user),
    _: UserResponse = Depends(require_company_permission("facilities")),
    db: Session = Depends(get_db),
):
    q = db.query(Organization)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(
            Organization.name.ilike(like),
            Organization.email.ilike(like),
            Organization.phone.ilike(like),
            Organization.county.ilike(like),
        ))
    facility_types = csv_values(facility_type)
    if facility_types:
        q = q.filter(Organization.facility_type.in_(facility_types))
    counties = csv_values(county)
    if counties:
        q = q.filter(Organization.county.in_(counties))
    orgs = q.order_by(Organization.name.asc()).all()
    org_ids = [org.id for org in orgs]
    branch_counts = dict(
        db.query(Branch.organization_id, func.count(Branch.id))
        .filter(Branch.organization_id.in_(org_ids))
        .group_by(Branch.organization_id)
        .all()
    ) if org_ids else {}
    quote_counts = dict(
        db.query(Quote.organization_id, func.count(Quote.id))
        .filter(Quote.organization_id.in_(org_ids))
        .group_by(Quote.organization_id)
        .all()
    ) if org_ids else {}
    order_counts = dict(
        db.query(Order.organization_id, func.count(Order.id))
        .filter(Order.organization_id.in_(org_ids))
        .group_by(Order.organization_id)
        .all()
    ) if org_ids else {}
    buf = StringIO()
    writer = csv.DictWriter(buf, fieldnames=[
        "name", "facility_type", "county", "country", "email", "phone",
        "address", "branches", "quotes", "orders",
    ])
    writer.writeheader()
    for org in orgs:
        writer.writerow({
            "name": org.name,
            "facility_type": org.facility_type or "",
            "county": org.county or "",
            "country": org.country or "",
            "email": org.email or "",
            "phone": org.phone or "",
            "address": org.address_line or "",
            "branches": branch_counts.get(org.id, 0),
            "quotes": quote_counts.get(org.id, 0),
            "orders": order_counts.get(org.id, 0),
        })
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="facilities.csv"'},
    )


@router.get("/ops/organizations/{org_id}")
async def get_admin_organization(
    org_id: str,
    current_user: UserResponse = Depends(get_admin_user),
    _: UserResponse = Depends(require_company_permission("facilities")),
    db: Session = Depends(get_db),
):
    org = db.query(Organization).filter(Organization.id == org_id).one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    branches = db.query(Branch).filter(Branch.organization_id == org.id).order_by(Branch.is_main.desc(), Branch.name.asc()).all()
    users = db.query(User).filter(User.organization_id == org.id).order_by(User.first_name.asc(), User.last_name.asc()).all()
    quotes = db.query(Quote).filter(Quote.organization_id == org.id).order_by(Quote.created_at.desc()).limit(200).all()
    invoices = db.query(Invoice).filter(Invoice.organization_id == org.id).order_by(Invoice.created_at.desc()).limit(200).all()

    user_ids = [u.id for u in users]
    assignments = (
        db.query(UserBranchAssignment)
        .filter(UserBranchAssignment.user_id.in_(user_ids))
        .all()
        if user_ids else []
    )
    branch_by_id = {b.id: b for b in branches}
    branches_by_user = {}
    for assignment in assignments:
        branch = branch_by_id.get(assignment.branch_id)
        if not branch:
            continue
        branches_by_user.setdefault(assignment.user_id, []).append({
            "id": branch.id,
            "name": branch.name,
            "isPrimary": bool(assignment.is_primary),
        })

    quote_ids = [q.id for q in quotes]
    item_counts = dict(
        db.query(QuoteItem.quote_id, func.count(QuoteItem.id))
        .filter(QuoteItem.quote_id.in_(quote_ids))
        .group_by(QuoteItem.quote_id)
        .all()
    ) if quote_ids else {}
    order_quote_ids = {
        row[0]
        for row in db.query(Order.quote_id)
        .filter(Order.organization_id == org.id, Order.quote_id.isnot(None))
        .all()
        if row[0]
    }
    needed_branch_ids = {inv.branch_id for inv in invoices if inv.branch_id}
    needed_branch_ids.update(q.ordered_for_branch_id for q in quotes if q.ordered_for_branch_id)
    extra_branch_ids = needed_branch_ids - set(branch_by_id)
    if extra_branch_ids:
        for branch in db.query(Branch).filter(Branch.id.in_(extra_branch_ids)).all():
            branch_by_id[branch.id] = branch

    quote_count = db.query(func.count(Quote.id)).filter(Quote.organization_id == org.id).scalar() or 0
    invoice_count = db.query(func.count(Invoice.id)).filter(Invoice.organization_id == org.id).scalar() or 0
    order_count = db.query(func.count(Order.id)).filter(Order.organization_id == org.id).scalar() or 0
    quote_total = db.query(func.coalesce(func.sum(Quote.total), 0)).filter(Quote.organization_id == org.id).scalar() or 0
    invoice_total = db.query(func.coalesce(func.sum(Invoice.total), 0)).filter(Invoice.organization_id == org.id).scalar() or 0
    invoice_paid_total = db.query(func.coalesce(func.sum(Invoice.total), 0)).filter(
        Invoice.organization_id == org.id,
        func.lower(Invoice.status) == "paid",
    ).scalar() or 0

    registrar = None
    if org.registered_by_user_id:
        registrar = db.query(User).filter(User.id == org.registered_by_user_id).one_or_none()

    return {
        "organization": serialize_organization(org),
        "registeredBy": (
            {
                "id": registrar.id,
                "name": f"{registrar.first_name} {registrar.last_name}".strip(),
            }
            if registrar else None
        ),
        "summary": {
            "branchCount": len(branches),
            "userCount": len(users),
            "quoteCount": quote_count,
            "invoiceCount": invoice_count,
            "orderCount": order_count,
            "quoteTotal": float(quote_total),
            "invoiceTotal": float(invoice_total),
            "invoicePaidTotal": float(invoice_paid_total),
            "invoiceOutstanding": float(invoice_total) - float(invoice_paid_total),
        },
        "branches": [serialize_branch(b) for b in branches],
        "users": [
            {
                "id": u.id,
                "firstName": u.first_name,
                "lastName": u.last_name,
                "email": u.email,
                "phone": u.phone,
                "role": u.role,
                "jobTitle": u.job_title,
                "canLogin": bool(u.can_login),
                "createdAt": u.created_at,
                "branches": branches_by_user.get(u.id, []),
            }
            for u in users
        ],
        "quotes": [
            {
                "id": q.id,
                "quote_number": q.quote_number,
                "ops_status": compute_ops_status(q, has_order=q.id in order_quote_ids),
                "requested_by": q.contact_person,
                "branch_name": (branch_by_id[q.ordered_for_branch_id].name if q.ordered_for_branch_id in branch_by_id else None),
                "item_count": item_counts.get(q.id, 0),
                "total": q.total or 0,
                "created_at": q.created_at,
                "updated_at": q.updated_at,
            }
            for q in quotes
        ],
        "invoices": [
            {
                "id": inv.id,
                "invoice_number": inv.invoice_number,
                "total": inv.total,
                "status": inv.status,
                "due_date": inv.due_date,
                "created_at": inv.created_at,
                "quote_id": inv.quote_id,
                "contact_person": inv.contact_person,
                "branch_name": (branch_by_id[inv.branch_id].name if inv.branch_id in branch_by_id else None),
            }
            for inv in invoices
        ],
    }


# Customer-facing messages: GET/POST /api/quotes/{id}/messages
