from types import SimpleNamespace

from sqlalchemy import or_

from utils.sales_scope import (
    apply_order_scope,
    apply_quote_scope,
    quote_visible_to_sales,
    resolve_sales_assignee_id,
)


class _Query:
    def __init__(self, rows, model="quote"):
        self.rows = rows
        self.model = model
        self.filtered = None

    def filter(self, clause):
        self.filtered = clause
        return self


def test_sales_sees_assigned_or_own_facility_quotes():
    quote = SimpleNamespace(
        assigned_sales_user_id="agent-1",
        quoted_by_user_id=None,
        assigned_admin_id=None,
        organization_id="org-a",
    )
    other = SimpleNamespace(
        assigned_sales_user_id="agent-2",
        quoted_by_user_id=None,
        assigned_admin_id=None,
        organization_id="org-b",
    )
    assert quote_visible_to_sales(quote, "agent-1", {"org-a"})
    assert not quote_visible_to_sales(other, "agent-1", {"org-a"})
    facility = SimpleNamespace(
        assigned_sales_user_id=None,
        quoted_by_user_id=None,
        assigned_admin_id=None,
        organization_id="org-a",
    )
    assert quote_visible_to_sales(facility, "agent-1", {"org-a"})


def test_admin_quote_scope_is_unfiltered():
    query = _Query([])
    admin = SimpleNamespace(role="admin", id="admin-1")
    assert apply_quote_scope(query, None, admin) is query
    assert query.filtered is None


def test_sales_assignee_defaults_to_current_sales_user():
    class _Db:
        def query(self, model):
            class _Q:
                def filter(self, *args, **kwargs):
                    return self

                def one_or_none(self):
                    return None

            return _Q()

    user = SimpleNamespace(role="sales", id="agent-1")
    assert resolve_sales_assignee_id(_Db(), user) == "agent-1"
