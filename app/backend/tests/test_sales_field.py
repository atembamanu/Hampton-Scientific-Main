from datetime import datetime
from types import SimpleNamespace

import pytest

from utils.permissions import company_has_permission, get_permissions_for_role
from utils.sales_field import (
    FieldError,
    assert_can_check_in,
    assert_sales_agent,
    can_check_in,
    can_read_prospect,
    clean_counties,
    clean_snapshot,
    complete_checkout,
    link_organization,
    outside_territory,
    read_snapshot,
    require_coordinates,
    update_open_visit,
)


def _prospect(**overrides):
    data = dict(
        id="p1",
        agent_id="agent-1",
        organization_id=None,
        facility_name="City Clinic",
        facility_name_key="city clinic",
        facility_type="clinic",
        county="Nairobi",
        address="Ngong Road",
        facility_phone="0712345678",
        facility_email="clinic@example.com",
        contact_name="Jane Wanjiku",
        contact_title="Buyer",
        contact_phone="0722000111",
        contact_email="jane@example.com",
        notes="First meeting",
        probability=2,
        visit_count=0,
        last_visited_at=None,
    )
    data.update(overrides)
    return SimpleNamespace(**data)


def _visit(prospect, **overrides):
    data = read_snapshot(prospect)
    data.update(
        id="v1",
        prospect_id=prospect.id,
        agent_id=prospect.agent_id,
        checked_in_at=datetime(2026, 9, 1, 8, 0),
        checked_out_at=None,
        check_in_latitude=-1.29,
        check_in_longitude=36.82,
        check_in_accuracy_m=10,
        check_out_latitude=None,
        check_out_longitude=None,
        check_out_accuracy_m=None,
    )
    data.update(overrides)
    return SimpleNamespace(**data)


def test_field_permission_is_on_company_roles():
    for role in ("sales", "operations", "admin"):
        assert company_has_permission(role, "field")
        assert "field" in get_permissions_for_role(role)


def test_checkout_freezes_visit_and_appends_the_next_one():
    prospect = _prospect()
    first = _visit(prospect)
    complete_checkout(prospect, first, -1.29, 36.82, 15, datetime(2026, 9, 1, 9, 0), [])
    assert first.checked_out_at == datetime(2026, 9, 1, 9, 0)
    assert first.check_out_latitude == -1.29
    assert prospect.visit_count == 1
    assert prospect.notes == "First meeting"
    assert prospect.last_visited_at == first.checked_out_at

    second = _visit(prospect, id="v2", notes="Asked for a quote next week", probability=4)
    complete_checkout(prospect, second, -1.30, 36.81, 8, datetime(2026, 9, 8, 10, 30), [])

    assert first.notes == "First meeting"
    assert first.probability == 2
    assert first.checked_out_at == datetime(2026, 9, 1, 9, 0)
    assert second.notes == "Asked for a quote next week"
    assert prospect.notes == "Asked for a quote next week"
    assert prospect.probability == 4
    assert prospect.visit_count == 2


def test_second_check_in_is_rejected_and_visit_end_does_not_need_a_location():
    with pytest.raises(FieldError) as open_visit:
        assert_can_check_in(SimpleNamespace(id="open"))
    assert open_visit.value.status_code == 409
    assert_can_check_in(None)

    with pytest.raises(FieldError):
        require_coordinates(None, 36.8, None)

    prospect = _prospect()
    visit = _visit(prospect)
    complete_checkout(prospect, visit, None, None, None, datetime(2026, 9, 1, 9, 0), [])
    assert visit.checked_out_at == datetime(2026, 9, 1, 9, 0)
    assert visit.check_out_latitude is None
    assert prospect.visit_count == 1


def test_checkout_is_immutable():
    prospect = _prospect(visit_count=1)
    visit = _visit(prospect, checked_out_at=datetime(2026, 9, 1, 9, 0))
    with pytest.raises(FieldError):
        complete_checkout(prospect, visit, -1.2, 36.8, 5, datetime(2026, 9, 2, 9, 0), [])
    with pytest.raises(FieldError):
        update_open_visit(visit, prospect, {"notes": "Changed"}, [])
    assert visit.notes == "First meeting"
    assert prospect.visit_count == 1


def test_visit_outside_assigned_county_is_allowed_and_flagged():
    assigned = ["Nairobi"]
    assert outside_territory("Mombasa", assigned) is True
    assert outside_territory("Nairobi", assigned) is False
    cleaned = clean_snapshot(
        {
            "facility_name": "Coast Hospital",
            "facility_type": "hospital",
            "county": "Mombasa",
            "contact_name": "Peter Otieno",
            "probability": 3,
            "notes": "Walk-in visit",
        },
        require_complete=True,
    )
    assert cleaned["county"] == "Mombasa"


def test_linking_organization_keeps_the_timeline():
    prospect = _prospect(visit_count=2, notes="Latest")
    visit = _visit(prospect, notes="Older visit", checked_out_at=datetime(2026, 8, 1, 9, 0))
    link_organization(prospect, "org-99", [])
    assert prospect.organization_id == "org-99"
    assert prospect.visit_count == 2
    assert prospect.notes == "Latest"
    assert visit.notes == "Older visit"
    assert visit.checked_out_at == datetime(2026, 8, 1, 9, 0)


def test_sales_agent_cannot_open_another_agents_book():
    prospect = _prospect()
    assert can_read_prospect("sales", "agent-1", prospect)
    assert can_check_in("sales", "agent-1", prospect)
    assert not can_read_prospect("sales", "agent-2", prospect)
    assert not can_check_in("sales", "agent-2", prospect)
    assert can_read_prospect("admin", "agent-2", prospect)
    assert can_read_prospect("operations", "agent-2", prospect)
    assert not can_check_in("operations", "agent-2", prospect)


def test_county_assignment_accepts_only_kenya_counties_for_sales():
    assert clean_counties(["Nairobi", "Kiambu", "Nairobi"]) == ["Nairobi", "Kiambu"]
    with pytest.raises(FieldError):
        clean_counties(["Not a county"])
    assert_sales_agent("sales")
    with pytest.raises(FieldError):
        assert_sales_agent("operations")


def test_draft_on_a_revisit_does_not_replace_the_latest_snapshot():
    prospect = _prospect(visit_count=1, notes="Latest completed")
    draft = _visit(prospect, notes="Latest completed")
    update_open_visit(draft, prospect, {"notes": "Still in the meeting"}, [])
    assert draft.notes == "Still in the meeting"
    assert prospect.notes == "Latest completed"
    assert prospect.visit_count == 1
