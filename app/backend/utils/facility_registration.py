"""Create an organization, its main branch, delivery location, and facility admin."""

import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from db.models import Branch, DeliveryLocation, Organization, User, UserBranchAssignment
from utils.auth import get_password_hash


def register_facility_account(db: Session, payload, *, registered_by_user_id: str | None = None):
    """Persist a new facility account. Caller receives the organization and its admin user."""
    cred_email = payload.credentials.email.lower()
    if db.query(User).filter(User.email == cred_email).first():
        raise HTTPException(status_code=400, detail="User with this email already exists")
    if db.query(Organization).filter(Organization.email == str(payload.organization.email).lower()).first():
        raise HTTPException(status_code=400, detail="A facility with this email already exists")

    org_id = str(uuid.uuid4())
    branch_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    delivery_id = str(uuid.uuid4())
    now = datetime.utcnow()

    org = payload.organization
    contact = payload.primaryContact

    organization = Organization(
        id=org_id,
        name=org.name,
        facility_type=org.facilityType,
        registration_number=org.registrationNumber,
        tax_number=org.taxNumber,
        phone=org.phone,
        email=str(org.email).lower(),
        website=org.website,
        address_line=org.addressLine,
        county=org.county,
        country=org.country,
        is_multi_branch=payload.multiBranch,
        settings={"branch_users_can_order_directly": True},
        registered_by_user_id=registered_by_user_id,
        created_at=now,
        updated_at=now,
    )

    if payload.multiBranch and payload.firstBranch:
        fb = payload.firstBranch
        branch = Branch(
            id=branch_id,
            organization_id=org_id,
            name=fb.name,
            branch_code=fb.branchCode.upper(),
            contact_name=fb.contactName or f"{contact.firstName} {contact.lastName}",
            phone=fb.phone or contact.phone,
            email=str(fb.email or contact.email),
            physical_address=fb.physicalAddress,
            delivery_address=fb.deliveryAddress or fb.physicalAddress,
            county=fb.county or org.county,
            status="active",
            is_main=True,
            created_at=now,
            updated_at=now,
        )
        delivery_address = fb.deliveryAddress or fb.physicalAddress
        delivery_label = fb.name
    else:
        branch = Branch(
            id=branch_id,
            organization_id=org_id,
            name=org.name,
            branch_code="MAIN",
            contact_name=f"{contact.firstName} {contact.lastName}",
            phone=contact.phone,
            email=str(contact.email),
            physical_address=org.addressLine,
            delivery_address=org.addressLine,
            county=org.county,
            status="active",
            is_main=True,
            created_at=now,
            updated_at=now,
        )
        delivery_address = org.addressLine
        delivery_label = "Main Facility"

    delivery = DeliveryLocation(
        id=delivery_id,
        organization_id=org_id,
        branch_id=branch_id,
        label=delivery_label,
        contact_name=f"{contact.firstName} {contact.lastName}",
        phone=contact.phone,
        email=str(contact.email),
        address_line=delivery_address,
        county=org.county,
        country=org.country,
        is_default=True,
        created_at=now,
        updated_at=now,
    )

    user = User(
        id=user_id,
        organization_id=org_id,
        first_name=contact.firstName,
        last_name=contact.lastName,
        email=cred_email,
        phone=contact.phone,
        hashed_password=get_password_hash(payload.credentials.password),
        job_title=contact.jobTitle,
        facility_name=org.name,
        facility_type=org.facilityType,
        address=org.addressLine,
        city=org.county,
        role="org_admin",
        can_login=True,
        created_at=now,
        updated_at=now,
    )

    assignment = UserBranchAssignment(
        id=str(uuid.uuid4()),
        user_id=user_id,
        branch_id=branch_id,
        is_primary=True,
        created_at=now,
    )

    db.add(organization)
    db.add(branch)
    db.add(delivery)
    db.add(user)
    db.add(assignment)
    db.commit()
    db.refresh(user)
    db.refresh(organization)
    return organization, user
