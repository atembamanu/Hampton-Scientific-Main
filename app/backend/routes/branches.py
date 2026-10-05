import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from deps import get_db
from models.branch import BranchCreate, BranchUpdate
from utils.facility_auth import serialize_branch
from utils.permissions import require_facility_user, require_org_admin, require_branch_access
from db.models import User, Branch, DeliveryLocation

router = APIRouter()


@router.get("")
async def list_branches(
    user: User = Depends(require_facility_user),
    db: Session = Depends(get_db),
):
    if user.role == "org_admin":
        branches = (
            db.query(Branch)
            .filter(Branch.organization_id == user.organization_id)
            .order_by(Branch.is_main.desc(), Branch.name.asc())
            .all()
        )
    else:
        from utils.permissions import get_user_accessible_branch_ids

        ids = get_user_accessible_branch_ids(db, user)
        branches = db.query(Branch).filter(Branch.id.in_(ids)).order_by(Branch.name.asc()).all()
    return [serialize_branch(b) for b in branches]


@router.post("")
async def create_branch(
    payload: BranchCreate,
    user: User = Depends(require_org_admin),
    db: Session = Depends(get_db),
):
    code = payload.branchCode.upper()
    existing = (
        db.query(Branch)
        .filter(Branch.organization_id == user.organization_id, Branch.branch_code == code)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Branch code already exists")

    now = datetime.utcnow()
    branch = Branch(
        id=str(uuid.uuid4()),
        organization_id=user.organization_id,
        name=payload.name,
        branch_code=code,
        contact_name=payload.contactName,
        phone=payload.phone,
        email=str(payload.email) if payload.email else None,
        physical_address=payload.physicalAddress,
        delivery_address=payload.deliveryAddress or payload.physicalAddress,
        county=payload.county,
        status="active",
        is_main=payload.isMain,
        created_at=now,
        updated_at=now,
    )
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return serialize_branch(branch)


@router.get("/{branch_id}")
async def get_branch(
    branch_id: str,
    user: User = Depends(require_facility_user),
    db: Session = Depends(get_db),
):
    require_branch_access(db, user, branch_id)
    branch = db.query(Branch).filter(Branch.id == branch_id).one_or_none()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    return serialize_branch(branch)


@router.put("/{branch_id}")
async def update_branch(
    branch_id: str,
    payload: BranchUpdate,
    user: User = Depends(require_org_admin),
    db: Session = Depends(get_db),
):
    branch = (
        db.query(Branch)
        .filter(Branch.id == branch_id, Branch.organization_id == user.organization_id)
        .one_or_none()
    )
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    data = payload.dict(exclude_unset=True)
    field_map = {
        "name": "name",
        "branchCode": "branch_code",
        "contactName": "contact_name",
        "phone": "phone",
        "email": "email",
        "physicalAddress": "physical_address",
        "deliveryAddress": "delivery_address",
        "county": "county",
        "status": "status",
    }
    for key, col in field_map.items():
        if key in data:
            val = data[key]
            if col == "branch_code":
                val = val.upper()
            setattr(branch, col, val)

    branch.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(branch)
    return serialize_branch(branch)


@router.post("/{branch_id}/activate")
async def activate_branch(
    branch_id: str,
    user: User = Depends(require_org_admin),
    db: Session = Depends(get_db),
):
    branch = (
        db.query(Branch)
        .filter(Branch.id == branch_id, Branch.organization_id == user.organization_id)
        .one_or_none()
    )
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    branch.status = "active"
    branch.updated_at = datetime.utcnow()
    db.commit()
    return serialize_branch(branch)


@router.post("/{branch_id}/deactivate")
async def deactivate_branch(
    branch_id: str,
    user: User = Depends(require_org_admin),
    db: Session = Depends(get_db),
):
    branch = (
        db.query(Branch)
        .filter(Branch.id == branch_id, Branch.organization_id == user.organization_id)
        .one_or_none()
    )
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    if branch.is_main:
        raise HTTPException(status_code=400, detail="Cannot deactivate the main branch")
    branch.status = "inactive"
    branch.updated_at = datetime.utcnow()
    db.commit()
    return serialize_branch(branch)
