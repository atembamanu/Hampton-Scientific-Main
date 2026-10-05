import uuid
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from db.models import Invoice, Organization, SalesAgentCounty, SalesAgentTarget, SalesProspect, SalesVisit, SalesWorkday, User
from deps import get_db
from models.facility import FacilityRegistration
from models.user import UserResponse
from utils.facility_registration import register_facility_account
from utils.kenya_counties import KENYA_COUNTIES, KENYA_COUNTY_SET
from utils.list_query import clamp_page, paginated_payload, parse_day_end, parse_day_start
from utils.permissions import require_company_permission
from utils.sales_field import (
    PROBABILITY_LABELS,
    FieldError,
    assert_can_check_in,
    assert_sales_agent,
    can_check_in,
    can_read_prospect,
    clean_counties,
    clean_snapshot,
    complete_checkout,
    ensure_no_collision,
    link_organization,
    matching_prospect,
    normalize_name,
    outside_territory,
    read_snapshot,
    require_coordinates,
    update_open_visit,
    write_snapshot,
)
from utils.sales_workday import (
    assert_activity_allowed,
    assert_can_close_day,
    company_work_date,
    facility_total,
    hours_worked,
)
from utils.sales_performance import (
    BAND_BY_KEY,
    COMMISSION_BANDS,
    DEFAULT_BAND,
    DEFAULT_COMMISSION_RATE,
    achieved_amount,
    clean_target,
    current_month_bounds,
    resolve_commission_rate,
    summarize_performance,
)

router = APIRouter()

_CAMEL = {
    "facility_name": "facilityName",
    "facility_type": "facilityType",
    "facility_phone": "facilityPhone",
    "facility_email": "facilityEmail",
    "contact_name": "contactName",
    "contact_title": "contactTitle",
    "contact_phone": "contactPhone",
    "contact_email": "contactEmail",
}


def _http(err: FieldError) -> None:
    raise HTTPException(status_code=err.status_code, detail=err.detail)


def _snapshot_in(body: dict) -> dict:
    incoming = {}
    reverse = {camel: snake for snake, camel in _CAMEL.items()}
    for key, value in body.items():
        if key in reverse:
            incoming[reverse[key]] = value
        elif key in ("county", "address", "notes", "probability"):
            incoming[key] = value
    return incoming


def _snapshot_out(row) -> dict:
    raw = read_snapshot(row)
    payload = {}
    for key, value in raw.items():
        payload[_CAMEL.get(key, key)] = value
    if payload.get("probability") in PROBABILITY_LABELS:
        payload["probabilityLabel"] = PROBABILITY_LABELS[payload["probability"]]
    else:
        payload["probabilityLabel"] = None
    return payload


def _agent_counties(db: Session, agent_id: str) -> list[str]:
    rows = (
        db.query(SalesAgentCounty.county)
        .filter(SalesAgentCounty.user_id == agent_id)
        .order_by(SalesAgentCounty.county.asc())
        .all()
    )
    return [row[0] for row in rows]


def _county_map(db: Session, agent_ids: list[str]) -> dict[str, set[str]]:
    if not agent_ids:
        return {}
    rows = (
        db.query(SalesAgentCounty)
        .filter(SalesAgentCounty.user_id.in_(agent_ids))
        .all()
    )
    grouped: dict[str, set[str]] = {agent_id: set() for agent_id in agent_ids}
    for row in rows:
        grouped.setdefault(row.user_id, set()).add(row.county)
    return grouped


def _open_visit_for_agent(db: Session, agent_id: str) -> Optional[SalesVisit]:
    return (
        db.query(SalesVisit)
        .filter(SalesVisit.agent_id == agent_id, SalesVisit.checked_out_at.is_(None))
        .one_or_none()
    )


def _optional_coordinates(latitude, longitude, accuracy):
    if latitude is None and longitude is None:
        return None, None, None
    return require_coordinates(latitude, longitude, accuracy)


def _open_workday(db: Session, agent_id: str) -> Optional[SalesWorkday]:
    return (
        db.query(SalesWorkday)
        .filter(SalesWorkday.agent_id == agent_id, SalesWorkday.checked_out_at.is_(None))
        .one_or_none()
    )


def ensure_workday(db: Session, agent_id: str, moment: datetime) -> SalesWorkday:
    open_day = _open_workday(db, agent_id)
    today = company_work_date(moment)
    today_row = (
        db.query(SalesWorkday)
        .filter(SalesWorkday.agent_id == agent_id, SalesWorkday.work_date == today)
        .one_or_none()
    )
    try:
        assert_activity_allowed(open_day, bool(today_row and today_row.checked_out_at))
    except FieldError as err:
        _http(err)
    if open_day:
        return open_day
    row = SalesWorkday(
        id=str(uuid.uuid4()),
        agent_id=agent_id,
        work_date=today,
        checked_in_at=moment,
        created_at=moment,
    )
    db.add(row)
    return row


