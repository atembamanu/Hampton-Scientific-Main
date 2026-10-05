from datetime import datetime, timedelta

from utils.list_query import csv_values
from utils.ops_stats import invoice_display_status, normalize_invoice_status


def test_csv_values_splits_and_dedupes():
    assert csv_values(None) == []
    assert csv_values("") == []
    assert csv_values("processing") == ["processing"]
    assert csv_values(" processing, dispatched ,processing") == ["processing", "dispatched"]


def test_invoice_display_status_buckets():
    now = datetime(2026, 9, 28, 12, 0, 0)
    past = now - timedelta(days=1)
    future = now + timedelta(days=3)
    assert invoice_display_status("paid", past, now) == "paid"
    assert invoice_display_status("awaiting_payment", past, now) == "overdue"
    assert invoice_display_status("awaiting_payment", future, now) == "awaiting_payment"
    assert invoice_display_status("awaiting_payment", None, now) == "awaiting_payment"
    # Legacy spellings collapse into the single open state.
    assert invoice_display_status("pending", past, now) == "overdue"
    assert invoice_display_status("unpaid", past, now) == "overdue"
    assert invoice_display_status("pending", future, now) == "awaiting_payment"
    assert invoice_display_status("unpaid", future, now) == "awaiting_payment"
    assert invoice_display_status("", None, now) == "awaiting_payment"
    assert invoice_display_status(None, None, now) == "awaiting_payment"


def test_normalize_invoice_status():
    assert normalize_invoice_status("paid") == "paid"
    assert normalize_invoice_status("PAID ") == "paid"
    for legacy in ("pending", "unpaid", "", None, "awaiting_payment"):
        assert normalize_invoice_status(legacy) == "awaiting_payment"
