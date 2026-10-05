"""Company-wide commercial report.

Period metrics use created dates. Cash position, fulfilment, and unread messages
are current, so a date filter does not hide money still owed or work still open.
"""

from collections import defaultdict
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from db.models import Invoice, Order, OrderItem, Organization, Product, Quote, QuoteItem, QuoteMessage
from utils.app_time import format_app
from utils.list_query import parse_day_end, parse_day_start
from utils.ops_stats import (
    ACTIVE_ORDER_STATUSES,
    DELIVERY_ORDER_STATUSES,
    FULFILMENT_ORDER_STATUSES,
    invoice_display_status,
)
from utils.quote_ops import compute_ops_status

PIPELINE = (
    "submitted",
    "under_review",
    "awaiting_information",
    "awaiting_customer",
    "accepted",
    "converted",
    "rejected",
    "cancelled",
)
DECIDED = {"accepted", "converted", "rejected", "cancelled"}
WON = {"accepted", "converted"}


def _money(value) -> float:
    try:
        return round(float(value or 0), 2)
    except (TypeError, ValueError):
        return 0.0


def _in_period(moment, start: Optional[datetime], end: Optional[datetime]) -> bool:
    if moment is None:
        return start is None and end is None
    if start and moment < start:
        return False
    if end and moment >= end:
        return False
    return True


def _rate(numerator, denominator):
    if not denominator:
        return None
    return round((float(numerator) / float(denominator)) * 100, 1)


def _blank_facility(org_id, name, county):
    return {
        "id": org_id or name or "unassigned",
        "organizationId": org_id or "",
        "name": name or "Unassigned",
        "county": county or "",
        "quotes": 0,
        "quoteValue": 0.0,
        "won": 0,
        "decided": 0,
        "orders": 0,
        "orderValue": 0.0,
        "margin": 0.0,
        "invoiced": 0.0,
        "collected": 0.0,
        "outstanding": 0.0,
        "overdue": 0.0,
    }