def _workday_facility_count(db: Session, workday: SalesWorkday) -> int:
    end = workday.checked_out_at or datetime.utcnow()
    visit_keys = [
        row[0]
        for row in db.query(SalesVisit.prospect_id)
        .filter(
            SalesVisit.agent_id == workday.agent_id,
            SalesVisit.checked_in_at >= workday.checked_in_at,
            SalesVisit.checked_in_at <= end,
        )
        .distinct()
        .all()
    ]
    org_keys = [
        row[0]
        for row in db.query(Organization.id)
        .filter(
            Organization.registered_by_user_id == workday.agent_id,
            Organization.created_at >= workday.checked_in_at,
            Organization.created_at <= end,
        )
        .all()
    ]
    return facility_total(visit_keys, org_keys)


def _workday_payload(db: Session, workday: Optional[SalesWorkday], agent_name: Optional[str] = None) -> Optional[dict]:
    if workday is None:
        return None
    ended = workday.checked_out_at
    return {
        "id": workday.id,
        "agentId": workday.agent_id,
        "agentName": agent_name,
        "workDate": workday.work_date.isoformat(),
        "checkedInAt": workday.checked_in_at,
        "checkedOutAt": ended,
        "open": ended is None,
        "hours": hours_worked(workday.checked_in_at, ended),
        "facilityCount": _workday_facility_count(db, workday),
    }


def _siblings(db: Session, agent_id: str) -> list[SalesProspect]:
    return db.query(SalesProspect).filter(SalesProspect.agent_id == agent_id).all()


def _require_reader(user: UserResponse, prospect: SalesProspect) -> None:
    if not can_read_prospect(user.role, user.id, prospect):
        raise HTTPException(status_code=404, detail="Facility not found.")


def _require_owner(user: UserResponse, prospect: SalesProspect) -> None:
    if not can_check_in(user.role, user.id, prospect):
        raise HTTPException(status_code=403, detail="Only the sales agent for this facility can check in.")


def _prospect_or_404(db: Session, prospect_id: str) -> SalesProspect:
    row = db.query(SalesProspect).filter(SalesProspect.id == prospect_id).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Facility not found.")
    return row


def _visit_payload(visit: SalesVisit) -> dict:
    return {
        "id": visit.id,
        "prospectId": visit.prospect_id,
        "agentId": visit.agent_id,
        "checkedInAt": visit.checked_in_at,
        "checkInLatitude": visit.check_in_latitude,
        "checkInLongitude": visit.check_in_longitude,
        "checkInAccuracyM": visit.check_in_accuracy_m,
        "checkedOutAt": visit.checked_out_at,
        "checkOutLatitude": visit.check_out_latitude,
        "checkOutLongitude": visit.check_out_longitude,
        "checkOutAccuracyM": visit.check_out_accuracy_m,
        "open": visit.checked_out_at is None,
        **_snapshot_out(visit),
    }


def _prospect_payload(prospect: SalesProspect, assigned: set[str], open_visit: Optional[SalesVisit], agent_name: Optional[str] = None, organization_name: Optional[str] = None, latest_visit: Optional[SalesVisit] = None) -> dict:
    display = open_visit if open_visit is not None else prospect
    timing = open_visit or latest_visit
    return {
        "id": prospect.id,
        "agentId": prospect.agent_id,
        "agentName": agent_name,
        "organizationId": prospect.organization_id,
        "organizationName": organization_name,
        "registered": bool(prospect.organization_id),
        "visitKind": "Registered" if prospect.organization_id else "Walk-in",
        "visitCount": prospect.visit_count or 0,
        "lastVisitedAt": prospect.last_visited_at,
        "visitStartedAt": timing.checked_in_at if timing else None,
        "visitEndedAt": None if timing is None or timing.checked_out_at is None else timing.checked_out_at,
        "outsideTerritory": outside_territory(display.county if open_visit else prospect.county, assigned),
        "openVisitId": open_visit.id if open_visit else None,
        "checkedIn": open_visit is not None,
        **_snapshot_out(display),
    }


class CountyAssignment(BaseModel):
    counties: list[str] = Field(default_factory=list)


class CheckInBody(BaseModel):
    prospectId: Optional[str] = None
    organizationId: Optional[str] = None
    facilityName: Optional[str] = None
    facilityType: Optional[str] = None
    county: Optional[str] = None
    address: Optional[str] = None
    facilityPhone: Optional[str] = None
    facilityEmail: Optional[str] = None
    contactName: Optional[str] = None
    contactTitle: Optional[str] = None
    contactPhone: Optional[str] = None
    contactEmail: Optional[str] = None
    notes: Optional[str] = None
    probability: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracyM: Optional[float] = None


