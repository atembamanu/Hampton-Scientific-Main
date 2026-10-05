"""Monthly sales target, commission rate, and progress from paid invoices."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from utils.app_time import APP_TZ, app_now, to_app_tz, to_utc_naive
from utils.sales_field import FieldError

COMMISSION_BANDS = (
    {"key": "starter", "label": "Starter", "rate": 2.0},
    {"key": "standard", "label": "Standard", "rate": 5.0},
    {"key": "senior", "label": "Senior", "rate": 8.0},
)
BAND_BY_KEY = {band["key"]: band for band in COMMISSION_BANDS}
DEFAULT_BAND = "standard"
DEFAULT_COMMISSION_RATE = 1.5


def current_month_bounds(moment: Optional[datetime] = None) -> tuple[datetime, datetime, str]:
    """Naive-UTC start (inclusive) and end (exclusive) of the company-timezone month."""
    local = to_app_tz(moment) if moment is not None else app_now()
    start = datetime(local.year, local.month, 1, tzinfo=APP_TZ)
    if local.month == 12:
        end = datetime(local.year + 1, 1, 1, tzinfo=APP_TZ)
    else:
        end = datetime(local.year, local.month + 1, 1, tzinfo=APP_TZ)
    return to_utc_naive(start), to_utc_naive(end), local.strftime("%B %Y")


def rate_from_band(commission_band: Optional[str]) -> float:
    band = BAND_BY_KEY.get((commission_band or "").strip().lower())
    return float(band["rate"]) if band else DEFAULT_COMMISSION_RATE


def resolve_commission_rate(target) -> float:
    if target is None:
        return DEFAULT_COMMISSION_RATE
    stored = getattr(target, "commission_rate", None)
    if stored is not None:
        return round(float(stored), 4)
    return rate_from_band(getattr(target, "commission_band", None))


def clean_target(monthly_target, commission_rate=None, commission_band: str = "") -> tuple[float, float]:
    try:
        amount = float(monthly_target)
    except (TypeError, ValueError):
        raise FieldError("Enter a sales target amount.")
    if amount < 0:
        raise FieldError("The sales target cannot be negative.")
    if commission_rate is None or commission_rate == "":
        rate = rate_from_band(commission_band) if commission_band else DEFAULT_COMMISSION_RATE
    else:
        try:
            rate = float(commission_rate)
        except (TypeError, ValueError):
            raise FieldError("Enter a commission percentage.")
    if rate < 0 or rate > 100:
        raise FieldError("Commission must be between 0 and 100.")
    return round(amount, 2), round(rate, 4)


def invoice_counts_toward_target(invoice, organization_ids: set[str], start: datetime, end: datetime) -> bool:
    if getattr(invoice, "organization_id", None) not in organization_ids:
        return False
    if (getattr(invoice, "status", None) or "").lower() != "paid":
        return False
    stamped = getattr(invoice, "paid_at", None) or getattr(invoice, "created_at", None)
    if stamped is None or stamped < start or stamped >= end:
        return False
    return True


def invoice_net(invoice) -> float:
    total = float(getattr(invoice, "total", 0) or 0)
    tax = float(getattr(invoice, "tax_amount", 0) or 0)
    return round(max(0.0, total - tax), 2)


def achieved_amount(invoices, organization_ids: set[str], start: datetime, end: datetime) -> float:
    total = 0.0
    for invoice in invoices:
        if invoice_counts_toward_target(invoice, organization_ids, start, end):
            total += invoice_net(invoice)
    return round(total, 2)


def summarize_performance(
    *,
    target_amount: float,
    commission_rate: float | None = None,
    band_key: str = DEFAULT_BAND,
    achieved: float,
    facility_count: int,
    month_label: str,
) -> dict:
    rate = DEFAULT_COMMISSION_RATE if commission_rate is None else float(commission_rate)
    if commission_rate is None and band_key in BAND_BY_KEY:
        rate = BAND_BY_KEY[band_key]["rate"]
    band = BAND_BY_KEY.get(band_key) or BAND_BY_KEY[DEFAULT_BAND]
    target = float(target_amount or 0)
    done = float(achieved or 0)
    percent = round(done / target * 100, 1) if target > 0 else None
    return {
        "month": month_label,
        "monthlyTarget": target,
        "achieved": round(done, 2),
        "progressPercent": percent,
        "targetSet": target > 0,
        "facilityCount": int(facility_count or 0),
        "commissionBand": band["key"],
        "commissionBandLabel": band["label"],
        "commissionRate": rate,
        "estimatedCommission": round(done * rate / 100, 2),
    }
