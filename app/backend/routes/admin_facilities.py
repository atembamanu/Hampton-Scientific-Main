"""Company-admin create and edit for facilities, branches, and facility users."""

import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from deps import get_db
from db.models import Branch, Organization, User, UserBranchAssignment
from models.branch import BranchCreate, BranchUpdate
from models.facility import FacilityRegistration, FacilityUserCreate, FacilityUserUpdate
from models.user import UserResponse
from utils.auth import get_password_hash
from utils.facility_auth import serialize_branch, serialize_organization
from utils.facility_registration import register_facility_account
from utils.kenya_counties import KENYA_COUNTY_SET
from utils.permissions import require_company_permission

router = APIRouter()
require_facilities = require_company_permission("facilities")


class AdminFacilityCreate(FacilityRegistration):
    registeredByUserId: Optional[str] = None


class AdminFacilityUpdate(BaseModel):
    name: str
    facilityType: str
    phone: str
    email: EmailStr
    addressLine: str
    county: Optional[str] = None
    registeredByUserId: Optional[str] = None


def _org_or_404(db: Session, org_id: str) -> Organization:
    org = db.query(Organization).filter(Organization.id == org_id).one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Facility not found")
    return org


def _sales_agent_or_none(db: Session, user_id: Optional[str]) -> Optional[str]:
    if not user_id:
        return None
    agent = db.query(User).filter(User.id == user_id).one_or_none()
    if not agent or agent.organization_id or agent.role != "sales":
        raise HTTPException(status_code=400, detail="Choose a sales agent to credit, or leave it blank.")
    return agent.id


def _require_county(county: Optional[str]) -> str:
    name = (county or "").strip()
    if name not in KENYA_COUNTY_SET:
        raise HTTPException(status_code=400, detail="Choose a Kenya county.")
    return name


@router.post("/ops/organizations")
def create_admin_facility(
    payload: AdminFacilityCreate,
    db: Session = Depends(get_db),
    _user: UserResponse = Depends(require_facilities),
):
    _require_county(payload.organization.county)
    if not payload.credentials.password or len(payload.credentials.password) < 8:
        raise HTTPException(status_code=400, detail="The facility admin password must be at least 8 characters.")
    credited = _sales_agent_or_none(db, payload.registeredByUserId)
    organization, _admin = register_facility_account(db, payload, registered_by_user_id=credited)
    return {"organization": serialize_organization(organization), "registeredByUserId": credited}


@router.put("/ops/organizations/{org_id}")
def update_admin_facility(
    org_id: str,
    payload: AdminFacilityUpdate,
    db: Session = Depends(get_db),
    _user: UserResponse = Depends(require_facilities),
):
    org = _org_or_404(db, org_id)
    county = _require_county(payload.county)
    email = str(payload.email).lower()
    taken = (
        db.query(Organization)
        .filter(Organization.email == email, Organization.id != org.id)
        .first()
    )
    if taken:
        raise HTTPException(status_code=400, detail="A facility with this email already exists")
    if payload.facilityType not in (
        "hospital", "clinic", "pharmacy", "laboratory", "medical_centre", "ngo", "other",
    ):
        raise HTTPException(status_code=400, detail="Choose a facility type.")
    org.name = payload.name.strip()
    org.facility_type = payload.facilityType
    org.phone = payload.phone
    org.email = email
    org.address_line = payload.addressLine.strip()
    org.county = county
    org.registered_by_user_id = _sales_agent_or_none(db, payload.registeredByUserId)
    org.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(org)
    return {"organization": serialize_organization(org), "registeredByUserId": org.registered_by_user_id}


def _branch_in_org(db: Session, org_id: str, branch_id: str) -> Branch:
    branch = (
        db.query(Branch)
        .filter(Branch.id == branch_id, Branch.organization_id == org_id)
        .one_or_none()
    )
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    return branch


