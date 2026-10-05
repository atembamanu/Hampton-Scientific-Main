from collections.abc import Sequence
from typing import Optional

from sqlalchemy.orm import Session

from db.models import User


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).one_or_none()


def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).one_or_none()


def list_users(db: Session, skip: int = 0, limit: int = 50) -> Sequence[User]:
    return (
        db.query(User)
        .order_by(User.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


COMPANY_STAFF_ROLES = ("admin", "operations", "sales")


def list_company_staff(db: Session) -> Sequence[User]:
    return (
        db.query(User)
        .filter(User.role.in_(COMPANY_STAFF_ROLES), User.organization_id.is_(None))
        .order_by(User.created_at.desc())
        .all()
    )


def count_company_admins(db: Session) -> int:
    return (
        db.query(User)
        .filter(User.role == "admin", User.organization_id.is_(None), User.can_login.is_(True))
        .count()
    )


def count_users(db: Session) -> int:
    return db.query(User).count()

