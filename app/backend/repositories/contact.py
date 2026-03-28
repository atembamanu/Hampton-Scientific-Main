from __future__ import annotations

from collections.abc import Sequence
from typing import Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from db.models import (
    ContactInquiry,
    NewsletterSubscription,
    SiteSettings,
)


def create_contact_inquiry(db: Session, data: dict) -> ContactInquiry:
    inquiry = ContactInquiry(
        id=data.get("id") or str(uuid4()),
        name=data["name"],
        email=data["email"],
        phone=data.get("phone"),
        subject=data["subject"],
        message=data["message"],
        status=data.get("status", "new"),
    )
    db.add(inquiry)
    db.commit()
    db.refresh(inquiry)
    return inquiry


def list_contact_inquiries(
    db: Session, skip: int = 0, limit: int = 50
) -> Sequence[ContactInquiry]:
    return (
        db.query(ContactInquiry)
        .order_by(ContactInquiry.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def count_contact_inquiries(db: Session) -> int:
    return db.query(ContactInquiry).count()


def get_newsletter_by_email(
    db: Session, email: str
) -> Optional[NewsletterSubscription]:
    return (
        db.query(NewsletterSubscription)
        .filter(NewsletterSubscription.email == email)
        .one_or_none()
    )


def create_newsletter_subscription(
    db: Session, email: str
) -> NewsletterSubscription:
    sub = NewsletterSubscription(
        id=str(uuid4()),
        email=email,
        subscribed=True,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


def resubscribe_newsletter(
    db: Session, sub: NewsletterSubscription
) -> NewsletterSubscription:
    from datetime import datetime

    sub.subscribed = True
    sub.subscribed_at = datetime.utcnow()
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


def get_site_settings(db: Session) -> Optional[SiteSettings]:
    return (
        db.query(SiteSettings)
        .filter(SiteSettings.id == "site_settings")
        .one_or_none()
    )


def upsert_site_settings(db: Session, update_data: dict) -> SiteSettings:
    settings = get_site_settings(db)
    if not settings:
        settings = SiteSettings(id="site_settings")

    for key, value in update_data.items():
        if hasattr(settings, key):
            setattr(settings, key, value)

    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings

