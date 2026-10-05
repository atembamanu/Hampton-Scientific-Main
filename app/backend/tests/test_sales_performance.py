from datetime import datetime
from types import SimpleNamespace

import pytest

from utils.sales_field import FieldError
from utils.sales_performance import (
    DEFAULT_COMMISSION_RATE,
    achieved_amount,
    clean_target,
    current_month_bounds,
    invoice_counts_toward_target,
    summarize_performance,
)


def test_month_bounds_follow_the_company_timezone():
    # 2026-09-30 22:30 UTC is 2026-10-01 01:30 in Nairobi, so the month is October.
    start, end, label = current_month_bounds(datetime(2026, 9, 30, 22, 30))
    assert label == "October 2026"
    assert start == datetime(2026, 9, 30, 21, 0)
    assert end == datetime(2026, 10, 31, 21, 0)


def test_progress_uses_paid_invoices_net_of_tax():
    start, end, _label = current_month_bounds(datetime(2026, 9, 15, 10, 0))
    mine = {"org-a"}
    invoices = [
        SimpleNamespace(organization_id="org-a", total=40000, tax_amount=4000, status="awaiting_payment", paid_at=None, created_at=datetime(2026, 9, 10, 8, 0)),
        SimpleNamespace(organization_id="org-a", total=11600, tax_amount=1600, status="paid", paid_at=datetime(2026, 9, 20, 8, 0), created_at=datetime(2026, 9, 18, 8, 0)),
        SimpleNamespace(organization_id="org-b", total=99999, tax_amount=0, status="paid", paid_at=datetime(2026, 9, 12, 8, 0), created_at=datetime(2026, 9, 12, 8, 0)),
        SimpleNamespace(organization_id="org-a", total=5000, tax_amount=0, status="cancelled", paid_at=None, created_at=datetime(2026, 9, 12, 8, 0)),
        SimpleNamespace(organization_id="org-a", total=8000, tax_amount=0, status="paid", paid_at=datetime(2026, 8, 31, 20, 0), created_at=datetime(2026, 8, 31, 20, 0)),
    ]
    assert achieved_amount(invoices, mine, start, end) == 10000
    assert not invoice_counts_toward_target(invoices[0], mine, start, end)
    assert not invoice_counts_toward_target(invoices[2], mine, start, end)


def test_commission_uses_decimal_rate_on_net_paid():
    summary = summarize_performance(
        target_amount=100000,
        commission_rate=1.5,
        achieved=25000,
        facility_count=2,
        month_label="September 2026",
    )
    assert summary["progressPercent"] == 25.0
    assert summary["commissionRate"] == 1.5
    assert summary["estimatedCommission"] == 375
    unset = summarize_performance(
        target_amount=0,
        commission_rate=DEFAULT_COMMISSION_RATE,
        achieved=1000,
        facility_count=1,
        month_label="September 2026",
    )
    assert unset["progressPercent"] is None
    assert unset["targetSet"] is False
    assert unset["estimatedCommission"] == 15


def test_target_assignment_accepts_decimal_commission():
    amount, rate = clean_target("150000", 1.5)
    assert amount == 150000
    assert rate == 1.5
    amount, rate = clean_target(1000, "2.25")
    assert rate == 2.25
    with pytest.raises(FieldError):
        clean_target(-1, 1.5)
    with pytest.raises(FieldError):
        clean_target(1000, 120)
