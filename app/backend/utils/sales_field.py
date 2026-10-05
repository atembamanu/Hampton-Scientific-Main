"""Rules for sales field check-in, check-out, and private facility books."""

from __future__ import annotations

from typing import Iterable, Optional

from utils.contact_validation import is_valid_email, is_valid_phone
from utils.kenya_counties import KENYA_COUNTY_SET

FACILITY_TYPES = frozenset({
    "hospital",
    "clinic",
    "pharmacy",
    "laboratory",
    "medical_centre",
    "ngo",
    "other",
})

PROBABILITY_LABELS = {
    1: "Very unlikely",
    2: "Unlikely",
    3: "Possible",
    4: "Likely",
    5: "Very likely",
}

SNAPSHOT_KEYS = (
    "facility_name",
    "facility_type",
    "county",
    "address",
    "facility_phone",
    "facility_email",
    "contact_name",
    "contact_title",
    "contact_phone",
    "contact_email",
    "notes",
    "probability",
)


class FieldError(Exception):
    def __init__(self, detail: str, status_code: int = 400):
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def normalize_name(value: Optional[str]) -> str:
    return " ".join((value or "").strip().lower().split())


def outside_territory(county: Optional[str], assigned: Iterable[str]) -> bool:
    return (county or "") not in set(assigned)


def can_read_prospect(role: Optional[str], user_id: str, prospect) -> bool:
    if role in ("admin", "operations"):
        return True
    return role == "sales" and getattr(prospect, "agent_id", None) == user_id


def can_check_in(role: Optional[str], user_id: str, prospect) -> bool:
    return role == "sales" and getattr(prospect, "agent_id", None) == user_id


def clean_counties(counties: Iterable[str]) -> list[str]:
    cleaned: list[str] = []
    for county in counties:
        name = (county or "").strip()
        if name not in KENYA_COUNTY_SET:
            raise FieldError("Choose a county from the Kenya county list.")
        if name not in cleaned:
            cleaned.append(name)
    return cleaned


def assert_sales_agent(role: Optional[str]) -> None:
    if role != "sales":
        raise FieldError("Counties can only be assigned to sales agents.")


def require_coordinates(latitude, longitude, accuracy=None) -> tuple[float, float, Optional[float]]:
    if latitude is None or longitude is None:
        raise FieldError("Location is required. Allow location access and try again.")
    try:
        lat = float(latitude)
        lng = float(longitude)
    except (TypeError, ValueError):
        raise FieldError("Location is required. Allow location access and try again.")
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        raise FieldError("Location is invalid.")
    acc = None
    if accuracy is not None and accuracy != "":
        try:
            acc = float(accuracy)
        except (TypeError, ValueError):
            raise FieldError("Location accuracy is invalid.")
        if acc < 0:
            raise FieldError("Location accuracy is invalid.")
    return lat, lng, acc


def assert_can_check_in(open_visit) -> None:
    if open_visit is not None:
        raise FieldError(
            "Check out of the current visit before checking in again.",
            409,
        )


def matching_prospect(prospects, *, name: str, county: str, organization_id: Optional[str]):
    if organization_id:
        for row in prospects:
            if getattr(row, "organization_id", None) == organization_id:
                return row
    key = normalize_name(name)
    for row in prospects:
        if getattr(row, "facility_name_key", None) == key and getattr(row, "county", None) == county:
            return row
    return None


def _optional_text(value) -> Optional[str]:
    text = (value or "").strip()
    return text or None


