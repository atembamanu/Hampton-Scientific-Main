"""Quote workflow state machine shared by the ops API and dashboards.

Ops statuses (what staff see):

    submitted -> under_review <-> awaiting_information -> awaiting_customer
                                                            |-> accepted -> converted
                                                            |-> rejected
    any open state -> cancelled

Stored representation is (Quote.status, Quote.current_handler); this module is
the only place that maps between the two.
"""
from typing import Optional

from db.models import Order, Quote
from sqlalchemy.orm import Session

OPEN_OPS_STATUSES = frozenset({"submitted", "under_review", "awaiting_information", "awaiting_customer"})
TERMINAL_OPS_STATUSES = frozenset({"converted"})


def paginate_by_ops_status(quotes, order_quote_ids, wanted, skip: int, limit: int):
    """Keep quotes whose computed ops status is wanted, then slice a page.

    ``quotes`` only needs ``id``, ``status``, and ``current_handler``.
    An empty ``wanted`` list keeps every quote.
    """
    wanted_set = {value for value in (wanted or []) if value and value != "all"}
    order_ids = set(order_quote_ids or [])
    matched = []
    for quote in quotes:
        status = compute_ops_status(quote, has_order=quote.id in order_ids)
        if not wanted_set or status in wanted_set:
            matched.append(quote)
    total = len(matched)
    start = max(int(skip or 0), 0)
    size = max(int(limit or 1), 1)
    return matched[start:start + size], total


def compute_ops_status(quote: Quote, has_order: bool = False) -> str:
    if has_order or quote.status == "invoiced":
        return "converted"
    if quote.status == "draft":
        return "draft"
    if quote.status == "rejected":
        return "rejected"
    if quote.status == "cancelled":
        return "cancelled"
    if quote.status == "accepted":
        return "accepted"
    handler = quote.current_handler or ""
    if quote.status == "revision_proposed" or handler == "AWAITING_INFORMATION":
        return "awaiting_information"
    if quote.status == "quoted" and handler == "CUSTOMER_REVIEW":
        return "awaiting_customer"
    # PREPARING_QUOTE is retired; legacy rows are treated as under review.
    if handler in ("UNDER_REVIEW", "PREPARING_QUOTE") or (quote.status == "quoted" and handler == "ADMIN_REVIEW"):
        return "under_review"
    return "submitted"


def quote_has_order(db: Session, quote_id: str) -> Optional[Order]:
    return db.query(Order).filter(Order.quote_id == quote_id).first()


# Actions a client may still trigger explicitly. Status changes outside these
# go through set_status_override (staff acting on the customer's behalf).
VALID_ACTIONS = {
    "submitted": ["start_review", "cancel"],
    "under_review": ["request_information", "send_quote", "cancel"],
    "awaiting_information": ["send_quote", "cancel"],
    "awaiting_customer": ["resend", "cancel"],
    "accepted": ["create_order"],
    "converted": ["view_order"],
    "rejected": [],
    "cancelled": [],
    "expired": [],
    "draft": [],
}


def apply_workflow_action(quote: Quote, action: str) -> tuple[str, str]:
    """Return (status, current_handler) after applying an ops action."""
    if action == "start_review":
        return "pending", "UNDER_REVIEW"
    if action == "request_information":
        return "pending", "AWAITING_INFORMATION"
    if action == "cancel":
        return "cancelled", quote.current_handler or "ADMIN_REVIEW"
    if action in ("resend", "send_quote"):
        return "quoted", "CUSTOMER_REVIEW"
    raise ValueError(f"Unsupported action: {action}")


# ---- manual overrides ---------------------------------------------------------
# target ops status -> (status, handler, customer_response)
STATUS_OVERRIDE_TARGETS = {
    "under_review": ("pending", "UNDER_REVIEW", None),
    "awaiting_information": ("pending", "AWAITING_INFORMATION", None),
    "awaiting_customer": ("quoted", "CUSTOMER_REVIEW", None),
    "accepted": ("accepted", "CUSTOMER_REVIEW", "accepted"),
    "rejected": ("rejected", "CUSTOMER_REVIEW", "rejected"),
    "cancelled": ("cancelled", "ADMIN_REVIEW", None),
}

# Targets that only make sense once the customer has (or could have) seen prices.
OVERRIDE_TARGETS_REQUIRING_PRICES = frozenset({"awaiting_customer", "accepted"})


def available_status_overrides(current_ops_status: str) -> list[str]:
    """Targets staff may move a quote to from its current ops status."""
    if current_ops_status in TERMINAL_OPS_STATUSES:
        return []
    return [target for target in STATUS_OVERRIDE_TARGETS if target != current_ops_status]


def apply_status_override(target: str) -> tuple[str, str, Optional[str]]:
    try:
        return STATUS_OVERRIDE_TARGETS[target]
    except KeyError as exc:
        raise ValueError(f"Unsupported status: {target}") from exc


def customer_reply_transition(quote: Quote) -> Optional[tuple[str, str]]:
    """When a customer answers a request for information, the quote goes back to review.

    Returns the new (status, handler) or None if no change applies. Negotiation
    (`revision_proposed`) is a separate flow and is left alone.
    """
    if quote.status == "revision_proposed":
        return None
    if (quote.current_handler or "") == "AWAITING_INFORMATION":
        return "pending", "UNDER_REVIEW"
    return None


def all_lines_priced(items) -> bool:
    """Every line carries a quoted unit price; required before sending to the customer."""
    items = list(items or [])
    return bool(items) and all(float(getattr(it, "unit_price", None) or (it.get("unit_price") if isinstance(it, dict) else 0) or 0) > 0 for it in items)
