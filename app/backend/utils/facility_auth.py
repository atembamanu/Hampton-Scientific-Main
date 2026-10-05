from typing import Optional

from sqlalchemy.orm import Session

from db.models import User, Organization, Branch, UserBranchAssignment, DeliveryLocation
from utils.permissions import get_permissions_for_role, get_user_accessible_branch_ids


def serialize_branch(branch: Branch) -> dict:
    return {
        "id": branch.id,
        "organizationId": branch.organization_id,
        "name": branch.name,
        "branchCode": branch.branch_code,
        "contactName": branch.contact_name,
        "phone": branch.phone,
        "email": branch.email,
        "physicalAddress": branch.physical_address,
        "deliveryAddress": branch.delivery_address,
        "county": branch.county,
        "status": branch.status,
        "isMain": branch.is_main,
    }


def serialize_organization(org: Organization) -> dict:
    settings = org.settings or {}
    return {
        "id": org.id,
        "name": org.name,
        "facilityType": org.facility_type,
        "registrationNumber": org.registration_number,
        "taxNumber": org.tax_number,
        "phone": org.phone,
        "email": org.email,
        "website": org.website,
        "addressLine": org.address_line,
        "county": org.county,
        "country": org.country,
        "isMultiBranch": org.is_multi_branch,
        "settings": settings,
    }


def build_auth_payload(db: Session, user: User) -> dict:
    org_data = None
    branches = []
    permissions = []
    primary_branch_id = None

    if user.organization_id:
        org = db.query(Organization).filter(Organization.id == user.organization_id).one_or_none()
        if org:
            org_data = serialize_organization(org)
            settings = org.settings or {}
            permissions = get_permissions_for_role(user.role, settings)

            if user.role in ("admin", "org_admin"):
                branch_rows = (
                    db.query(Branch)
                    .filter(Branch.organization_id == org.id)
                    .order_by(Branch.is_main.desc(), Branch.name.asc())
                    .all()
                )
            else:
                branch_ids = get_user_accessible_branch_ids(db, user)
                branch_rows = (
                    db.query(Branch)
                    .filter(Branch.id.in_(branch_ids))
                    .order_by(Branch.name.asc())
                    .all()
                ) if branch_ids else []

            branches = [serialize_branch(b) for b in branch_rows]

            primary = (
                db.query(UserBranchAssignment)
                .filter(UserBranchAssignment.user_id == user.id, UserBranchAssignment.is_primary == True)
                .one_or_none()
            )
            if primary:
                primary_branch_id = primary.branch_id
            elif branches:
                primary_branch_id = branches[0]["id"]
    else:
        permissions = get_permissions_for_role(user.role)

    return {
        "id": user.id,
        "firstName": user.first_name,
        "lastName": user.last_name,
        "email": user.email,
        "phone": user.phone,
        "jobTitle": user.job_title,
        "facilityName": user.facility_name,
        "facilityType": user.facility_type,
        "address": user.address,
        "city": user.city,
        "postalCode": user.postal_code,
        "role": user.role,
        "can_login": user.can_login,
        "organizationId": user.organization_id,
        "organization": org_data,
        "branches": branches,
        "primaryBranchId": primary_branch_id,
        "permissions": permissions,
        "created_at": user.created_at,
    }