class VisitPatch(BaseModel):
    facilityName: Optional[str] = None
    facilityType: Optional[str] = None
    county: Optional[str] = None
    address: Optional[str] = None
    facilityPhone: Optional[str] = None
    facilityEmail: Optional[str] = None
    contactName: Optional[str] = None
    contactTitle: Optional[str] = None
    contactPhone: Optional[str] = None
    contactEmail: Optional[str] = None
    notes: Optional[str] = None
    probability: Optional[int] = None


class CheckOutBody(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracyM: Optional[float] = None


class OrganizationLink(BaseModel):
    organizationId: Optional[str] = None


@router.get("/field/counties")
def list_counties(_user: UserResponse = Depends(require_company_permission("field"))):
    return {"counties": list(KENYA_COUNTIES)}


@router.get("/field/agents/{user_id}/counties")
def get_agent_counties(
    user_id: str,
    db: Session = Depends(get_db),
    _user: UserResponse = Depends(require_company_permission("company_users")),
):
    target = db.query(User).filter(User.id == user_id).one_or_none()
    if not target or target.organization_id or target.role not in ("admin", "operations", "sales"):
        raise HTTPException(status_code=404, detail="Sales agent not found.")
    return {"userId": user_id, "counties": _agent_counties(db, user_id)}


@router.put("/field/agents/{user_id}/counties")
def put_agent_counties(
    user_id: str,
    body: CountyAssignment,
    db: Session = Depends(get_db),
    _user: UserResponse = Depends(require_company_permission("company_users")),
):
    target = db.query(User).filter(User.id == user_id).one_or_none()
    if not target or target.organization_id or target.role not in ("admin", "operations", "sales"):
        raise HTTPException(status_code=404, detail="Sales agent not found.")
    try:
        assert_sales_agent(target.role)
        counties = clean_counties(body.counties)
    except FieldError as err:
        _http(err)
    db.query(SalesAgentCounty).filter(SalesAgentCounty.user_id == user_id).delete(synchronize_session=False)
    for county in counties:
        db.add(SalesAgentCounty(id=str(uuid.uuid4()), user_id=user_id, county=county))
    db.commit()
    return {"userId": user_id, "counties": counties}


@router.get("/field/agents")
def list_field_agents(
    db: Session = Depends(get_db),
    user: UserResponse = Depends(require_company_permission("field")),
):
    if user.role == "sales":
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    rows = (
        db.query(User)
        .filter(User.role == "sales", User.organization_id.is_(None))
        .order_by(User.first_name.asc(), User.last_name.asc())
        .all()
    )
    return {
        "agents": [
            {"id": row.id, "name": f"{row.first_name} {row.last_name}".strip(), "email": row.email}
            for row in rows
        ]
    }


def _csv(value: Optional[str]) -> list[str]:
    if not value:
        return []
    return [part.strip() for part in str(value).split(",") if part.strip()]


@router.get("/field/prospects")
def list_prospects(
    page: int = Query(1),
    limit: int = Query(20),
    agent_id: Optional[str] = None,
    county: Optional[str] = None,
    registered: Optional[str] = None,
    search: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db),
    user: UserResponse = Depends(require_company_permission("field")),
):
    page_n, limit_n, skip = clamp_page(page, limit)
    query = db.query(SalesProspect)
    if user.role == "sales":
        query = query.filter(SalesProspect.agent_id == user.id)
    else:
        agents = _csv(agent_id)
        if agents:
            query = query.filter(SalesProspect.agent_id.in_(agents))
    counties = _csv(county)
    if counties:
        query = query.filter(SalesProspect.county.in_(counties))
    kinds = set(_csv(registered))
    if kinds == {"registered"}:
        query = query.filter(SalesProspect.organization_id.isnot(None))
    elif kinds == {"prospect"}:
        query = query.filter(SalesProspect.organization_id.is_(None))
    start = parse_day_start(from_date)
    end = parse_day_end(to_date)
    if start:
        query = query.filter(SalesProspect.last_visited_at >= start)
    if end:
        query = query.filter(SalesProspect.last_visited_at < end)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(or_(
            SalesProspect.facility_name.ilike(term),
            SalesProspect.contact_name.ilike(term),
            SalesProspect.county.ilike(term),
            SalesProspect.notes.ilike(term),
        ))
    total = query.count()
    rows = (
        query.order_by(SalesProspect.last_visited_at.desc().nullslast(), SalesProspect.updated_at.desc())
        .offset(skip)
        .limit(limit_n)
        .all()
    )
    prospect_ids = [row.id for row in rows]
    open_by_prospect = {}
    if prospect_ids:
        open_rows = (
            db.query(SalesVisit)
            .filter(SalesVisit.prospect_id.in_(prospect_ids), SalesVisit.checked_out_at.is_(None))
            .all()
        )
        open_by_prospect = {row.prospect_id: row for row in open_rows}
    latest_by_prospect = {}
    if prospect_ids:
        history = (
            db.query(SalesVisit)
            .filter(SalesVisit.prospect_id.in_(prospect_ids))
            .order_by(SalesVisit.checked_in_at.desc())
            .all()
        )
        for visit in history:
            latest_by_prospect.setdefault(visit.prospect_id, visit)
    agent_ids = list({row.agent_id for row in rows})
    county_map = _county_map(db, agent_ids)
    names = {}
    org_names = {}
    if agent_ids:
        for agent in db.query(User).filter(User.id.in_(agent_ids)).all():
            names[agent.id] = f"{agent.first_name} {agent.last_name}".strip()
    org_ids = [row.organization_id for row in rows if row.organization_id]
    if org_ids:
        for org in db.query(Organization).filter(Organization.id.in_(org_ids)).all():
            org_names[org.id] = org.name
    items = [
        _prospect_payload(
            row,
            county_map.get(row.agent_id, set()),
            open_by_prospect.get(row.id),
            names.get(row.agent_id),
            org_names.get(row.organization_id),
            latest_by_prospect.get(row.id),
        )
        for row in rows
    ]
    payload = paginated_payload(items, total, page_n, limit_n)
    payload["prospects"] = items
    if user.role == "sales":
        payload["assignedCounties"] = _agent_counties(db, user.id)
        open_visit = _open_visit_for_agent(db, user.id)
        payload["openVisit"] = _visit_payload(open_visit) if open_visit else None
        payload["workday"] = _workday_payload(db, _open_workday(db, user.id) or db.query(SalesWorkday).filter(
            SalesWorkday.agent_id == user.id,
            SalesWorkday.work_date == company_work_date(datetime.utcnow()),
        ).one_or_none())
    else:
        payload["assignedCounties"] = []
        payload["openVisit"] = None
    return payload