def clean_snapshot(incoming: dict, *, require_complete: bool) -> dict:
    """Validate visit details. Partial updates only return keys that were sent."""
    out: dict = {}
    if require_complete or "facility_name" in incoming:
        name = (incoming.get("facility_name") or "").strip()
        if not name:
            raise FieldError("Facility name is required.")
        out["facility_name"] = name
    if require_complete or "facility_type" in incoming:
        facility_type = (incoming.get("facility_type") or "").strip()
        if not facility_type:
            raise FieldError("Facility type is required.")
        if facility_type not in FACILITY_TYPES:
            raise FieldError("Facility type is not recognised.")
        out["facility_type"] = facility_type
    if require_complete or "county" in incoming:
        county = (incoming.get("county") or "").strip()
        if county not in KENYA_COUNTY_SET:
            raise FieldError("Choose a Kenya county.")
        out["county"] = county
    if require_complete or "address" in incoming:
        out["address"] = _optional_text(incoming.get("address"))
    if require_complete or "facility_phone" in incoming:
        phone = _optional_text(incoming.get("facility_phone"))
        if phone and not is_valid_phone(phone):
            raise FieldError("Enter a valid facility phone number.")
        out["facility_phone"] = phone
    if require_complete or "facility_email" in incoming:
        email = _optional_text(incoming.get("facility_email"))
        if email and not is_valid_email(email):
            raise FieldError("Enter a valid facility email address.")
        out["facility_email"] = email.lower() if email else None
    if require_complete or "contact_name" in incoming:
        contact = (incoming.get("contact_name") or "").strip()
        if require_complete and not contact:
            raise FieldError("Enter who you met.")
        out["contact_name"] = contact or None
    if require_complete or "contact_title" in incoming:
        out["contact_title"] = _optional_text(incoming.get("contact_title"))
    if require_complete or "contact_phone" in incoming:
        phone = _optional_text(incoming.get("contact_phone"))
        if phone and not is_valid_phone(phone):
            raise FieldError("Enter a valid contact phone number.")
        out["contact_phone"] = phone
    if require_complete or "contact_email" in incoming:
        email = _optional_text(incoming.get("contact_email"))
        if email and not is_valid_email(email):
            raise FieldError("Enter a valid contact email address.")
        out["contact_email"] = email.lower() if email else None
    if require_complete or "notes" in incoming:
        out["notes"] = (incoming.get("notes") or "").strip()
    if require_complete or "probability" in incoming:
        raw = incoming.get("probability")
        if raw is None or raw == "":
            if require_complete:
                raise FieldError("Rate the probability of a deal.")
        else:
            try:
                score = int(raw)
            except (TypeError, ValueError):
                raise FieldError("Rate the probability from 1 to 5.")
            if score not in PROBABILITY_LABELS:
                raise FieldError("Rate the probability from 1 to 5.")
            out["probability"] = score
    return out


def read_snapshot(row) -> dict:
    return {key: getattr(row, key, None) for key in SNAPSHOT_KEYS}


def write_snapshot(row, data: dict) -> None:
    for key, value in data.items():
        if key in SNAPSHOT_KEYS:
            setattr(row, key, value)
    if "facility_name" in data and hasattr(row, "facility_name_key"):
        row.facility_name_key = normalize_name(data["facility_name"])


def ensure_no_collision(prospect_id: str, name: str, county: str, organization_id: Optional[str], siblings) -> None:
    key = normalize_name(name)
    for other in siblings:
        if getattr(other, "id", None) == prospect_id:
            continue
        if getattr(other, "facility_name_key", None) == key and getattr(other, "county", None) == county:
            raise FieldError("You already have a facility with this name in that county.", 409)
        if organization_id and getattr(other, "organization_id", None) == organization_id:
            raise FieldError("You already have a record for this registered facility.", 409)


def update_open_visit(visit, prospect, incoming: dict, siblings) -> dict:
    if getattr(visit, "checked_out_at", None) is not None:
        raise FieldError("This visit is already checked out.", 409)
    merged = read_snapshot(visit)
    merged.update(incoming)
    cleaned = clean_snapshot(merged, require_complete=False)
    # Only persist keys the caller sent, after validation against the merged draft.
    applied = {key: cleaned[key] for key in incoming if key in cleaned}
    if "facility_name" in incoming or "county" in incoming:
        name = cleaned.get("facility_name") or visit.facility_name
        county = cleaned.get("county") or visit.county
        ensure_no_collision(
            prospect.id,
            name,
            county,
            getattr(prospect, "organization_id", None),
            siblings,
        )
    write_snapshot(visit, applied)
    if int(getattr(prospect, "visit_count", 0) or 0) == 0:
        write_snapshot(prospect, applied)
    return applied


def complete_checkout(prospect, visit, latitude, longitude, accuracy, now, siblings) -> None:
    if getattr(visit, "checked_out_at", None) is not None:
        raise FieldError("This visit is already checked out.", 409)
    lat, lng, acc = (None, None, None)
    if latitude is not None or longitude is not None:
        lat, lng, acc = require_coordinates(latitude, longitude, accuracy)
    cleaned = clean_snapshot(read_snapshot(visit), require_complete=True)
    ensure_no_collision(
        prospect.id,
        cleaned["facility_name"],
        cleaned["county"],
        getattr(prospect, "organization_id", None),
        siblings,
    )
    write_snapshot(visit, cleaned)
    write_snapshot(prospect, cleaned)
    visit.checked_out_at = now
    visit.check_out_latitude = lat
    visit.check_out_longitude = lng
    visit.check_out_accuracy_m = acc
    prospect.visit_count = int(getattr(prospect, "visit_count", 0) or 0) + 1
    prospect.last_visited_at = now


def link_organization(prospect, organization_id: Optional[str], siblings) -> None:
    if organization_id:
        ensure_no_collision(
            prospect.id,
            prospect.facility_name,
            prospect.county,
            organization_id,
            siblings,
        )
    prospect.organization_id = organization_id
