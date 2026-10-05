from datetime import datetime
from typing import Optional

DISPATCHED_STATUSES = {"dispatched", "out_for_delivery"}
DELIVERED_STATUSES = {"delivered"}


def apply_order_lifecycle_timestamps(
    order,
    *,
    new_status: Optional[str] = None,
    new_delivery_status: Optional[str] = None,
    now: Optional[datetime] = None,
) -> None:
    stamp = now or datetime.utcnow()
    if not getattr(order, "ordered_at", None):
        order.ordered_at = getattr(order, "created_at", None) or stamp

    status = (new_status if new_status is not None else getattr(order, "status", None)) or ""
    delivery = (
        new_delivery_status
        if new_delivery_status is not None
        else getattr(order, "delivery_status", None)
    ) or ""

    if status in DISPATCHED_STATUSES or delivery in DISPATCHED_STATUSES or status in DELIVERED_STATUSES or delivery in DELIVERED_STATUSES:
        if not getattr(order, "dispatched_at", None):
            order.dispatched_at = stamp

    if status in DELIVERED_STATUSES or delivery in DELIVERED_STATUSES:
        if not getattr(order, "delivered_at", None):
            order.delivered_at = stamp
