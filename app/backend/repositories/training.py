from __future__ import annotations

from collections.abc import Sequence
from typing import Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from db.models import TrainingProgramORM, TrainingRegistrationORM


def list_programs(db: Session, limit: int = 100) -> Sequence[TrainingProgramORM]:
    return (
        db.query(TrainingProgramORM)
        .order_by(TrainingProgramORM.created_at.desc())
        .limit(limit)
        .all()
    )


def create_program(db: Session, data: dict) -> TrainingProgramORM:
    program = TrainingProgramORM(
        id=data.get("id") or str(uuid4()),
        program_id=data.get("program_id") or str(uuid4()),
        title=data["title"],
        description=data.get("description", ""),
        duration=data.get("duration", ""),
        topics=",".join(data.get("topics", [])) if isinstance(data.get("topics"), list) else data.get("topics"),
    )
    db.add(program)
    db.commit()
    db.refresh(program)
    return program


def get_program(db: Session, program_id: str) -> Optional[TrainingProgramORM]:
    return (
        db.query(TrainingProgramORM)
        .filter(TrainingProgramORM.id == program_id)
        .one_or_none()
    )


def update_program(
    db: Session, program: TrainingProgramORM, update_data: dict
) -> TrainingProgramORM:
    from datetime import datetime

    for key, value in update_data.items():
        if key == "topics" and isinstance(value, list):
            value = ",".join(value)
        if hasattr(program, key):
            setattr(program, key, value)
    program.updated_at = datetime.utcnow()
    db.add(program)
    db.commit()
    db.refresh(program)
    return program


def delete_program(db: Session, program: TrainingProgramORM) -> None:
    db.delete(program)
    db.commit()


def create_registration(
    db: Session, data: dict, user_id: Optional[str]
) -> TrainingRegistrationORM:
    reg = TrainingRegistrationORM(
        id=str(uuid4()),
        user_id=user_id,
        facility_name=data["facility_name"],
        contact_person=data["contact_person"],
        email=data["email"],
        phone=data["phone"],
        training_type=data["training_type"],
        number_of_participants=data.get("number_of_participants", 1),
        preferred_date=data.get("preferred_date"),
        message=data.get("message"),
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)
    return reg


def list_registrations_for_user(
    db: Session, user_id: str, limit: int = 100
) -> Sequence[TrainingRegistrationORM]:
    return (
        db.query(TrainingRegistrationORM)
        .filter(TrainingRegistrationORM.user_id == user_id)
        .order_by(TrainingRegistrationORM.created_at.desc())
        .limit(limit)
        .all()
    )


def list_registrations_admin(
    db: Session, skip: int = 0, limit: int = 50
) -> Sequence[TrainingRegistrationORM]:
    return (
        db.query(TrainingRegistrationORM)
        .order_by(TrainingRegistrationORM.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def count_registrations(db: Session) -> int:
    return db.query(TrainingRegistrationORM).count()