def build_company_report(db: Session, from_date: Optional[str] = None, to_date: Optional[str] = None) -> dict:
    start = parse_day_start(from_date)
    end = parse_day_end(to_date)
    now = datetime.utcnow()

    orgs = {org.id: org for org in db.query(Organization).all()}
    quotes = db.query(Quote).all()
    orders = db.query(Order).all()
    invoices = db.query(Invoice).all()
    quote_ids_with_orders = {order.quote_id for order in orders if order.quote_id}
    quotes_by_id = {quote.id: quote for quote in quotes}

    period_quotes = [quote for quote in quotes if _in_period(quote.created_at, start, end)]
    period_orders = [order for order in orders if _in_period(order.created_at, start, end)]
    period_invoices = [invoice for invoice in invoices if _in_period(invoice.created_at, start, end)]
    period_order_ids = [order.id for order in period_orders]
    period_quote_ids = [quote.id for quote in period_quotes]

    order_items = db.query(OrderItem).filter(OrderItem.order_id.in_(period_order_ids)).all() if period_order_ids else []
    quote_items = db.query(QuoteItem).filter(QuoteItem.quote_id.in_(period_quote_ids)).all() if period_quote_ids else []

    pipeline = {status: {"status": status, "count": 0, "value": 0.0} for status in PIPELINE}
    quote_value = 0.0
    won = 0
    decided = 0
    facilities = {}

    def facility_for(org_id, fallback_name=""):
        org = orgs.get(org_id)
        key = org_id or fallback_name or "unassigned"
        if key not in facilities:
            facilities[key] = _blank_facility(
                org_id,
                org.name if org else fallback_name,
                org.county if org else "",
            )
        return facilities[key]

    for quote in period_quotes:
        status = compute_ops_status(quote, has_order=quote.id in quote_ids_with_orders)
        value = _money(quote.total)
        quote_value += value
        if status in pipeline:
            pipeline[status]["count"] += 1
            pipeline[status]["value"] = round(pipeline[status]["value"] + value, 2)
        if status in DECIDED:
            decided += 1
        if status in WON:
            won += 1
        row = facility_for(quote.organization_id, quote.facility_name)
        row["quotes"] += 1
        row["quoteValue"] = round(row["quoteValue"] + value, 2)
        if status in DECIDED:
            row["decided"] += 1
        if status in WON:
            row["won"] += 1

    order_value = 0.0
    known_revenue = 0.0
    margin = 0.0
    products = {}
    categories = {}
    ordered_names = set()

    def add_product(name, category, quantity, revenue, cost, quoted=0):
        key = name or "Unnamed product"
        row = products.setdefault(key, {
            "name": key,
            "category": category or "",
            "quantity": 0,
            "revenue": 0.0,
            "cost": 0.0,
            "margin": 0.0,
            "quotedQty": 0,
        })
        if category and not row["category"]:
            row["category"] = category
        line_margin = revenue - cost if cost else 0.0
        row["quantity"] += quantity
        row["quotedQty"] += quoted
        row["revenue"] = round(row["revenue"] + revenue, 2)
        row["cost"] = round(row["cost"] + cost, 2)
        row["margin"] = round(row["margin"] + line_margin, 2)
        cat_key = category or "Uncategorised"
        cat = categories.setdefault(cat_key, {"name": cat_key, "quantity": 0, "revenue": 0.0, "margin": 0.0})
        cat["quantity"] += quantity
        cat["revenue"] = round(cat["revenue"] + revenue, 2)
        cat["margin"] = round(cat["margin"] + line_margin, 2)

    orders_by_id = {order.id: order for order in period_orders}
    for item in order_items:
        qty = int(item.quantity or 0)
        revenue = _money(item.unit_price) * qty
        cost_known = item.buying_price is not None and _money(item.buying_price) > 0
        cost = _money(item.buying_price) * qty if cost_known else 0.0
        order_value += revenue
        if cost_known:
            known_revenue += revenue
            margin += revenue - cost
        ordered_names.add(item.product_name)
        add_product(item.product_name, item.category, qty, revenue, cost)
        order = orders_by_id.get(item.order_id)
        if order:
            row = facility_for(order.organization_id)
            row["margin"] = round(row["margin"] + (revenue - cost if cost_known else 0), 2)

    for order in period_orders:
        row = facility_for(order.organization_id)
        row["orders"] += 1

    quoted_only = defaultdict(lambda: {"name": "", "category": "", "quotedQty": 0})
    for item in quote_items:
        qty = int(item.quoted_quantity or item.quantity or 0)
        quoted_only[item.product_name]["name"] = item.product_name
        quoted_only[item.product_name]["category"] = item.category or quoted_only[item.product_name]["category"]
        quoted_only[item.product_name]["quotedQty"] += qty
        if item.product_name in products:
            products[item.product_name]["quotedQty"] += qty

    for item in order_items:
        order = orders_by_id.get(item.order_id)
        if not order:
            continue
        qty = int(item.quantity or 0)
        revenue = _money(item.unit_price) * qty
        row = facility_for(order.organization_id)
        row["orderValue"] = round(row["orderValue"] + revenue, 2)

    cycle_days = []
    for order in period_orders:
        quote = quotes_by_id.get(order.quote_id) if order.quote_id else None
        if quote and quote.created_at and order.created_at and order.created_at >= quote.created_at:
            cycle_days.append((order.created_at - quote.created_at).total_seconds() / 86400)

    invoiced = 0.0
    collected = 0.0
    for invoice in period_invoices:
        total = _money(invoice.total)
        display = invoice_display_status(invoice.status, invoice.due_date, now)
        invoiced += total
        if display == "paid":
            collected += total
        row = facility_for(invoice.organization_id, invoice.facility_name)
        row["invoiced"] = round(row["invoiced"] + total, 2)
        if display == "paid":
            row["collected"] = round(row["collected"] + total, 2)

    outstanding = 0.0
    overdue_value = 0.0
    overdue_count = 0
    for invoice in invoices:
        display = invoice_display_status(invoice.status, invoice.due_date, now)
        if display == "paid":
            continue
        total = _money(invoice.total)
        outstanding += total
        row = facility_for(invoice.organization_id, invoice.facility_name)
        row["outstanding"] = round(row["outstanding"] + total, 2)
        if display == "overdue":
            overdue_count += 1
            overdue_value += total
            row["overdue"] = round(row["overdue"] + total, 2)

    monthly = {}

    def month_row(moment):
        key = format_app(moment, "%Y-%m") if moment else "unknown"
        return monthly.setdefault(key, {
            "month": key,
            "quotes": 0,
            "quoteValue": 0.0,
            "orders": 0,
            "orderValue": 0.0,
            "invoiced": 0.0,
            "collected": 0.0,
        })

    for quote in period_quotes:
        row = month_row(quote.created_at)
        row["quotes"] += 1
        row["quoteValue"] = round(row["quoteValue"] + _money(quote.total), 2)
    order_values = defaultdict(float)
    for item in order_items:
        order_values[item.order_id] += _money(item.unit_price) * int(item.quantity or 0)
    for order in period_orders:
        row = month_row(order.created_at)
        row["orders"] += 1
        row["orderValue"] = round(row["orderValue"] + order_values[order.id], 2)
    for invoice in period_invoices:
        row = month_row(invoice.created_at)
        total = _money(invoice.total)
        row["invoiced"] = round(row["invoiced"] + total, 2)
        if invoice_display_status(invoice.status, invoice.due_date, now) == "paid":
            row["collected"] = round(row["collected"] + total, 2)

    active_orders = sum(1 for order in orders if order.status in ACTIVE_ORDER_STATUSES)
    fulfilment = sum(1 for order in orders if order.status in FULFILMENT_ORDER_STATUSES)
    deliveries = sum(1 for order in orders if order.status in DELIVERY_ORDER_STATUSES)
    delivered = sum(1 for order in period_orders if order.status == "delivered")
    unread = (
        db.query(QuoteMessage)
        .filter(QuoteMessage.sender_role == "customer", QuoteMessage.is_read.is_(False))
        .count()
    )
    out_of_stock = db.query(Product).filter(Product.in_stock.is_(False)).count()

    facility_rows = []
    for row in facilities.values():
        if not any([row["quotes"], row["orders"], row["invoiced"], row["outstanding"]]):
            continue
        row["quoteValue"] = round(row["quoteValue"], 2)
        row["orderValue"] = round(row["orderValue"], 2)
        row["conversionRate"] = _rate(row["won"], row["decided"])
        facility_rows.append(row)

    product_rows = sorted(products.values(), key=lambda row: row["revenue"], reverse=True)
    category_rows = sorted(categories.values(), key=lambda row: row["revenue"], reverse=True)
    quoted_not_ordered = sorted(
        [row for name, row in quoted_only.items() if name not in ordered_names and row["quotedQty"] > 0],
        key=lambda row: row["quotedQty"],
        reverse=True,
    )[:8]

    quote_count = len(period_quotes)
    order_count = len(period_orders)
    return {
        "period": {"from": from_date or "", "to": to_date or ""},
        "summary": {
            "quoteCount": quote_count,
            "quoteValue": round(quote_value, 2),
            "avgQuoteValue": round(quote_value / quote_count, 2) if quote_count else 0,
            "winRate": _rate(won, decided),
            "won": won,
            "decided": decided,
            "orderCount": order_count,
            "orderValue": round(order_value, 2),
            "avgOrderValue": round(order_value / order_count, 2) if order_count else 0,
            "grossProfit": round(margin, 2),
            "marginRate": _rate(margin, known_revenue),
            "invoiceCount": len(period_invoices),
            "invoiced": round(invoiced, 2),
            "collected": round(collected, 2),
            "collectionRate": _rate(collected, invoiced),
            "outstanding": round(outstanding, 2),
            "overdueCount": overdue_count,
            "overdueValue": round(overdue_value, 2),
            "activeOrders": active_orders,
            "fulfilment": fulfilment,
            "deliveries": deliveries,
            "delivered": delivered,
            "avgQuoteToOrderDays": round(sum(cycle_days) / len(cycle_days), 1) if cycle_days else None,
            "unreadMessages": unread,
            "outOfStock": out_of_stock,
        },
        "pipeline": [pipeline[status] for status in PIPELINE if pipeline[status]["count"]],
        "monthly": [monthly[key] for key in sorted(monthly)],
        "facilities": facility_rows,
        "products": product_rows,
        "categories": category_rows,
        "quotedNotOrdered": quoted_not_ordered,
    }
