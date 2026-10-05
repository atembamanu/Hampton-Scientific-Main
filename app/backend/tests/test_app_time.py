from datetime import datetime, timezone

from fastapi.encoders import jsonable_encoder

from utils import app_time
from utils.app_time import (
    APP_TIMEZONE_NAME,
    app_date_stamp,
    format_app,
    install_json_encoders,
    local_day_end,
    local_day_start,
    serialize_datetime,
    to_app_tz,
)
from utils.list_query import parse_day_end, parse_day_start
from models.user import UserResponse


def test_default_zone_is_nairobi():
    assert APP_TIMEZONE_NAME == "Africa/Nairobi"


def test_naive_storage_value_is_treated_as_utc_and_shifted_to_nairobi():
    stored = datetime(2026, 9, 22, 10, 2, 42, 381563)  # naive UTC, as read from Postgres
    local = to_app_tz(stored)
    assert (local.hour, local.minute, local.second) == (13, 2, 42)
    assert local.utcoffset().total_seconds() == 3 * 3600


def test_serialize_datetime_carries_offset_and_millisecond_precision():
    stored = datetime(2026, 9, 22, 10, 2, 42, 381563)
    assert serialize_datetime(stored) == "2026-09-22T13:02:42.381+03:00"


def test_aware_input_is_converted_not_relabelled():
    aware = datetime(2026, 9, 22, 10, 2, 42, tzinfo=timezone.utc)
    assert serialize_datetime(aware) == "2026-09-22T13:02:42.000+03:00"


def test_format_app_and_date_stamp_use_company_calendar_day():
    late_evening_utc = datetime(2026, 9, 22, 22, 30)  # already 23 Sep in Nairobi
    assert format_app(late_evening_utc, "%B %d, %Y") == "September 23, 2026"
    assert app_date_stamp(late_evening_utc) == "20260923"
    assert format_app(None, "%Y", default="N/A") == "N/A"


def test_day_bounds_are_nairobi_midnights_expressed_in_utc():
    assert local_day_start("2026-09-22") == datetime(2026, 9, 21, 21, 0)
    assert local_day_end("2026-09-22") == datetime(2026, 9, 22, 21, 0)
    assert local_day_start(None) is None and local_day_end("") is None
    # list_query wrappers delegate to the same logic
    assert parse_day_start("2026-09-22T00:00:00") == local_day_start("2026-09-22")
    assert parse_day_end("2026-09-22") == local_day_end("2026-09-22")


def test_fastapi_dict_responses_emit_company_zone_offsets():
    install_json_encoders()
    payload = jsonable_encoder({"created_at": datetime(2026, 9, 22, 10, 2, 42)})
    assert payload["created_at"] == "2026-09-22T13:02:42.000+03:00"


def test_pydantic_response_models_emit_company_zone_offsets():
    user = UserResponse(
        id="u1", firstName="A", lastName="B", email="a@b.com", phone="", facilityName="",
        facilityType=None, address="", city="", postalCode=None, role="admin",
        can_login=True, created_at=datetime(2026, 9, 22, 10, 2, 42),
    )
    dumped = jsonable_encoder(user)
    assert dumped["created_at"] == "2026-09-22T13:02:42.000+03:00"
    assert dumped["email"] == "a@b.com"


def test_invalid_zone_falls_back_to_default(monkeypatch):
    monkeypatch.setenv("APP_TIMEZONE", "Mars/Olympus_Mons")
    assert app_time._load_zone().key == app_time.DEFAULT_TIMEZONE
