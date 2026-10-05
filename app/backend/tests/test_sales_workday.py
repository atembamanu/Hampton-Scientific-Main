from datetime import datetime

import pytest

from utils.sales_field import FieldError
from utils.sales_workday import assert_activity_allowed, assert_can_close_day, facility_total, hours_worked


def test_first_action_starts_the_day_and_a_later_one_does_not():
    assert_activity_allowed(None, False)
    assert_activity_allowed(object(), False)
    assert_activity_allowed(object(), True)


def test_activity_after_checkout_is_refused():
    with pytest.raises(FieldError) as err:
        assert_activity_allowed(None, True)
    assert err.value.status_code == 409


def test_day_checkout_waits_for_the_facility_end_time():
    with pytest.raises(FieldError):
        assert_can_close_day(object())
    assert_can_close_day(None)


def test_hours_and_facility_count():
    start = datetime(2026, 9, 29, 6, 0)
    end = datetime(2026, 9, 29, 14, 30)
    assert hours_worked(start, end) == 8.5
    assert facility_total(["a", "a", "b"], ["org-1"]) == 3
