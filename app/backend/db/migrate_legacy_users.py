"""One-time migration: existing customer users -> Organization + Branch + org_admin."""
import uuid

from db.session import SessionLocal
from db.models import User, Organization, Branch, UserBranchAssignment, DeliveryLocation


def migrate_legacy_users() -> int:
    migrated = 0
    with SessionLocal() as db:
        users = (
            db.query(User)
            .filter(User.organization_id.is_(None))
            .filter(User.role.in_(["customer", "org_admin", "branch_admin", "branch_user"]))
            .all()
        )
        for user in users:
            if user.role == "admin":
                continue
            org_id = str(uuid.uuid4())
            branch_id = str(uuid.uuid4())
            org = Organization(
                id=org_id,
                name=user.facility_name,
                facility_type=user.facility_type or "other",
                phone=user.phone,
                email=user.email,
                address_line=user.address or "",
                county=user.city,
                country="Kenya",
                is_multi_branch=False,
                settings={"branch_users_can_order_directly": True},
            )
            branch = Branch(
                id=branch_id,
                organization_id=org_id,
                name=user.facility_name,
                branch_code="MAIN",
                contact_name=f"{user.first_name} {user.last_name}",
                phone=user.phone,
                email=user.email,
                physical_address=user.address or "",
                delivery_address=user.address,
                county=user.city,
                status="active",
                is_main=True,
            )
            delivery = DeliveryLocation(
                id=str(uuid.uuid4()),
                organization_id=org_id,
                branch_id=branch_id,
                label="Main Facility",
                contact_name=f"{user.first_name} {user.last_name}",
                phone=user.phone,
                email=user.email,
                address_line=user.address or "",
                county=user.city,
                is_default=True,
            )
            assignment = UserBranchAssignment(
                id=str(uuid.uuid4()),
                user_id=user.id,
                branch_id=branch_id,
                is_primary=True,
            )
            user.organization_id = org_id
            if user.role == "customer":
                user.role = "org_admin"
            db.add(org)
            db.add(branch)
            db.add(delivery)
            db.add(assignment)
            migrated += 1

        # Backfill quotes organization_id from user
        from db.models import Quote, Invoice

        quotes = db.query(Quote).filter(Quote.organization_id.is_(None)).all()
        for q in quotes:
            if q.user_id:
                u = db.query(User).filter(User.id == q.user_id).one_or_none()
                if u and u.organization_id:
                    q.organization_id = u.organization_id
                    if not q.ordered_by_user_id:
                        q.ordered_by_user_id = u.id
                    branch = (
                        db.query(Branch)
                        .filter(Branch.organization_id == u.organization_id, Branch.is_main == True)
                        .first()
                    )
                    if branch and not q.ordered_for_branch_id:
                        q.ordered_for_branch_id = branch.id

        invoices = db.query(Invoice).filter(Invoice.organization_id.is_(None)).all()
        for inv in invoices:
            if inv.user_id:
                u = db.query(User).filter(User.id == inv.user_id).one_or_none()
                if u and u.organization_id:
                    inv.organization_id = u.organization_id
                    branch = (
                        db.query(Branch)
                        .filter(Branch.organization_id == u.organization_id, Branch.is_main == True)
                        .first()
                    )
                    if branch and not inv.branch_id:
                        inv.branch_id = branch.id

        db.commit()
    return migrated