@router.get("/field/organizations")
def search_organizations(
    search: str = Query(""),
    db: Session = Depends(get_db),
    user: UserResponse = Depends(require_company_permission("field")),
):
    if user.role != "sales":
        raise HTTPException(status_code=403, detail="Only sales agents can link a facility while checking in.")
    term = search.strip()
    query = db.query(Organization)
    if term:
        like = f"%{term}%"
        query = query.filter(or_(
            Organization.name.ilike(like),
            Organization.county.ilike(like),
            Organization.phone.ilike(like),
        ))
    rows = query.order_by(Organization.name.asc()).limit(20).all()
    return {
        "organizations": [
            {
                "id": row.id,
                "name": row.name,
                "facilityType": row.facility_type,
                "county": row.county,
                "phone": row.phone,
                "email": row.email,
                "addressLine": row.address_line,
            }
            for row in rows
        ]
    }


@router.get("/field/organizations/{org_id}/agents")
def organization_agents(
    org_id: str,
    db: Session = Depends(get_db),
    user: UserResponse = Depends(require_company_permission("field")),
):
    if user.role == "sales":
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    org = db.query(Organization).filter(Organization.id == org_id).one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Facility not found.")
    rows = (
        db.query(SalesProspect)
        .filter(SalesProspect.organization_id == org_id)
        .order_by(SalesProspect.visit_count.desc())
        .all()
    )
    county_map = _county_map(db, [row.agent_id for row in rows])
    agents = []
    for row in rows:
        agent = db.query(User).filter(User.id == row.agent_id).one_or_none()
        agents.append({
            "prospectId": row.id,
            "agentId": row.agent_id,
            "agentName": f"{agent.first_name} {agent.last_name}".strip() if agent else "Sales agent",
            "visitCount": row.visit_count or 0,
            "lastVisitedAt": row.last_visited_at,
            "county": row.county,
            "facilityName": row.facility_name,
            "outsideTerritory": outside_territory(row.county, county_map.get(row.agent_id, set())),
        })
    return {"agents": agents}


@router.get("/field/prospects/{prospect_id}")
def get_prospect(
    prospect_id: str,
    db: Session = Depends(get_db),
    user: UserResponse = Depends(require_company_permission("field")),
):
    prospect = _prospect_or_404(db, prospect_id)
    _require_reader(user, prospect)
    visits = (
        db.query(SalesVisit)
        .filter(SalesVisit.prospect_id == prospect.id)
        .order_by(SalesVisit.checked_in_at.desc())
        .all()
    )
    open_visit = next((row for row in visits if row.checked_out_at is None), None)
    assigned = set(_agent_counties(db, prospect.agent_id))
    agent = db.query(User).filter(User.id == prospect.agent_id).one_or_none()
    org = None
    if prospect.organization_id:
        org = db.query(Organization).filter(Organization.id == prospect.organization_id).one_or_none()
    current_row = open_visit or prospect
    workday = None
    if user.role == "sales" and user.id == prospect.agent_id:
        workday = _workday_payload(db, _open_workday(db, user.id) or db.query(SalesWorkday).filter(
            SalesWorkday.agent_id == user.id,
            SalesWorkday.work_date == company_work_date(datetime.utcnow()),
        ).one_or_none())
    return {
        "workday": workday,
        "prospect": _prospect_payload(
            prospect,
            assigned,
            open_visit,
            f"{agent.first_name} {agent.last_name}".strip() if agent else None,
            org.name if org else None,
        ),
        "current": _snapshot_out(current_row),
        "openVisit": _visit_payload(open_visit) if open_visit else None,
        "visits": [_visit_payload(row) for row in visits],
        "assignedCounties": sorted(assigned),
    }


