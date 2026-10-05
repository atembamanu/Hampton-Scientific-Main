from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from deps import get_db
from models.organization import OrganizationUpdate
from utils.facility_auth import serialize_organization
from utils.app_time import format_app
from utils.permissions import (
    require_facility_user,
    require_org_admin,
    get_user_accessible_branch_ids,
    get_user_primary_branch_id,
    get_branch_manager_scope_ids,
)
from db.models import User, Organization, Branch, Quote, Order, Invoice, OrderItem, QuoteItem

router = APIRouter()


@router.get("/me")
async def get_my_organization(
    user: User = Depends(require_facility_user),
    db: Session = Depends(get_db),
):
    org = db.query(Organization).filter(Organization.id == user.organization_id).one()
    return serialize_organization(org)


@router.put("/me")
async def update_my_organization(
    payload: OrganizationUpdate,
    user: User = Depends(require_org_admin),
    db: Session = Depends(get_db),
):
    org = db.query(Organization).filter(Organization.id == user.organization_id).one()
    data = payload.dict(exclude_unset=True)

    if "branchUsersCanOrderDirectly" in data:
        settings = dict(org.settings or {})
        settings["branch_users_can_order_directly"] = data.pop("branchUsersCanOrderDirectly")
        org.settings = settings

    field_map = {
        "name": "name",
        "facilityType": "facility_type",
        "registrationNumber": "registration_number",
        "taxNumber": "tax_number",
        "phone": "phone",
        "email": "email",
        "website": "website",
        "addressLine": "address_line",
        "county": "county",
        "country": "country",
    }
    for key, col in field_map.items():
        if key in data:
            setattr(org, col, data[key])

    org.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(org)
    return serialize_organization(org)


@router.get("/me/stats")
async def get_organization_stats(
    user: User = Depends(require_org_admin),
    db: Session = Depends(get_db),
):
    org_id = user.organization_id
    scoped_branch_ids = None
    if user.role in ("branch_admin", "branch_user"):
        scoped_branch_ids = get_branch_manager_scope_ids(db, user)

    if scoped_branch_ids is not None:
        branch_count = len(scoped_branch_ids)
        active_branches = branch_count
        from db.models import UserBranchAssignment

        user_count = (
            db.query(func.count(User.id.distinct()))
            .join(UserBranchAssignment, UserBranchAssignment.user_id == User.id)
            .filter(
                User.organization_id == org_id,
                UserBranchAssignment.branch_id.in_(scoped_branch_ids),
            )
            .scalar()
            or 0
        )
        quote_q = db.query(func.count(Quote.id)).filter(
            Quote.organization_id == org_id,
            Quote.ordered_for_branch_id.in_(scoped_branch_ids),
        )
        order_q = db.query(func.count(Order.id)).filter(
            Order.organization_id == org_id,
            Order.ordered_for_branch_id.in_(scoped_branch_ids),
        )
        invoice_q = db.query(func.count(Invoice.id)).filter(
            Invoice.organization_id == org_id,
            Invoice.branch_id.in_(scoped_branch_ids),
        )
    else:
        branch_count = db.query(func.count(Branch.id)).filter(Branch.organization_id == org_id).scalar() or 0
        active_branches = (
            db.query(func.count(Branch.id))
            .filter(Branch.organization_id == org_id, Branch.status == "active")
            .scalar()
            or 0
        )
        user_count = db.query(func.count(User.id)).filter(User.organization_id == org_id).scalar() or 0
        quote_q = db.query(func.count(Quote.id)).filter(Quote.organization_id == org_id)
        order_q = db.query(func.count(Order.id)).filter(Order.organization_id == org_id)
        invoice_q = db.query(func.count(Invoice.id)).filter(Invoice.organization_id == org_id)

    quote_count = quote_q.scalar() or 0
    order_count = order_q.scalar() or 0
    invoice_count = invoice_q.scalar() or 0

    pending_filter = [
        Order.organization_id == org_id,
        Order.status.in_(["quote_requested", "awaiting_approval", "processing"]),
    ]
    if scoped_branch_ids is not None:
        pending_filter.append(Order.ordered_for_branch_id.in_(scoped_branch_ids))

    pending_orders = db.query(func.count(Order.id)).filter(*pending_filter).scalar() or 0

    return {
        "branches": branch_count,
        "activeBranches": active_branches,
        "users": user_count,
        "quotes": quote_count,
        "orders": order_count,
        "invoices": invoice_count,
        "pendingOrders": pending_orders,
        "scopedToBranches": scoped_branch_ids is not None,
    }


