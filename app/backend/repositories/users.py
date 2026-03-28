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


def count_users(db: Session) -> int:
    return db.query(User).count()