def _apply_org_defaults(db: Session, organization_id: Optional[str], incoming: dict) -> dict:
    if not organization_id:
        return incoming
    org = db.query(Organization).filter(Organization.id == organization_id).one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Registered facility not found.")
    filled = dict(incoming)
    filled.setdefault("facility_name", org.name)
    if not filled.get("facility_name"):
        filled["facility_name"] = org.name
    filled.setdefault("facility_type", org.facility_type or "other")
    if not filled.get("county"):
        filled["county"] = org.county
    if not filled.get("address"):
        filled["address"] = org.address_line
    if not filled.get("facility_phone"):
        filled["facility_phone"] = org.phone
    if not filled.get("facility_email"):
        filled["facility_email"] = org.email
    return filled


@router.post("/field/check-in")
def check_in(
    body: CheckInBody,
    db: Session = Depends(get_db),
    user: UserResponse = Depends(require_company_permission("field")),
):
    if user.role != "sales":
        raise HTTPException(status_code=403, detail="Only sales agents can check in.")
    now = datetime.utcnow()
    try:
        lat, lng, acc = _optional_coordinates(body.latitude, body.longitude, body.accuracyM)
        assert_can_check_in(_open_visit_for_agent(db, user.id))
        ensure_workday(db, user.id, now)
    except FieldError as err:
        _http(err)
    siblings = _siblings(db, user.id)
    prospect = None
    if body.prospectId:
        prospect = _prospect_or_404(db, body.prospectId)
        _require_owner(user, prospect)
    incoming = _snapshot_in(body.model_dump(exclude_unset=True))
    if prospect is not None:
        base = read_snapshot(prospect)
        base.update(incoming)
        incoming = base
    incoming = _apply_org_defaults(db, body.organizationId, incoming)
    try:
        cleaned = clean_snapshot(incoming, require_complete=False)
        if "facility_name" not in cleaned or "county" not in cleaned or "facility_type" not in cleaned:
            raise FieldError("Facility name, type, and county are required to check in.")
        if prospect is None:
            prospect = matching_prospect(
                siblings,
                name=cleaned["facility_name"],
                county=cleaned["county"],
                organization_id=body.organizationId,
            )
    except FieldError as err:
        _http(err)
    if prospect is None:
        try:
            ensure_no_collision(None, cleaned["facility_name"], cleaned["county"], body.organizationId, siblings)
        except FieldError as err:
            _http(err)
        prospect = SalesProspect(
            id=str(uuid.uuid4()),
            agent_id=user.id,
            organization_id=body.organizationId,
            facility_name=cleaned["facility_name"],
            facility_name_key="",
            facility_type=cleaned["facility_type"],
            county=cleaned["county"],
            visit_count=0,
            created_at=now,
            updated_at=now,
        )
        write_snapshot(prospect, cleaned)
        db.add(prospect)
    elif body.organizationId and not prospect.organization_id:
        try:
            link_organization(prospect, body.organizationId, siblings)
        except FieldError as err:
            _http(err)
    visit = SalesVisit(
        id=str(uuid.uuid4()),
        prospect_id=prospect.id,
        agent_id=user.id,
        checked_in_at=now,
        check_in_latitude=lat,
        check_in_longitude=lng,
        check_in_accuracy_m=acc,
        facility_name=prospect.facility_name,
        facility_type=prospect.facility_type,
        county=prospect.county,
        created_at=now,
    )
    write_snapshot(visit, read_snapshot(prospect))
    write_snapshot(visit, cleaned)
    if int(prospect.visit_count or 0) == 0:
        write_snapshot(prospect, cleaned)
    db.add(visit)
    db.commit()
    return {"prospectId": prospect.id, "visitId": visit.id}


@router.patch("/field/visits/{visit_id}")
def patch_visit(
    visit_id: str,
    body: VisitPatch,
    db: Session = Depends(get_db),
    user: UserResponse = Depends(require_company_permission("field")),
):
    visit = db.query(SalesVisit).filter(SalesVisit.id == visit_id).one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found.")
    prospect = _prospect_or_404(db, visit.prospect_id)
    _require_owner(user, prospect)
    incoming = _snapshot_in(body.model_dump(exclude_unset=True))
    if not incoming:
        return _visit_payload(visit)
    try:
        update_open_visit(visit, prospect, incoming, _siblings(db, prospect.agent_id))
    except FieldError as err:
        _http(err)
    prospect.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(visit)
    return _visit_payload(visit)


