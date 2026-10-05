"""Daily sales workday: one check-in and check-out per company-timezone day."""

from datetime import datetime
from typing import Optional

from utils.app_time import app_now, to_app_tz
from utils.sales_field import FieldError


def company_work_date(moment: Optional[datetime] = None):
    local = app_now() if moment is None else to_app_tz(moment)
    return local.date()


def assert_activity_allowed(open_workday, today_closed: bool) -> None:
    if open_workday is not None:
        return
    if today_closed:
        raise FieldError("You have already checked out for today.", 409)


def assert_can_close_day(open_visit) -> None:
    if open_visit is not None:
        raise FieldError("Confirm this facility's end time before checking out for the day.", 409)


def hours_worked(started_at: datetime, ended_at: Optional[datetime]) -> float:
    end = ended_at or datetime.utcnow()
    seconds = (end - started_at).total_seconds()
    return round(max(seconds, 0) / 3600, 2)


def facility_total(visit_keys, organization_keys) -> int:
    return len({key for key in visit_keys if key} | {key for key in organization_keys if key})
