"""Company time zone handling.

Storage convention (unchanged): every datetime is persisted as *naive UTC*
(`datetime.utcnow()` into `timestamp without time zone`). This module is the
single place that converts those values to the company time zone for anything
a human reads:

- API JSON output (see `install_json_encoders` / `AppModel`) — emitted with an
  explicit UTC offset so browsers render in the viewer's own PC time zone.
- Server-rendered documents and emails (PDF dates, reminder emails).
- Document reference dates (QT/ORD/IN + YYYYMMDD).
- Date-range filters typed as calendar days by the user.

The zone is configured with `APP_TIMEZONE` and defaults to Africa/Nairobi.
"""
from __future__ import annotations

import logging
import os
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

logger = logging.getLogger(__name__)

DEFAULT_TIMEZONE = "Africa/Nairobi"
UTC = timezone.utc


def _load_zone() -> ZoneInfo:
    name = (os.getenv("APP_TIMEZONE") or DEFAULT_TIMEZONE).strip() or DEFAULT_TIMEZONE
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        logger.warning("APP_TIMEZONE=%r is not a valid IANA zone; falling back to %s", name, DEFAULT_TIMEZONE)
        return ZoneInfo(DEFAULT_TIMEZONE)


APP_TZ: ZoneInfo = _load_zone()
APP_TIMEZONE_NAME: str = APP_TZ.key


def as_utc(value: datetime) -> datetime:
    """Return an aware UTC datetime. Naive input is treated as UTC (storage convention)."""
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def to_app_tz(value: datetime) -> datetime:
    """Convert a stored (naive UTC) or aware datetime to the company time zone."""
    return as_utc(value).astimezone(APP_TZ)


def to_utc_naive(value: datetime) -> datetime:
    """Convert any datetime back to the naive-UTC storage form."""
    if value.tzinfo is None:
        return value
    return value.astimezone(UTC).replace(tzinfo=None)


def utc_now() -> datetime:
    """Naive UTC 'now' — the storage convention used throughout the codebase."""
    return datetime.utcnow()


def app_now() -> datetime:
    """Aware 'now' in the company time zone."""
    return datetime.now(APP_TZ)


def serialize_datetime(value: datetime) -> str:
    """ISO-8601 string in the company zone with explicit offset, e.g. 2026-09-22T13:02:42.381+03:00.

    Millisecond precision keeps the string parseable by every browser's Date().
    """
    return to_app_tz(value).isoformat(timespec="milliseconds")


def format_app(value: Optional[datetime], fmt: str, default: str = "") -> str:
    """strftime in the company time zone (for PDFs, emails, CSV exports)."""
    if value is None:
        return default
    if not isinstance(value, datetime):
        return str(value)
    return to_app_tz(value).strftime(fmt)


def app_date_stamp(value: Optional[datetime] = None) -> str:
    """YYYYMMDD of the given instant (default: now) as seen in the company zone."""
    moment = to_app_tz(value) if value is not None else app_now()
    return moment.strftime("%Y%m%d")


def local_day_start(value: Optional[str]) -> Optional[datetime]:
    """Naive-UTC instant at which the given calendar day (YYYY-MM-DD) begins in the company zone."""
    if not value:
        return None
    day = datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    start = datetime(day.year, day.month, day.day, tzinfo=APP_TZ)
    return to_utc_naive(start)


def local_day_end(value: Optional[str]) -> Optional[datetime]:
    """Exclusive end (naive UTC) of the given calendar day in the company zone."""
    if not value:
        return None
    day = datetime.strptime(str(value)[:10], "%Y-%m-%d").date() + timedelta(days=1)
    end = datetime(day.year, day.month, day.day, tzinfo=APP_TZ)
    return to_utc_naive(end)


def install_json_encoders() -> None:
    """Make FastAPI emit every datetime in the company zone with an explicit offset.

    Covers plain dict/list responses (the bulk of the API). Pydantic response
    models get the same behaviour through `models.base.AppModel`.
    """
    from fastapi import encoders

    encoders.ENCODERS_BY_TYPE[datetime] = serialize_datetime
    # Dates stay calendar dates; nothing to convert.
    encoders.ENCODERS_BY_TYPE.setdefault(date, lambda d: d.isoformat())