@router.patch("/field/prospects/{prospect_id}")
def patch_prospect(
    prospect_id: str,
    body: VisitPatch,
    db: Session = Depends(get_db),
    user: UserResponse = Depends(require_company_permission("field")),
):
    """Update the facility record and its latest entry. Earlier visits stay as they were."""
    prospect = _prospect_or_404(db, prospect_id)
    _require_owner(user, prospect)
    incoming = _snapshot_in(body.model_dump(exclude_unset=True))
    if not incoming:
        raise HTTPException(status_code=400, detail="Nothing to update.")
    visits = (
        db.query(SalesVisit)
        .filter(SalesVisit.prospect_id == prospect.id)
        .order_by(SalesVisit.checked_in_at.desc())
        .all()
    )
    open_visit = next((row for row in visits if row.checked_out_at is None), None)
    latest = visits[0] if visits else None
    siblings = _siblings(db, prospect.agent_id)
    try:
        if open_visit is not None:
            applied = update_open_visit(open_visit, prospect, incoming, siblings)
            write_snapshot(prospect, applied)
        else:
            cleaned = clean_snapshot(incoming, require_complete=True)
            ensure_no_collision(
                prospect.id,
                cleaned["facility_name"],
                cleaned["county"],
                prospect.organization_id,
                siblings,
            )
            write_snapshot(prospect, cleaned)
            if latest is not None:
                write_snapshot(latest, cleaned)
    except FieldError as err:
        _http(err)
    prospect.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(prospect)
    assigned = set(_agent_counties(db, prospect.agent_id))
    return _prospect_payload(prospect, assigned, open_visit, latest_visit=latest)


@router.post("/field/visits/{visit_id}/check-out")
def check_out(
    visit_id: str,
    body: CheckOutBody,
    db: Session = Depends(get_db),
    user: UserResponse = Depends(require_company_permission("field")),
):
    visit = db.query(SalesVisit).filter(SalesVisit.id == visit_id).one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found.")
    prospect = _prospect_or_404(db, visit.prospect_id)
    _require_owner(user, prospect)
    try:
        complete_checkout(
            prospect,
            visit,
            body.latitude,
            body.longitude,
            body.accuracyM,
            datetime.utcnow(),
            _siblings(db, prospect.agent_id),
        )
    except FieldError as err:
        _http(err)
    prospect.updated_at = datetime.utcnow()
    db.commit()
    return {"prospectId": prospect.id, "visitId": visit.id, "visitCount": prospect.visit_count}


@router.put("/field/prospects/{prospect_id}/organization")
def put_prospect_organization(
    prospect_id: str,
    body: OrganizationLink,
    db: Session = Depends(get_db),
    user: UserResponse = Depends(require_company_permission("company_users")),
):
    prospect = _prospect_or_404(db, prospect_id)
    if body.organizationId:
        org = db.query(Organization).filter(Organization.id == body.organizationId).one_or_none()
        if not org:
            raise HTTPException(status_code=404, detail="Registered facility not found.")
    try:
        link_organization(prospect, body.organizationId, _siblings(db, prospect.agent_id))
    except FieldError as err:
        _http(err)
    prospect.updated_at = datetime.utcnow()
    db.commit()
    return {"prospectId": prospect.id, "organizationId": prospect.organization_id}


class TargetAssignment(BaseModel):
    monthlyTarget: float = 0
    commissionRate: Optional[float] = None
    commissionBand: str = DEFAULT_BAND


def _performance_row(agent: User, target: SalesAgentTarget | None, org_ids: set[str], invoices, start, end, month_label: str) -> dict:
    amount = float(target.monthly_target) if target else 0
    rate = resolve_commission_rate(target)
    summary = summarize_performance(
        target_amount=amount,
        commission_rate=rate,
        achieved=achieved_amount(invoices, org_ids, start, end),
        facility_count=len(org_ids),
        month_label=month_label,
    )
    summary.update({
        "agentId": agent.id,
        "agentName": f"{agent.first_name} {agent.last_name}".strip(),
        "email": agent.email,
    })
    return summary


@router.get("/field/commission-bands")
def list_commission_bands(_user: UserResponse = Depends(require_company_permission("field"))):
    return {"bands": list(COMMISSION_BANDS)}


@router.get("/field/agents/{user_id}/target")
def get_agent_target(
    user_id: str,
    db: Session = Depends(get_db),
    _user: UserResponse = Depends(require_company_permission("company_users")),
):
    target = db.query(SalesAgentTarget).filter(SalesAgentTarget.user_id == user_id).one_or_none()
    rate = resolve_commission_rate(target)
    return {
        "userId": user_id,
        "monthlyTarget": float(target.monthly_target) if target else 0,
        "commissionBand": (target.commission_band if target else DEFAULT_BAND),
        "commissionBandLabel": None,
        "commissionRate": rate,
    }


