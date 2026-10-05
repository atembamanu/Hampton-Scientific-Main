import pytest
from fastapi import HTTPException

from utils.permissions import (
    COMPANY_ROLES,
    can_see_buying_price,
    company_has_permission,
    get_permissions_for_role,
    is_company_staff,
    reject_wrong_login_portal,
)


def test_company_roles():
    assert COMPANY_ROLES == frozenset({"admin", "operations", "sales"})
    assert is_company_staff("admin")
    assert is_company_staff("operations")
    assert is_company_staff("sales")
    assert not is_company_staff("org_admin")
    assert not is_company_staff("branch_admin")


def test_sales_cannot_manage_users_or_settings():
    assert company_has_permission("sales", "quotes")
    assert company_has_permission("sales", "orders")
    assert not company_has_permission("sales", "invoices")
    assert not company_has_permission("sales", "catalogue")
    assert not company_has_permission("sales", "facilities")
    assert not company_has_permission("sales", "reports")
    assert not company_has_permission("sales", "company_users")
    assert not company_has_permission("sales", "settings")
    assert not can_see_buying_price("sales")


def test_operations_matches_admin_except_users_settings():
    assert company_has_permission("operations", "catalogue")
    assert company_has_permission("operations", "facilities")
    assert company_has_permission("operations", "reports")
    assert can_see_buying_price("operations")
    assert not company_has_permission("operations", "company_users")
    assert not company_has_permission("operations", "settings")
    assert company_has_permission("admin", "careers")
    assert company_has_permission("operations", "careers")
    assert not company_has_permission("sales", "careers")


def test_facility_login_rejects_company_staff():
    with pytest.raises(HTTPException) as exc:
        reject_wrong_login_portal("admin", "facility")
    assert exc.value.status_code == 403
    reject_wrong_login_portal("org_admin", "facility")
    reject_wrong_login_portal("branch_user", "facility")


def test_company_login_rejects_facility_users():
    with pytest.raises(HTTPException) as exc:
        reject_wrong_login_portal("org_admin", "company")
    assert exc.value.status_code == 403
    reject_wrong_login_portal("admin", "company")
    reject_wrong_login_portal("sales", "company")


def test_login_without_portal_stays_open():
    reject_wrong_login_portal("admin", None)
    reject_wrong_login_portal("org_admin", None)


def test_facility_dashboard_is_org_admin_only():
    assert "dashboard" in get_permissions_for_role("org_admin")
    assert "dashboard" not in get_permissions_for_role("branch_admin")


def test_branch_personnel_can_view_profile():
    assert "profile" in get_permissions_for_role("branch_user")
