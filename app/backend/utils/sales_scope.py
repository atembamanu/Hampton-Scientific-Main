"""Scope quotes, orders, and messages to the logged-in sales agent."""

from __future__ import annotations

from typing import Optional

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Query, Session

from db.models import Organization, Order, Quote, User
from models.user import UserResponse


def is_sales(user) -> bool:
    return getattr(user, "role", None) == "sales"


def can_assign_sales(user) -> bool:
    return getattr(user, "role", None) in ("admin", "operations")


def registered_org_ids(db: Session, user_id: str) -> list[str]:
    rows = (
        db.query(Organization.id)
        .filter(Organization.registered_by_user_id == user_id)
        .all()
    )
    return [row[0] for row in rows]


def _sales_agent_or_none(db: Session, user_id: Optional[str]) -> Optional[User]:
    if not user_id:
        return None
    agent = db.query(User).filter(User.id == user_id, User.role == "sales").one_or_none()
    if not agent or agent.organization_id:
        raise HTTPException(status_code=400, detail="Select a sales agent")
    return agent


def resolve_sales_assignee_id(
    db: Session,
    current_user,
    *,
    organization_id: Optional[str] = None,
    explicit_id: Optional[str] = None,
) -> Optional[str]:
    if explicit_id:
        agent = _sales_agent_or_none(db, explicit_id)
        return agent.id if agent else None
    if is_sales(current_user):
        return current_user.id
    if organization_id:
        org = db.query(Organization).filter(Organization.id == organization_id).one_or_none()
        registrar_id = getattr(org, "registered_by_user_id", None) if org else None
        if registrar_id:
            registrar = db.query(User).filter(User.id == registrar_id, User.role == "sales").one_or_none()
            if registrar:
                return registrar.id
    return None


def quote_visible_to_sales(quote: Quote, user_id: str, org_ids: set[str]) -> bool:
    if getattr(quote, "assigned_sales_user_id", None) == user_id:
        return True
    if getattr(quote, "quoted_by_user_id", None) == user_id:
        return True
    if getattr(quote, "assigned_admin_id", None) == user_id:
        return True
    if quote.organization_id and quote.organization_id in org_ids:
        return True
    return False


def apply_quote_scope(query: Query, db: Session, user) -> Query:
    if not is_sales(user):
        return query
    org_ids = registered_org_ids(db, user.id)
    clauses = [
        Quote.assigned_sales_user_id == user.id,
        Quote.quoted_by_user_id == user.id,
        Quote.assigned_admin_id == user.id,
    ]
    if org_ids:
        clauses.append(Quote.organization_id.in_(org_ids))
    return query.filter(or_(*clauses))


def visible_organization_ids(db: Session, user, *, scope: Optional[str] = None) -> Optional[list[str]]:
    """Facilities a sales agent may pick in a filter. None means every facility.

    scope=quotes: assigned quotes plus facilities they registered
    scope=orders: assigned orders plus facilities they registered
    """
    if not is_sales(user):
        return None
    ids = set(registered_org_ids(db, user.id))
    if scope == "quotes":
        rows = (
            db.query(Quote.organization_id)
            .filter(Quote.assigned_sales_user_id == user.id, Quote.organization_id.isnot(None))
            .distinct()
            .all()
        )
        ids.update(org_id for (org_id,) in rows if org_id)
    elif scope == "orders":
        rows = (
            db.query(Order.organization_id)
            .filter(Order.assigned_sales_user_id == user.id, Order.organization_id.isnot(None))
            .distinct()
            .all()
        )
        ids.update(org_id for (org_id,) in rows if org_id)
    return list(ids)


def apply_order_scope(query: Query, db: Session, user) -> Query:
    if not is_sales(user):
        return query
    org_ids = registered_org_ids(db, user.id)
    quote_clauses = [
        Quote.assigned_sales_user_id == user.id,
        Quote.quoted_by_user_id == user.id,
        Quote.assigned_admin_id == user.id,
    ]
    if org_ids:
        quote_clauses.append(Quote.organization_id.in_(org_ids))
    quote_match = db.query(Quote.id).filter(or_(*quote_clauses))
    order_clauses = [
        Order.assigned_sales_user_id == user.id,
        Order.quote_id.in_(quote_match),
    ]
    if org_ids:
        order_clauses.append(Order.organization_id.in_(org_ids))
    return query.filter(or_(*order_clauses))


def assert_quote_visible(db: Session, user, quote: Quote) -> None:
    if not is_sales(user):
        return
    org_ids = set(registered_org_ids(db, user.id))
    if quote_visible_to_sales(quote, user.id, org_ids):
        return
    raise HTTPException(status_code=404, detail="Quote not found")


def assert_order_visible(db: Session, user, order: Order) -> None:
    if not is_sales(user):
        return
    if getattr(order, "assigned_sales_user_id", None) == user.id:
        return
    org_ids = set(registered_org_ids(db, user.id))
    if order.organization_id and order.organization_id in org_ids:
        return
    if order.quote_id:
        quote = db.query(Quote).filter(Quote.id == order.quote_id).one_or_none()
        if quote and quote_visible_to_sales(quote, user.id, org_ids):
            return
    raise HTTPException(status_code=404, detail="Order not found")


def require_assigner(user: UserResponse) -> None:
    if not can_assign_sales(user):
        raise HTTPException(status_code=403, detail="Only admin or operations can assign a sales agent")