@router.post("/ops/organizations/{org_id}/branches")
def create_admin_branch(
    org_id: str,
    payload: BranchCreate,
    db: Session = Depends(get_db),
    _user: UserResponse = Depends(require_facilities),
):
    _org_or_404(db, org_id)
    code = payload.branchCode.strip().upper()
    existing = db.query(Branch).filter(Branch.organization_id == org_id, Branch.branch_code == code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Branch code already exists")
    now = datetime.utcnow()
    branch = Branch(
        id=str(uuid.uuid4()),
        organization_id=org_id,
        name=payload.name.strip(),
        branch_code=code,
        contact_name=payload.contactName,
        phone=payload.phone,
        email=str(payload.email) if payload.email else None,
        physical_address=payload.physicalAddress,
        delivery_address=payload.deliveryAddress or payload.physicalAddress,
        county=payload.county,
        status="active",
        is_main=False,
        created_at=now,
        updated_at=now,
    )
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return serialize_branch(branch)


@router.put("/ops/organizations/{org_id}/branches/{branch_id}")
def update_admin_branch(
    org_id: str,
    branch_id: str,
    payload: BranchUpdate,
    db: Session = Depends(get_db),
    _user: UserResponse = Depends(require_facilities),
):
    branch = _branch_in_org(db, org_id, branch_id)
    data = payload.model_dump(exclude_unset=True)
    if "branchCode" in data and data["branchCode"]:
        code = data["branchCode"].strip().upper()
        taken = (
            db.query(Branch)
            .filter(Branch.organization_id == org_id, Branch.branch_code == code, Branch.id != branch.id)
            .first()
        )
        if taken:
            raise HTTPException(status_code=400, detail="Branch code already exists")
        branch.branch_code = code
    for key, col in (
        ("name", "name"),
        ("contactName", "contact_name"),
        ("phone", "phone"),
        ("email", "email"),
        ("physicalAddress", "physical_address"),
        ("deliveryAddress", "delivery_address"),
        ("county", "county"),
        ("status", "status"),
    ):
        if key in data:
            setattr(branch, col, data[key])
    branch.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(branch)
    return serialize_branch(branch)


@router.post("/ops/organizations/{org_id}/branches/{branch_id}/deactivate")
def deactivate_admin_branch(
    org_id: str,
    branch_id: str,
    db: Session = Depends(get_db),
    _user: UserResponse = Depends(require_facilities),
):
    branch = _branch_in_org(db, org_id, branch_id)
    if branch.is_main:
        raise HTTPException(status_code=400, detail="Cannot deactivate the main branch")
    branch.status = "inactive"
    branch.updated_at = datetime.utcnow()
    db.commit()
    return serialize_branch(branch)


def _assign_branches(db: Session, user_id: str, org_id: str, branch_ids: List[str]) -> None:
    if not branch_ids:
        raise HTTPException(status_code=400, detail="Choose at least one branch.")
    found = db.query(Branch).filter(Branch.organization_id == org_id, Branch.id.in_(branch_ids)).all()
    if len(found) != len(set(branch_ids)):
        raise HTTPException(status_code=400, detail="Choose branches that belong to this facility.")
    db.query(UserBranchAssignment).filter(UserBranchAssignment.user_id == user_id).delete(synchronize_session=False)
    now = datetime.utcnow()
    for index, branch_id in enumerate(dict.fromkeys(branch_ids)):
        db.add(UserBranchAssignment(
            id=str(uuid.uuid4()),
            user_id=user_id,
            branch_id=branch_id,
            is_primary=(index == 0),
            created_at=now,
        ))


@router.post("/ops/organizations/{org_id}/users")
def create_admin_facility_user(
    org_id: str,
    payload: FacilityUserCreate,
    db: Session = Depends(get_db),
    _user: UserResponse = Depends(require_facilities),
):
    org = _org_or_404(db, org_id)
    if payload.role not in ("org_admin", "branch_admin", "branch_user"):
        raise HTTPException(status_code=400, detail="Choose a facility role.")
    if not payload.password or len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    email = payload.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    now = datetime.utcnow()
    new_user = User(
        id=str(uuid.uuid4()),
        organization_id=org.id,
        first_name=payload.firstName.strip(),
        last_name=payload.lastName.strip(),
        email=email,
        phone=payload.phone,
        hashed_password=get_password_hash(payload.password),
        job_title=payload.jobTitle,
        facility_name=org.name,
        facility_type=org.facility_type,
        address=org.address_line,
        city=org.county,
        role=payload.role,
        can_login=True,
        created_at=now,
        updated_at=now,
    )
    db.add(new_user)
    db.flush()
    _assign_branches(db, new_user.id, org.id, payload.branchIds)
    db.commit()
    return {"id": new_user.id}


@router.put("/ops/organizations/{org_id}/users/{user_id}")
def update_admin_facility_user(
    org_id: str,
    user_id: str,
    payload: FacilityUserUpdate,
    db: Session = Depends(get_db),
    _user: UserResponse = Depends(require_facilities),
):
    _org_or_404(db, org_id)
    target = db.query(User).filter(User.id == user_id, User.organization_id == org_id).one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    data = payload.model_dump(exclude_unset=True)
    if "firstName" in data:
        target.first_name = data["firstName"]
    if "lastName" in data:
        target.last_name = data["lastName"]
    if "phone" in data:
        target.phone = data["phone"]
    if "jobTitle" in data:
        target.job_title = data["jobTitle"]
    if "role" in data:
        if data["role"] not in ("org_admin", "branch_admin", "branch_user"):
            raise HTTPException(status_code=400, detail="Choose a facility role.")
        target.role = data["role"]
    if "canLogin" in data and data["canLogin"] is not None:
        target.can_login = data["canLogin"]
    if payload.password:
        if len(payload.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
        target.hashed_password = get_password_hash(payload.password)
    if payload.branchIds is not None:
        _assign_branches(db, target.id, org_id, payload.branchIds)
    target.updated_at = datetime.utcnow()
    db.commit()
    return {"id": target.id}


@router.post("/ops/organizations/{org_id}/users/{user_id}/deactivate")
def deactivate_admin_facility_user(
    org_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    _user: UserResponse = Depends(require_facilities),
):
    target = db.query(User).filter(User.id == user_id, User.organization_id == org_id).one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.role == "org_admin":
        others = (
            db.query(User)
            .filter(
                User.organization_id == org_id,
                User.role == "org_admin",
                User.can_login.is_(True),
                User.id != target.id,
            )
            .count()
        )
        if others == 0:
            raise HTTPException(status_code=400, detail="Cannot deactivate the last facility admin")
    target.can_login = False
    target.updated_at = datetime.utcnow()
    db.commit()
    return {"id": target.id}