@router.put("/field/agents/{user_id}/target")
def put_agent_target(
    user_id: str,
    body: TargetAssignment,
    db: Session = Depends(get_db),
    _user: UserResponse = Depends(require_company_permission("company_users")),
):
    target_user = db.query(User).filter(User.id == user_id).one_or_none()
    if not target_user or target_user.organization_id or target_user.role != "sales":
        raise HTTPException(status_code=404, detail="Sales agent not found.")
    try:
        amount, rate = clean_target(body.monthlyTarget, body.commissionRate, body.commissionBand)
    except FieldError as err:
        _http(err)
    row = db.query(SalesAgentTarget).filter(SalesAgentTarget.user_id == user_id).one_or_none()
    if row is None:
        row = SalesAgentTarget(user_id=user_id)
        db.add(row)
    row.monthly_target = amount
    row.commission_rate = rate
    row.updated_at = datetime.utcnow()
    db.commit()
    return {
        "userId": user_id,
        "monthlyTarget": amount,
        "commissionBand": row.commission_band,
        "commissionBandLabel": None,
        "commissionRate": rate,
    }


@router.get("/field/performance")
def field_performance(
    db: Session = Depends(get_db),
    user: UserResponse = Depends(require_company_permission("field")),
):
    start, end, month_label = current_month_bounds()
    query = db.query(User).filter(User.role == "sales", User.organization_id.is_(None))
    if user.role == "sales":
        query = query.filter(User.id == user.id)
    agents = query.order_by(User.first_name.asc(), User.last_name.asc()).all()
    agent_ids = [agent.id for agent in agents]
    targets = {}
    if agent_ids:
        for row in db.query(SalesAgentTarget).filter(SalesAgentTarget.user_id.in_(agent_ids)).all():
            targets[row.user_id] = row
    orgs_by_agent: dict[str, set[str]] = {agent_id: set() for agent_id in agent_ids}
    org_rows = []
    if agent_ids:
        org_rows = (
            db.query(Organization.id, Organization.registered_by_user_id, Organization.name, Organization.county)
            .filter(Organization.registered_by_user_id.in_(agent_ids))
            .all()
        )
    for org_id, agent_id, _name, _county in org_rows:
        orgs_by_agent.setdefault(agent_id, set()).add(org_id)
    all_org_ids = [org_id for org_id, *_rest in org_rows]
    invoices = []
    if all_org_ids:
        invoices = (
            db.query(Invoice)
            .filter(
                Invoice.organization_id.in_(all_org_ids),
                Invoice.created_at >= start,
                Invoice.created_at < end,
                func.lower(Invoice.status) != "cancelled",
            )
            .all()
        )
    rows = [
        _performance_row(agent, targets.get(agent.id), orgs_by_agent.get(agent.id, set()), invoices, start, end, month_label)
        for agent in agents
    ]
    facilities = [
        {"id": org_id, "name": name, "county": county, "agentId": agent_id}
        for org_id, agent_id, name, county in org_rows
    ]
    return {"month": month_label, "agents": rows, "facilities": facilities, "bands": list(COMMISSION_BANDS)}


@router.post("/field/facilities")
def register_field_facility(
    payload: FacilityRegistration,
    db: Session = Depends(get_db),
    user: UserResponse = Depends(require_company_permission("field")),
):
    if user.role != "sales":
        raise HTTPException(status_code=403, detail="Only sales agents can register a facility from the field book.")
    now = datetime.utcnow()
    today_row = (
        db.query(SalesWorkday)
        .filter(
            SalesWorkday.agent_id == user.id,
            SalesWorkday.work_date == company_work_date(now),
        )
        .one_or_none()
    )
    # Registration remains available after checkout, but it must not reopen the
    # completed day. Before checkout, the first registration still starts it.
    if not (today_row and today_row.checked_out_at):
        ensure_workday(db, user.id, now)
    county = (payload.organization.county or "").strip()
    if county not in KENYA_COUNTY_SET:
        raise HTTPException(status_code=400, detail="Choose a Kenya county.")
    if not payload.credentials.password or len(payload.credentials.password) < 8:
        raise HTTPException(status_code=400, detail="The facility admin password must be at least 8 characters.")
    promoted = None
    siblings = _siblings(db, user.id)
    if payload.prospectId:
        promoted = _prospect_or_404(db, payload.prospectId)
        _require_owner(user, promoted)
        if promoted.organization_id:
            raise HTTPException(status_code=409, detail="This facility entry is already registered.")
        try:
            ensure_no_collision(
                promoted.id,
                payload.organization.name,
                county,
                None,
                siblings,
            )
        except FieldError as err:
            _http(err)
    organization, _admin = register_facility_account(db, payload, registered_by_user_id=user.id)
    existing = promoted or matching_prospect(
        siblings,
        name=organization.name,
        county=organization.county or county,
        organization_id=organization.id,
    )
    if existing is None:
        prospect = SalesProspect(
            id=str(uuid.uuid4()),
            agent_id=user.id,
            organization_id=organization.id,
            facility_name=organization.name,
            facility_name_key=normalize_name(organization.name),
            facility_type=organization.facility_type,
            county=organization.county or county,
            address=organization.address_line,
            facility_phone=organization.phone,
            facility_email=organization.email,
            visit_count=0,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(prospect)
        db.commit()
    elif not existing.organization_id:
        existing.organization_id = organization.id
        write_snapshot(existing, {
            "facility_name": organization.name,
            "facility_type": organization.facility_type,
            "county": organization.county or county,
            "address": organization.address_line,
            "facility_phone": organization.phone,
            "facility_email": organization.email,
            "contact_name": f"{payload.primaryContact.firstName} {payload.primaryContact.lastName}".strip(),
            "contact_title": payload.primaryContact.jobTitle,
            "contact_phone": payload.primaryContact.phone,
            "contact_email": str(payload.primaryContact.email).lower(),
        })
        existing.updated_at = datetime.utcnow()
        db.commit()
    return {
        "organizationId": organization.id,
        "name": organization.name,
        "registeredBy": user.id,
    }


def _parse_day(value: Optional[str]):
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=400, detail="Use a YYYY-MM-DD date.")


