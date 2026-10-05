import uuid
from datetime import datetime

from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session

from deps import get_db
from models.delivery_location import DeliveryLocationCreate, DeliveryLocationUpdate
from utils.permissions import require_facility_user, require_org_admin, require_branch_access
from db.models import User, DeliveryLocation, Branch

router = APIRouter()


def _serialize(loc: DeliveryLocation) -> dict:
    return {
        "id": loc.id,
        "organizationId": loc.organization_id,
        "branchId": loc.branch_id,
        "label": loc.label,
        "contactName": loc.contact_name,
        "phone": loc.phone,
        "email": loc.email,
        "addressLine": loc.address_line,
        "county": loc.county,
        "country": loc.country,
        "deliveryInstructions": loc.delivery_instructions,
        "isDefault": loc.is_default,
        "createdAt": loc.created_at,
    }


@router.get("")
async def list_delivery_locations(
    branch_id: Optional[str] = Query(None),
    user: User = Depends(require_facility_user),
    db: Session = Depends(get_db),
):
    q = db.query(DeliveryLocation).filter(DeliveryLocation.organization_id == user.organization_id)
    if branch_id:
        require_branch_access(db, user, branch_id)
        q = q.filter(
            (DeliveryLocation.branch_id == branch_id) | (DeliveryLocation.branch_id.is_(None))
        )
    elif user.role not in ("org_admin", "admin"):
        from utils.permissions import get_user_accessible_branch_ids

        ids = get_user_accessible_branch_ids(db, user)
        q = q.filter(
            (DeliveryLocation.branch_id.in_(ids)) | (DeliveryLocation.branch_id.is_(None))
        )
    locations = q.order_by(DeliveryLocation.is_default.desc(), DeliveryLocation.label.asc()).all()
    return [_serialize(loc) for loc in locations]


@router.post("")
async def create_delivery_location(
    payload: DeliveryLocationCreate,
    user: User = Depends(require_facility_user),
    db: Session = Depends(get_db),
):
    if user.role not in ("org_admin", "branch_admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    if payload.branchId:
        require_branch_access(db, user, payload.branchId)

    now = datetime.utcnow()
    if payload.isDefault:
        db.query(DeliveryLocation).filter(
            DeliveryLocation.organization_id == user.organization_id
        ).update({"is_default": False})

    loc = DeliveryLocation(
        id=str(uuid.uuid4()),
        organization_id=user.organization_id,
        branch_id=payload.branchId,
        label=payload.label,
        contact_name=payload.contactName,
        phone=payload.phone,
        email=str(payload.email) if payload.email else None,
        address_line=payload.addressLine,
        county=payload.county,
        country=payload.country,
        delivery_instructions=payload.deliveryInstructions,
        is_default=payload.isDefault,
        created_at=now,
        updated_at=now,
    )
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return _serialize(loc)


@router.put("/{location_id}")
async def update_delivery_location(
    location_id: str,
    payload: DeliveryLocationUpdate,
    user: User = Depends(require_facility_user),
    db: Session = Depends(get_db),
):
    loc = (
        db.query(DeliveryLocation)
        .filter(DeliveryLocation.id == location_id, DeliveryLocation.organization_id == user.organization_id)
        .one_or_none()
    )
    if not loc:
        raise HTTPException(status_code=404, detail="Delivery location not found")

    data = payload.dict(exclude_unset=True)
    if "branchId" in data and data["branchId"]:
        require_branch_access(db, user, data["branchId"])

    if data.get("isDefault"):
        db.query(DeliveryLocation).filter(
            DeliveryLocation.organization_id == user.organization_id
        ).update({"is_default": False})

    field_map = {
        "branchId": "branch_id",
        "label": "label",
        "contactName": "contact_name",
        "phone": "phone",
        "email": "email",
        "addressLine": "address_line",
        "county": "county",
        "country": "country",
        "deliveryInstructions": "delivery_instructions",
        "isDefault": "is_default",
    }
    for key, col in field_map.items():
        if key in data:
            setattr(loc, col, data[key])

    loc.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(loc)
    return _serialize(loc)


@router.delete("/{location_id}")
async def delete_delivery_location(
    location_id: str,
    user: User = Depends(require_org_admin),
    db: Session = Depends(get_db),
):
    loc = (
        db.query(DeliveryLocation)
        .filter(DeliveryLocation.id == location_id, DeliveryLocation.organization_id == user.organization_id)
        .one_or_none()
    )
    if not loc:
        raise HTTPException(status_code=404, detail="Delivery location not found")
    if loc.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete the default delivery location")
    db.delete(loc)
    db.commit()
    return {"message": "Deleted"}
