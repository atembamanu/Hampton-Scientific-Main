import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from sqlalchemy.exc import IntegrityError

from deps import get_db
from models.facility import FacilityUserCreate, FacilityUserUpdate
from utils.auth import get_password_hash
from utils.permissions import require_facility_user, require_org_admin, require_branch_access
from db.models import User, Branch, UserBranchAssignment, Organization, Quote, Order, Invoice

router = APIRouter()


def _serialize_facility_user(db: Session, user: User) -> dict:
    assignments = (
        db.query(UserBranchAssignment)
        .filter(UserBranchAssignment.user_id == user.id)
        .all()
    )
    branch_ids = [a.branch_id for a in assignments]
    branches = db.query(Branch).filter(Branch.id.in_(branch_ids)).all() if branch_ids else []
    return {
        "id": user.id,
        "firstName": user.first_name,
        "lastName": user.last_name,
        "email": user.email,
        "phone": user.phone,
        "jobTitle": user.job_title,
        "role": user.role,
        "canLogin": user.can_login,
        "branchIds": branch_ids,
        "branches": [{"id": b.id, "name": b.name, "branchCode": b.branch_code} for b in branches],
        "createdAt": user.created_at,
    }


@router.get("")
async def list_facility_users(
    user: User = Depends(require_facility_user),
    db: Session = Depends(get_db),
):
    q = db.query(User).filter(User.organization_id == user.organization_id)
    if user.role == "branch_admin":
        from utils.permissions import get_user_accessible_branch_ids

        my_branches = get_user_accessible_branch_ids(db, user)
        user_ids = (
            db.query(UserBranchAssignment.user_id)
            .filter(UserBranchAssignment.branch_id.in_(my_branches))
            .distinct()
            .all()
        )
        ids = [u.user_id for u in user_ids]
        q = q.filter(User.id.in_(ids))
    users = q.order_by(User.created_at.desc()).all()
    return [_serialize_facility_user(db, u) for u in users]


@router.post("")
async def create_facility_user(
    payload: FacilityUserCreate,
    user: User = Depends(require_facility_user),
    db: Session = Depends(get_db),
):
    if user.role not in ("org_admin", "branch_admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    if payload.role not in ("branch_admin", "branch_user"):
        raise HTTPException(status_code=400, detail="Invalid role for facility user")

    if user.role == "branch_admin" and payload.role == "branch_admin":
        raise HTTPException(status_code=403, detail="Cannot create branch admin")

    for bid in payload.branchIds:
        require_branch_access(db, user, bid)

    email = payload.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    if not payload.password or len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password is required (min 8 characters)")

    org = db.query(Organization).filter(Organization.id == user.organization_id).one()
    password = payload.password
    now = datetime.utcnow()
    new_user = User(
        id=str(uuid.uuid4()),
        organization_id=user.organization_id,
        first_name=payload.firstName,
        last_name=payload.lastName,
        email=email,
        phone=payload.phone,
        hashed_password=get_password_hash(password),
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

    for i, bid in enumerate(payload.branchIds):
        db.add(
            UserBranchAssignment(
                id=str(uuid.uuid4()),
                user_id=new_user.id,
                branch_id=bid,
                is_primary=(i == 0),
                created_at=now,
            )
        )

    db.commit()
    db.refresh(new_user)
    return _serialize_facility_user(db, new_user)


@router.put("/{user_id}")
async def update_facility_user(
    user_id: str,
    payload: FacilityUserUpdate,
    current: User = Depends(require_facility_user),
    db: Session = Depends(get_db),
):
    if current.role not in ("org_admin", "branch_admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    target = (
        db.query(User)
        .filter(User.id == user_id, User.organization_id == current.organization_id)
        .one_or_none()
    )
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    data = payload.dict(exclude_unset=True)
    if "firstName" in data:
        target.first_name = data["firstName"]
    if "lastName" in data:
        target.last_name = data["lastName"]
    if "phone" in data:
        target.phone = data["phone"]
    if "jobTitle" in data:
        target.job_title = data["jobTitle"]
    if "role" in data and current.role == "org_admin":
        target.role = data["role"]
    if "canLogin" in data:
        target.can_login = data["canLogin"]
    if payload.password:
        if len(payload.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        target.hashed_password = get_password_hash(payload.password)

    if payload.branchIds is not None:
        for bid in payload.branchIds:
            require_branch_access(db, current, bid)
        db.query(UserBranchAssignment).filter(UserBranchAssignment.user_id == user_id).delete()
        for i, bid in enumerate(payload.branchIds):
            db.add(
                UserBranchAssignment(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    branch_id=bid,
                    is_primary=(i == 0),
                    created_at=datetime.utcnow(),
                )
            )

    target.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(target)
    return _serialize_facility_user(db, target)


@router.post("/{user_id}/deactivate")
async def deactivate_facility_user(
    user_id: str,
    current: User = Depends(require_org_admin),
    db: Session = Depends(get_db),
):
    if user_id == current.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    target = (
        db.query(User)
        .filter(User.id == user_id, User.organization_id == current.organization_id)
        .one_or_none()
    )
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    target.can_login = False
    target.updated_at = datetime.utcnow()
    db.commit()
    return _serialize_facility_user(db, target)


@router.post("/{user_id}/activate")
async def activate_facility_user(
    user_id: str,
    current: User = Depends(require_org_admin),
    db: Session = Depends(get_db),
):
    if user_id == current.id:
        raise HTTPException(status_code=400, detail="Cannot change your own login status here")

    target = (
        db.query(User)
        .filter(User.id == user_id, User.organization_id == current.organization_id)
        .one_or_none()
    )
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    target.can_login = True
    target.updated_at = datetime.utcnow()
    db.commit()
    return _serialize_facility_user(db, target)


@router.delete("/{user_id}")
async def delete_facility_user(
    user_id: str,
    current: User = Depends(require_org_admin),
    db: Session = Depends(get_db),
):
    if user_id == current.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    target = (
        db.query(User)
        .filter(User.id == user_id, User.organization_id == current.organization_id)
        .one_or_none()
    )
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if target.role == "org_admin":
        remaining_admins = (
            db.query(User.id)
            .filter(
                User.organization_id == current.organization_id,
                User.role == "org_admin",
                User.id != user_id,
            )
            .first()
        )
        if not remaining_admins:
            raise HTTPException(status_code=400, detail="Cannot delete the last facility admin")

    has_records = (
        db.query(Quote.id).filter((Quote.user_id == user_id) | (Quote.ordered_by_user_id == user_id)).first()
        or db.query(Order.id).filter(Order.ordered_by_user_id == user_id).first()
        or db.query(Invoice.id).filter((Invoice.user_id == user_id) | (Invoice.created_by == user_id)).first()
    )
    if has_records:
        raise HTTPException(
            status_code=400,
            detail="This person has quotes, orders, or invoices on record. Deactivate them instead of deleting them.",
        )

    db.query(UserBranchAssignment).filter(UserBranchAssignment.user_id == user_id).delete(synchronize_session=False)
    db.delete(target)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="This person has records in the system. Deactivate them instead of deleting them.",
        )
    return {"message": "User deleted"}
