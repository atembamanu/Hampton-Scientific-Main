from typing import List, Optional, Set

from fastapi import HTTPException, Depends, status
from sqlalchemy.orm import Session

from db.models import User, Branch, UserBranchAssignment, Organization
from deps import get_db
from utils.auth import get_current_user
from models.user import UserResponse


COMPANY_ROLES = frozenset({"admin", "operations", "sales"})

COMPANY_PERMISSIONS = {
    "admin": {
        "dashboard", "quotes", "orders", "invoices", "messages",
        "catalogue", "facilities", "reports", "deliveries",
        "company_users", "settings", "training", "contact", "field", "careers",
    },
    "operations": {
        "dashboard", "quotes", "orders", "invoices", "messages",
        "catalogue", "facilities", "reports", "deliveries",
        "training", "contact", "field", "careers",
    },
    "sales": {
        "dashboard", "quotes", "orders", "messages", "field",
    },
}

ROLE_PERMISSIONS = {
    "admin": set(COMPANY_PERMISSIONS["admin"]),
    "operations": set(COMPANY_PERMISSIONS["operations"]),
    "sales": set(COMPANY_PERMISSIONS["sales"]),
    "org_admin": {
        "dashboard", "products", "quotes", "orders", "branches", "users",
        "invoices", "reports", "org_settings", "profile",
    },
    "branch_admin": {
        "products", "quotes", "orders",
        "reports", "profile",
    },
    "branch_user": {
        "dashboard", "products", "quotes", "orders", "invoices", "profile",
    },
    "customer": {"dashboard", "products", "quotes", "invoices"},
}


def get_permissions_for_role(role: str, org_settings: Optional[dict] = None) -> List[str]:
    perms = set(ROLE_PERMISSIONS.get(role, ROLE_PERMISSIONS["customer"]))
    if role == "branch_user" and org_settings:
        if org_settings.get("branch_users_can_order_directly", True):
            perms.add("orders")
        else:
            perms.discard("orders")
    return sorted(perms)


def is_company_staff(role: Optional[str]) -> bool:
    return (role or "") in COMPANY_ROLES


def reject_wrong_login_portal(role: Optional[str], portal: Optional[str]) -> None:
    """Facility sign-in is for facility users. Company staff use the operations portal."""
    if portal == "facility" and is_company_staff(role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This sign-in is for facility users. Company staff should use the operations portal.",
        )
    if portal == "company" and not is_company_staff(role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Company staff credentials required.",
        )


def company_has_permission(role: Optional[str], permission: str) -> bool:
    return permission in COMPANY_PERMISSIONS.get(role or "", set())


def can_see_buying_price(role: Optional[str]) -> bool:
    return (role or "") in ("admin", "operations")


def require_company_permission(*permissions: str):
    """FastAPI dependency factory for Hampton company staff."""

    async def _dep(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
        if not is_company_staff(current_user.role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Company staff access required",
            )
        if permissions and not any(company_has_permission(current_user.role, p) for p in permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    _dep.__name__ = f"require_company_{'_'.join(permissions) or 'staff'}"
    _dep._company_staff = True
    return _dep


def get_branch_manager_scope_ids(db: Session, user: User) -> List[str]:
    """Branch managers see only their primary assigned branch."""
    if user.role == "branch_admin":
        primary = get_user_primary_branch_id(db, user)
        return [primary] if primary else []
    if user.role == "branch_user":
        return get_user_accessible_branch_ids(db, user)
    if user.role in ("admin", "org_admin"):
        if not user.organization_id:
            return []
        branches = (
            db.query(Branch.id)
            .filter(Branch.organization_id == user.organization_id, Branch.status == "active")
            .all()
        )
        return [b.id for b in branches]
    return get_user_accessible_branch_ids(db, user)


def get_user_accessible_branch_ids(db: Session, user: User) -> List[str]:
    if user.role in ("admin", "org_admin"):
        if not user.organization_id:
            return []
        branches = (
            db.query(Branch.id)
            .filter(Branch.organization_id == user.organization_id, Branch.status == "active")
            .all()
        )
        return [b.id for b in branches]

    assignments = (
        db.query(UserBranchAssignment.branch_id)
        .join(Branch, Branch.id == UserBranchAssignment.branch_id)
        .filter(
            UserBranchAssignment.user_id == user.id,
            Branch.status == "active",
        )
        .all()
    )
    return [a.branch_id for a in assignments]


def get_user_primary_branch_id(db: Session, user: User) -> Optional[str]:
    from db.models import UserBranchAssignment

    primary = (
        db.query(UserBranchAssignment.branch_id)
        .join(Branch, Branch.id == UserBranchAssignment.branch_id)
        .filter(
            UserBranchAssignment.user_id == user.id,
            UserBranchAssignment.is_primary == True,
            Branch.status == "active",
        )
        .one_or_none()
    )
    if primary:
        return primary.branch_id
    ids = get_user_accessible_branch_ids(db, user)
    return ids[0] if ids else None


def resolve_write_branch_id(
    db: Session, user: User, requested_branch_id: Optional[str] = None
) -> str:
    """
    Resolve branch for quote/order creation.
    Branch managers and branch users cannot assign resources to another branch.
    """
    if user.role in ("branch_admin", "branch_user"):
        authorized = get_user_primary_branch_id(db, user)
        if not authorized:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No branch assigned to your account",
            )
        if requested_branch_id and requested_branch_id != authorized:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot assign resources to another branch",
            )
        return authorized

    if not requested_branch_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Branch is required",
        )
    require_branch_access(db, user, requested_branch_id)
    return requested_branch_id


def require_branch_access(db: Session, user: User, branch_id: str) -> None:
    if user.role in ("admin", "org_admin"):
        branch = db.query(Branch).filter(Branch.id == branch_id).one_or_none()
        if not branch or branch.organization_id != user.organization_id:
            raise HTTPException(status_code=403, detail="Branch access denied")
        return

    if user.role == "branch_admin":
        scope = get_branch_manager_scope_ids(db, user)
    else:
        scope = get_user_accessible_branch_ids(db, user)
    if branch_id not in scope:
        raise HTTPException(status_code=403, detail="Branch access denied")


def resolve_list_branch_ids(db: Session, user: User, branch_id: Optional[str] = None) -> Optional[List[str]]:
    """Branch ids for facility list queries. None means all branches in the org."""
    from utils.list_query import csv_values

    requested = csv_values(branch_id)
    if user.role in ("branch_admin", "branch_user"):
        accessible = get_branch_manager_scope_ids(db, user) or []
        if requested:
            allowed = []
            for bid in requested:
                require_branch_access(db, user, bid)
                if bid in accessible:
                    allowed.append(bid)
            return allowed
        return accessible
    if requested:
        for bid in requested:
            require_branch_access(db, user, bid)
        return requested
    return None



def get_facility_user(db: Session, current_user: UserResponse) -> User:
    user = db.query(User).filter(User.id == current_user.id).one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if is_company_staff(user.role) and not user.organization_id:
        raise HTTPException(status_code=403, detail="Company staff cannot use the facility portal")
    if user.role == "admin":
        return user
    if not user.organization_id:
        raise HTTPException(status_code=403, detail="Not linked to an organization")
    return user


async def require_org_admin(
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    user = get_facility_user(db, current_user)
    if user.role not in ("admin", "org_admin"):
        raise HTTPException(status_code=403, detail="Organization admin access required")
    return user


async def require_facility_user(
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    user = get_facility_user(db, current_user)
    if is_company_staff(user.role):
        raise HTTPException(status_code=403, detail="Facility user required")
    return user
