from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from db.models import ActivityEvent


def log_activity(
    db: Session,
    *,
    entity_type: str,
    entity_id: str,
    event_type: str,
    summary: str,
    actor_id: Optional[str] = None,
    actor_name: Optional[str] = None,
    actor_role: Optional[str] = None,
    field_name: Optional[str] = None,
    previous_value: Optional[str] = None,
    new_value: Optional[str] = None,
    is_customer_visible: bool = True,
    commit: bool = False,
) -> ActivityEvent:
    event = ActivityEvent(
        id=str(uuid4()),
        entity_type=entity_type,
        entity_id=entity_id,
        event_type=event_type,
        actor_id=actor_id,
        actor_name=actor_name,
        actor_role=actor_role,
        summary=summary,
        field_name=field_name,
        previous_value=previous_value,
        new_value=new_value,
        is_customer_visible=is_customer_visible,
        created_at=datetime.utcnow(),
    )
    db.add(event)
    if commit:
        db.commit()
        db.refresh(event)
    return event


def serialize_event(event: ActivityEvent) -> dict:
    return {
        "id": event.id,
        "entity_type": event.entity_type,
        "entity_id": event.entity_id,
        "event_type": event.event_type,
        "actor_id": event.actor_id,
        "actor_name": event.actor_name,
        "actor_role": event.actor_role,
        "summary": event.summary,
        "field_name": event.field_name,
        "previous_value": event.previous_value,
        "new_value": event.new_value,
        "is_customer_visible": event.is_customer_visible,
        "created_at": event.created_at,
    }
