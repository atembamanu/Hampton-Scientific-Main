from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from deps import get_db
from models.facility import FacilityRegistration
from utils.auth import create_access_token
from utils.facility_auth import build_auth_payload
from utils.facility_registration import register_facility_account
from utils.logger import logger

router = APIRouter()


@router.post("/register")
async def register_facility(
    payload: FacilityRegistration,
    db: Session = Depends(get_db),
):
    """Atomic registration: organization + branch(es) + org_admin + default delivery location."""
    organization, user = register_facility_account(db, payload)
    access_token = create_access_token(data={"sub": user.email})
    user_payload = build_auth_payload(db, user)
    logger.info(f"Facility registered: {organization.name} ({user.email})")

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_payload,
    }
