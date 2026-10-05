"""Classifications shared by the operations dashboard and its filtered lists."""

from datetime import datetime
from typing import Optional

ACTIVE_ORDER_STATUSES = frozenset({
    "order_placed",
    "processing",
    "dispatched",
    "out_for_delivery",
})
FULFILMENT_ORDER_STATUSES = frozenset({"order_placed", "processing"})
DELIVERY_ORDER_STATUSES = frozenset({"dispatched", "out_for_delivery"})

# Invoice lifecycle: awaiting_payment -> paid. "overdue" is derived from the due
# date at read time, never stored. "pending"/"unpaid" are legacy spellings of
# awaiting_payment that older rows or clients may still send.
INVOICE_AWAITING_PAYMENT = "awaiting_payment"
INVOICE_PAID = "paid"
INVOICE_OVERDUE = "overdue"
OPEN_INVOICE_STATUSES = frozenset({INVOICE_AWAITING_PAYMENT, "pending", "unpaid"})


def normalize_invoice_status(status: Optional[str]) -> str:
    """Map any stored/legacy invoice status onto the canonical vocabulary."""
    raw = (status or "").strip().lower()
    if raw == INVOICE_PAID:
        return INVOICE_PAID
    return INVOICE_AWAITING_PAYMENT


def invoice_display_status(status: Optional[str], due_date: Optional[datetime], now: datetime) -> str:
    """Bucket an invoice the same way the invoices list does.

    Paid wins over a past due date. Anything else past its due date is overdue.
    Everything else is awaiting payment.
    """
    if normalize_invoice_status(status) == INVOICE_PAID:
        return INVOICE_PAID
    if due_date is not None and due_date < now:
        return INVOICE_OVERDUE
    return INVOICE_AWAITING_PAYMENT