@router.get("/me/branch-activity")
async def get_branch_activity(
    user: User = Depends(require_facility_user),
    db: Session = Depends(get_db),
):
    branch_query = db.query(Branch).filter(Branch.organization_id == user.organization_id)
    if user.role in ("branch_admin", "branch_user"):
        accessible = get_branch_manager_scope_ids(db, user)
        branch_query = branch_query.filter(Branch.id.in_(accessible))
    branches = branch_query.order_by(Branch.is_main.desc(), Branch.name.asc()).all()
    rows = []
    for b in branches:
        order_count = (
            db.query(func.count(Order.id))
            .filter(Order.ordered_for_branch_id == b.id)
            .scalar()
            or 0
        )
        quote_count = (
            db.query(func.count(Quote.id))
            .filter(Quote.ordered_for_branch_id == b.id)
            .scalar()
            or 0
        )
        rows.append({
            "branchId": b.id,
            "branchName": b.name,
            "branchCode": b.branch_code,
            "status": b.status,
            "isMain": b.is_main,
            "orders": order_count,
            "quotes": quote_count,
        })
    return rows


def _branch_scope_ids(db: Session, user: User, branch_id: str = None):
    if user.role in ("branch_admin", "branch_user"):
        return get_branch_manager_scope_ids(db, user)
    if branch_id:
        from utils.permissions import require_branch_access
        require_branch_access(db, user, branch_id)
        return [branch_id]
    return None


@router.get("/me/branch-dashboard")
async def get_branch_dashboard(
    user: User = Depends(require_org_admin),
    db: Session = Depends(get_db),
):
    org_id = user.organization_id
    branch_ids = _branch_scope_ids(db, user)
    primary_id = get_user_primary_branch_id(db, user)
    branch = db.query(Branch).filter(Branch.id == primary_id).one_or_none() if primary_id else None
    org = db.query(Organization).filter(Organization.id == org_id).one_or_none()

    def _quote_q(extra=None):
        q = db.query(func.count(Quote.id)).filter(Quote.organization_id == org_id)
        if branch_ids:
            q = q.filter(Quote.ordered_for_branch_id.in_(branch_ids))
        if extra:
            q = q.filter(extra)
        return q.scalar() or 0

    def _order_q(extra=None):
        q = db.query(func.count(Order.id)).filter(Order.organization_id == org_id)
        if branch_ids:
            q = q.filter(Order.ordered_for_branch_id.in_(branch_ids))
        if extra:
            q = q.filter(extra)
        return q.scalar() or 0

    pending_quotes = _quote_q(Quote.status.in_(["pending", "quoted", "revised"]))
    active_orders = _order_q(
        Order.status.in_(["quote_requested", "order_placed", "processing", "awaiting_approval"])
    )
    deliveries = _order_q(
        Order.status.in_(["dispatched", "out_for_delivery"])
    )
    completed_orders = _order_q(Order.status == "delivered")

    recent_q = db.query(Order).filter(Order.organization_id == org_id)
    if branch_ids:
        recent_q = recent_q.filter(Order.ordered_for_branch_id.in_(branch_ids))
    recent_orders = recent_q.order_by(Order.created_at.desc()).limit(8).all()

    return {
        "branchId": branch.id if branch else None,
        "branchName": branch.name if branch else None,
        "branchCode": branch.branch_code if branch else None,
        "organizationName": org.name if org else None,
        "pendingQuotes": pending_quotes,
        "activeOrders": active_orders,
        "deliveries": deliveries,
        "completedOrders": completed_orders,
        "recentOrders": [
            {
                "id": o.id,
                "orderNumber": o.order_number,
                "status": o.status,
                "createdAt": o.created_at,
            }
            for o in recent_orders
        ],
    }


@router.get("/me/reports")
async def get_branch_reports(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    branch_id: Optional[str] = None,
    user: User = Depends(require_facility_user),
    db: Session = Depends(get_db),
):
    from utils.facility_reports import build_facility_reports

    return build_facility_reports(
        db,
        user,
        from_date=from_date,
        to_date=to_date,
        branch_id=branch_id,
    )