@router.get("/field/workday")
def get_workday(
    db: Session = Depends(get_db),
    user: UserResponse = Depends(require_company_permission("field")),
):
    if user.role != "sales":
        raise HTTPException(status_code=403, detail="Only sales agents have a workday.")
    row = _open_workday(db, user.id)
    if row is None:
        row = (
            db.query(SalesWorkday)
            .filter(SalesWorkday.agent_id == user.id, SalesWorkday.work_date == company_work_date(datetime.utcnow()))
            .one_or_none()
        )
    return {"workday": _workday_payload(db, row)}


@router.post("/field/workday/check-out")
def close_workday(
    db: Session = Depends(get_db),
    user: UserResponse = Depends(require_company_permission("field")),
):
    if user.role != "sales":
        raise HTTPException(status_code=403, detail="Only sales agents can check out.")
    row = _open_workday(db, user.id)
    if row is None:
        raise HTTPException(status_code=400, detail="You have not checked in today.")
    try:
        assert_can_close_day(_open_visit_for_agent(db, user.id))
    except FieldError as err:
        _http(err)
    row.checked_out_at = datetime.utcnow()
    db.commit()
    return {"workday": _workday_payload(db, row)}


@router.post("/field/workdays/{workday_id}/invalidate-checkout")
def invalidate_workday_checkout(
    workday_id: str,
    db: Session = Depends(get_db),
    user: UserResponse = Depends(require_company_permission("field")),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only Global Admins can invalidate a checkout.")
    row = db.query(SalesWorkday).filter(SalesWorkday.id == workday_id).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Workday not found.")
    if row.checked_out_at is None:
        raise HTTPException(status_code=409, detail="This checkout has already been invalidated.")
    today = company_work_date(datetime.utcnow())
    if company_work_date(row.checked_in_at) != today:
        raise HTTPException(status_code=409, detail="Only today's checkout can be invalidated.")
    conflicting = (
        db.query(SalesWorkday)
        .filter(
            SalesWorkday.agent_id == row.agent_id,
            SalesWorkday.checked_out_at.is_(None),
            SalesWorkday.id != row.id,
        )
        .one_or_none()
    )
    if conflicting is not None:
        raise HTTPException(status_code=409, detail="This agent already has an open session.")
    row.checked_out_at = None
    db.commit()
    db.refresh(row)
    agent = db.query(User).filter(User.id == row.agent_id).one_or_none()
    name = f"{agent.first_name} {agent.last_name}".strip() if agent else None
    return {"workday": _workday_payload(db, row, name)}


@router.get("/field/timesheet")
def timesheet(
    agent_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    user: UserResponse = Depends(require_company_permission("field")),
):
    start = _parse_day(date_from)
    end = _parse_day(date_to)
    query = db.query(SalesWorkday)
    if user.role == "sales":
        query = query.filter(SalesWorkday.agent_id == user.id)
    else:
        agents = _csv(agent_id)
        if agents:
            query = query.filter(SalesWorkday.agent_id.in_(agents))
    if start:
        query = query.filter(SalesWorkday.work_date >= start)
    if end:
        query = query.filter(SalesWorkday.work_date <= end)
    rows = query.order_by(SalesWorkday.work_date.desc(), SalesWorkday.checked_in_at.desc()).limit(200).all()
    agent_ids = list({row.agent_id for row in rows})
    names = {}
    if agent_ids:
        for agent in db.query(User).filter(User.id.in_(agent_ids)).all():
            names[agent.id] = f"{agent.first_name} {agent.last_name}".strip()
    today = company_work_date(datetime.utcnow())
    days = []
    for row in rows:
        payload = _workday_payload(db, row, names.get(row.agent_id))
        payload["canReopen"] = bool(
            user.role == "admin"
            and row.checked_out_at is not None
            and company_work_date(row.checked_in_at) == today
        )
        days.append(payload)
    return {"days": days}


