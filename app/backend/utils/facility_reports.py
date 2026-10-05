"""Facility-facing reports: fulfilment, catalogue cadence, and restock cues.

Money totals are computed only as a compatibility field and must not be the
hero of the facility UI. The point is to make reordering the easy next step.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from db.models import Branch, Order, OrderItem, Product, Quote, QuoteItem
from utils.app_time import format_app, to_app_tz
from utils.list_query import parse_day_end, parse_day_start
from utils.permissions import resolve_list_branch_ids

AWAITING_YOU = frozenset({"quoted", "revision_proposed", "accepted"})
READY_QUOTES = frozenset({"quoted", "accepted"})
ON_THE_WAY = frozenset({"dispatched", "out_for_delivery"})
IN_PROGRESS = frozenset({"order_placed", "processing", "quote_requested", "awaiting_approval"})
DELIVERED = "delivered"
CANCELLED = "cancelled"


def _median(values: list[float]) -> Optional[float]:
    if not values:
        return None
    ordered = sorted(values)
    n = len(ordered)
    mid = n // 2
    if n % 2:
        return float(ordered[mid])
    return (ordered[mid - 1] + ordered[mid]) / 2.0


def _month_start(value: datetime) -> tuple[int, int]:
    local = to_app_tz(value)
    return local.year, local.month


def _month_keys(start: datetime, end: datetime) -> list[str]:
    exclusive_end = end - timedelta(seconds=1) if end > start else end
    y, m = _month_start(start)
    ey, em = _month_start(exclusive_end)
    keys = []
    while (y, m) <= (ey, em):
        keys.append(f"{y:04d}-{m:02d}")
        if m == 12:
            y += 1
            m = 1
        else:
            m += 1
    return keys


def _month_label(key: str) -> str:
    year, month = key.split("-")
    return datetime(int(year), int(month), 1).strftime("%b %Y")


def _days_between(later: datetime, earlier: datetime) -> int:
    return max(0, (later - earlier).days)


def build_facility_reports(
    db: Session,
    user,
    *,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    branch_id: Optional[str] = None,
) -> dict:
    org_id = user.organization_id
    branch_ids = resolve_list_branch_ids(db, user, branch_id)
    now = datetime.utcnow()
    start = parse_day_start(from_date)
    end = parse_day_end(to_date) or (now + timedelta(seconds=1))

    order_q = db.query(Order).filter(
        Order.organization_id == org_id,
        Order.created_at < end,
    )
    quote_q = db.query(Quote).filter(
        Quote.organization_id == org_id,
        Quote.created_at < end,
    )
    if start:
        order_q = order_q.filter(Order.created_at >= start)
        quote_q = quote_q.filter(Quote.created_at >= start)
    if branch_ids is not None:
        order_q = order_q.filter(Order.ordered_for_branch_id.in_(branch_ids))
        quote_q = quote_q.filter(Quote.ordered_for_branch_id.in_(branch_ids))

    orders = order_q.all()
    quotes = quote_q.all()
    order_by_id = {order.id: order for order in orders}
    order_ids = list(order_by_id)
    quote_ids = [quote.id for quote in quotes]

    items = (
        db.query(OrderItem).filter(OrderItem.order_id.in_(order_ids)).all()
        if order_ids
        else []
    )
    quote_items = (
        db.query(QuoteItem).filter(QuoteItem.quote_id.in_(quote_ids)).all()
        if quote_ids
        else []
    )

    items_by_order: dict[str, list[OrderItem]] = defaultdict(list)
    for item in items:
        items_by_order[item.order_id].append(item)

    quote_item_count: dict[str, int] = defaultdict(int)
    for item in quote_items:
        quote_item_count[item.quote_id] += 1

    catalog_ids = {item.product_id for item in items if item.product_id}
    catalog_ids.update(item.product_id for item in quote_items if item.product_id)
    products: dict[str, Product] = {}
    if catalog_ids:
        rows = (
            db.query(Product)
            .filter(or_(Product.id.in_(catalog_ids), Product.product_id.in_(catalog_ids)))
            .all()
        )
        for row in rows:
            products[row.id] = row
            if row.product_id:
                products[row.product_id] = row

    product_stats: dict[str, dict] = {}
    for item in items:
        order = order_by_id.get(item.order_id)
        if not order:
            continue
        key = item.product_id or item.product_name
        row = product_stats.setdefault(
            key,
            {
                "productId": item.product_id,
                "productName": item.product_name,
                "category": item.category or "",
                "quantity": 0,
                "deliveredQuantity": 0,
                "orderCount": 0,
                "orderIds": set(),
                "orderDates": [],
                "lastQty": item.quantity or 1,
                "lastOrderedAt": order.created_at,
            },
        )
        qty = item.quantity or 1
        row["quantity"] += qty
        if order.status == DELIVERED:
            row["deliveredQuantity"] += qty
        if item.order_id not in row["orderIds"]:
            row["orderIds"].add(item.order_id)
            row["orderCount"] += 1
            if order.created_at:
                row["orderDates"].append(order.created_at)
        if order.created_at and (row["lastOrderedAt"] is None or order.created_at >= row["lastOrderedAt"]):
            row["lastOrderedAt"] = order.created_at
            row["lastQty"] = qty
        catalog = products.get(item.product_id) if item.product_id else None
        if catalog:
            row["productId"] = catalog.id
            row["sku"] = catalog.product_id
            row["category"] = row["category"] or catalog.category_name or ""
            row["categoryId"] = catalog.category_id
            row["listPrice"] = catalog.price
            row["unit"] = catalog.unit or catalog.stocking_unit or "unit"
            row["imageUrl"] = catalog.image_url
            row["inStock"] = bool(catalog.in_stock)

    products_out = []
    restock = []
    for row in product_stats.values():
        dates = sorted(d for d in row["orderDates"] if d)
        gaps = [_days_between(dates[i], dates[i - 1]) for i in range(1, len(dates))]
        typical_interval = _median(gaps)
        last_at = row["lastOrderedAt"]
        days_since = _days_between(now, last_at) if last_at else None
        typical_qty = int(row["lastQty"] or 1)
        due = False
        if typical_interval and days_since is not None:
            due = days_since >= max(14, int(typical_interval * 0.85))
        elif days_since is not None and row["orderCount"] == 1:
            due = days_since >= 40
        payload = {
            "productId": row.get("productId"),
            "sku": row.get("sku"),
            "productName": row["productName"],
            "category": row.get("category") or None,
            "categoryId": row.get("categoryId"),
            "quantity": row["quantity"],
            "deliveredQuantity": row["deliveredQuantity"],
            "orderCount": row["orderCount"],
            "typicalQuantity": typical_qty,
            "typicalIntervalDays": int(round(typical_interval)) if typical_interval else None,
            "lastOrderedAt": last_at,
            "daysSinceLastOrder": days_since,
            "listPrice": row.get("listPrice"),
            "unit": row.get("unit") or "unit",
            "imageUrl": row.get("imageUrl"),
            "inStock": row.get("inStock", True),
            "dueToRestock": due,
        }
        products_out.append(payload)
        if due:
            restock.append(payload)

    products_out.sort(key=lambda item: (-item["orderCount"], -item["quantity"], item["productName"] or ""))
    restock.sort(key=lambda item: (-(item["daysSinceLastOrder"] or 0), -item["orderCount"]))

    categories: dict[str, dict] = defaultdict(lambda: {"name": "Uncategorised", "quantity": 0, "orderCount": 0, "lines": 0})
    for item in products_out:
        name = item["category"] or "Uncategorised"
        bucket = categories[name]
        bucket["name"] = name
        bucket["quantity"] += item["quantity"]
        bucket["orderCount"] += item["orderCount"]
        bucket["lines"] += 1
    categories_out = sorted(categories.values(), key=lambda item: -item["quantity"])

    activity_dates = [order.created_at for order in orders if order.created_at]
    activity_dates.extend(quote.created_at for quote in quotes if quote.created_at)
    chart_start = start or (min(activity_dates) if activity_dates else now - timedelta(days=180))
    month_keys = _month_keys(chart_start, min(end, now + timedelta(seconds=1)))
    if len(month_keys) > 18:
        month_keys = month_keys[-18:]
    period_days = max(1, (min(end, now + timedelta(seconds=1)) - chart_start).days)
    monthly = {
        key: {"month": key, "label": _month_label(key), "orders": 0, "quotes": 0, "items": 0, "count": 0}
        for key in month_keys
    }
    for order in orders:
        key = format_app(order.created_at, "%Y-%m") if order.created_at else None
        if key not in monthly:
            continue
        monthly[key]["orders"] += 1
        monthly[key]["count"] += 1
        monthly[key]["items"] += sum(item.quantity or 1 for item in items_by_order.get(order.id, []))
    for quote in quotes:
        key = format_app(quote.created_at, "%Y-%m") if quote.created_at else None
        if key in monthly:
            monthly[key]["quotes"] += 1

    delivered = sum(1 for order in orders if order.status == DELIVERED)
    on_the_way = sum(1 for order in orders if order.status in ON_THE_WAY)
    in_progress = sum(1 for order in orders if order.status in IN_PROGRESS)
    cancelled = sum(1 for order in orders if order.status == CANCELLED)
    active = delivered + on_the_way + in_progress
    fulfilment_rate = round(100 * delivered / active) if active else None
    items_received = sum(
        item.quantity or 1
        for order in orders if order.status == DELIVERED
        for item in items_by_order.get(order.id, [])
    )
    items_on_the_way = sum(
        item.quantity or 1
        for order in orders if order.status in ON_THE_WAY
        for item in items_by_order.get(order.id, [])
    )

    order_dates = sorted(order.created_at for order in orders if order.created_at)
    order_gaps = [_days_between(order_dates[i], order_dates[i - 1]) for i in range(1, len(order_dates))]
    avg_days_between_orders = _median(order_gaps)

    awaiting_you = [quote for quote in quotes if quote.status in AWAITING_YOU]
    ready_quotes = sum(1 for quote in quotes if quote.status in READY_QUOTES)
    quote_ids_with_orders = {order.quote_id for order in orders if order.quote_id}
    converted = sum(
        1
        for quote in quotes
        if quote.status in {"invoiced", "converted"} or quote.id in quote_ids_with_orders
    )

    quote_history = sorted(quotes, key=lambda q: q.created_at or datetime.min, reverse=True)[:25]
    recent_orders = sorted(orders, key=lambda o: o.created_at or datetime.min, reverse=True)[:20]

    branch_rows = []
    if user.role not in ("branch_admin", "branch_user"):
        branch_query = db.query(Branch).filter(Branch.organization_id == org_id)
        if branch_ids is not None:
            branch_query = branch_query.filter(Branch.id.in_(branch_ids))
        for branch in branch_query.order_by(Branch.is_main.desc(), Branch.name.asc()).all():
            b_orders = [o for o in orders if o.ordered_for_branch_id == branch.id]
            b_quotes = [q for q in quotes if q.ordered_for_branch_id == branch.id]
            branch_rows.append({
                "branchId": branch.id,
                "branchName": branch.name,
                "branchCode": branch.branch_code,
                "isMain": branch.is_main,
                "quotes": len(b_quotes),
                "orders": len(b_orders),
                "items": sum(
                    item.quantity or 1
                    for order in b_orders
                    for item in items_by_order.get(order.id, [])
                ),
                "delivered": sum(1 for order in b_orders if order.status == DELIVERED),
                "onTheWay": sum(1 for order in b_orders if order.status in ON_THE_WAY),
            })

    snapshot_value = sum(
        float((order.delivery_snapshot or {}).get("total", 0) or 0) for order in orders
    )

    return {
        "periodDays": period_days,
        "fromDate": format_app(chart_start, "%Y-%m-%d") if chart_start else None,
        "toDate": format_app(min(end, now + timedelta(seconds=1)) - timedelta(seconds=1), "%Y-%m-%d"),
        "summary": {
            "quotes": len(quotes),
            "quotesReady": ready_quotes,
            "awaitingYou": len(awaiting_you),
            "converted": converted,
            "orders": len(orders),
            "inProgress": in_progress,
            "onTheWay": on_the_way,
            "delivered": delivered,
            "cancelled": cancelled,
            "itemsReceived": items_received,
            "itemsOnTheWay": items_on_the_way,
            "fulfilmentRate": fulfilment_rate,
            "catalogueLines": len(products_out),
            "repeatLines": sum(1 for item in products_out if item["orderCount"] >= 2),
            "dueToRestock": len(restock),
            "avgDaysBetweenOrders": int(round(avg_days_between_orders)) if avg_days_between_orders else None,
        },
        "totalQuotes": len(quotes),
        "totalOrders": len(orders),
        "deliveredOrders": delivered,
        "inTransitDeliveries": on_the_way,
        "orderValueEstimate": snapshot_value,
        "monthly": [monthly[key] for key in month_keys],
        "ordersByMonth": [{"month": monthly[key]["month"], "count": monthly[key]["orders"]} for key in month_keys],
        "products": products_out,
        "topProducts": [
            {"productName": item["productName"], "quantity": item["quantity"]}
            for item in products_out[:10]
        ],
        "categories": categories_out,
        "restock": restock[:12],
        "openActions": [
            {
                "type": "quote",
                "id": quote.id,
                "number": quote.quote_number,
                "status": quote.status,
                "itemCount": quote_item_count.get(quote.id, 0),
                "createdAt": quote.created_at,
            }
            for quote in sorted(awaiting_you, key=lambda q: q.created_at or datetime.min, reverse=True)[:12]
        ],
        "recentOrders": [
            {
                "id": order.id,
                "orderNumber": order.order_number,
                "status": order.status,
                "itemCount": sum(item.quantity or 1 for item in items_by_order.get(order.id, [])),
                "lineCount": len(items_by_order.get(order.id, [])),
                "createdAt": order.created_at,
                "deliveredAt": getattr(order, "delivered_at", None),
            }
            for order in recent_orders
        ],
        "quoteHistory": [
            {
                "id": quote.id,
                "quoteNumber": quote.quote_number,
                "status": quote.status,
                "itemCount": quote_item_count.get(quote.id, 0),
                "createdAt": quote.created_at,
            }
            for quote in quote_history
        ],
        "branches": branch_rows,
        "deliveryPerformance": {
            "delivered": delivered,
            "inTransit": on_the_way,
            "active": in_progress,
        },
    }
