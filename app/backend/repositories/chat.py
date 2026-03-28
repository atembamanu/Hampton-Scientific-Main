from __future__ import annotations

from collections.abc import Sequence
from uuid import uuid4

from sqlalchemy.orm import Session

from db.models import ChatMessage


def append_chat_messages(db: Session, session_id: str, messages: list[dict]) -> None:
    for msg in messages:
        db.add(
            ChatMessage(
                id=str(uuid4()),
                session_id=session_id,
                role=msg["role"],
                content=msg["content"],
            )
        )
    db.commit()


def get_recent_messages(
    db: Session, session_id: str, limit: int = 3
) -> Sequence[ChatMessage]:
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.timestamp.desc())
        .limit(limit)
        .all()
    )

