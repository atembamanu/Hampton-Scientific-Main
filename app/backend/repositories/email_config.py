from __future__ import annotations

from collections.abc import Sequence
from typing import Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from db.models import EmailSettings, EmailLog


def get_email_settings(db: Session) -> EmailSettings:
    settings = (
        db.query(EmailSettings)
        .filter(EmailSettings.id == "followup_settings")
        .one_or_none()
    )
    if not settings:
        settings = EmailSettings(
            id="followup_settings",
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def update_email_settings(db: Session, data: dict) -> EmailSettings:
    settings = get_email_settings(db)
    for key, value in data.items():
        if hasattr(settings, key):
            setattr(settings, key, value)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def insert_email_log(db: Session, email_data: dict) -> EmailLog:
    log = EmailLog(
        id=str(uuid4()),
        to=",".join(email_data.get("to", [])),
        subject=email_data.get("subject", ""),
        type=email_data.get("type", "general"),
        related_id=email_data.get("related_id"),
        status=email_data.get("status", "sent"),
        error=email_data.get("error"),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def list_email_logs(
    db: Session, filters: Optional[dict] = None, limit: int = 100
) -> Sequence[EmailLog]:
    query = db.query(EmailLog)
    if filters:
        if "type" in filters:
            query = query.filter(EmailLog.type == filters["type"])
    return (
        query.order_by(EmailLog.sent_at.desc())
        .limit(limit)
        .all()
    )

