from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime

from sqlalchemy.orm import Session

from models.training import (
    TrainingProgram,
    TrainingRegistration,
    TrainingRegistrationCreate,
)
from models.user import UserResponse
from utils.auth import get_current_user, get_admin_user
from utils.email_service import send_training_registration_email
from utils.logger import logger
from deps import get_db
from repositories import training as training_repo
from db.models import TrainingProgramORM, TrainingRegistrationORM

router = APIRouter()

# ---- public training routes -----------------------------------------------

@router.get("/programs", response_model=List[TrainingProgram])
async def get_training_programs(db: Session = Depends(get_db)):
    """Get all available training programs."""
    programs = training_repo.list_programs(db, limit=100)
    result: List[TrainingProgram] = []
    for p in programs:
        topics = (p.topics or "").split(",") if p.topics else []
        result.append(
            TrainingProgram(
                id=p.id,
                program_id=p.program_id,
                title=p.title,
                description=p.description or "",
                duration=p.duration or "",
                topics=topics,
                created_at=p.created_at,
            )
        )
    return result

@router.post("/register", response_model=TrainingRegistration)
async def register_training(
    registration_data: TrainingRegistrationCreate,
    db: Session = Depends(get_db),
):
    """Register for a training program (public endpoint)."""
    reg_row = training_repo.create_registration(
        db, registration_data.dict(), user_id=None
    )
    registration = TrainingRegistration(
        id=reg_row.id,
        user_id=reg_row.user_id,
        facility_name=reg_row.facility_name,
        contact_person=reg_row.contact_person,
        email=reg_row.email,
        phone=reg_row.phone,
        training_type=reg_row.training_type,
        number_of_participants=reg_row.number_of_participants,
        preferred_date=reg_row.preferred_date,
        message=reg_row.message,
        status=reg_row.status,
        created_at=reg_row.created_at,
        updated_at=reg_row.updated_at,
    )
    logger.info(f"New training registration from {registration.email}")
    
    # Send email notification
    send_training_registration_email(
        registration.facility_name,
        registration.contact_person,
        registration.email,
        registration.phone,
        registration.training_type,
        registration.message or ""
    )
    
    return registration

# ---- customer training routes -----------------------------------------------

@router.get("/registrations", response_model=List[TrainingRegistration])
async def get_user_registrations(
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get training registrations for the logged-in user."""
    regs = training_repo.list_registrations_for_user(
        db, user_id=current_user.id, limit=100
    )
    return [
        TrainingRegistration(
            id=r.id,
            user_id=r.user_id,
            facility_name=r.facility_name,
            contact_person=r.contact_person,
            email=r.email,
            phone=r.phone,
            training_type=r.training_type,
            number_of_participants=r.number_of_participants,
            preferred_date=r.preferred_date,
            message=r.message,
            status=r.status,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in regs
    ]

# ---- admin training routes -----------------------------------------------

@router.get("/admin/registrations", response_model=List[dict])
async def get_all_training_registrations(
    current_user: UserResponse = Depends(get_admin_user),
    limit: int = 50,
    skip: int = 0,
    db: Session = Depends(get_db),
):
    """Get all training registrations (admin only)."""
    regs = training_repo.list_registrations_admin(db, skip=skip, limit=limit)
    total = training_repo.count_registrations(db)
    
    return {
        "registrations": [
            TrainingRegistration(
                id=r.id,
                user_id=r.user_id,
                facility_name=r.facility_name,
                contact_person=r.contact_person,
                email=r.email,
                phone=r.phone,
                training_type=r.training_type,
                number_of_participants=r.number_of_participants,
                preferred_date=r.preferred_date,
                message=r.message,
                status=r.status,
                created_at=r.created_at,
                updated_at=r.updated_at,
            )
            for r in regs
        ],
        "total": total
    }

@router.post("/admin/programs", response_model=TrainingProgram)
async def create_training_program(
    program_data: dict,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Create a new training program (admin only)."""
    data = program_data.copy()
    topics = data.get("topics") or []
    if isinstance(topics, list):
        data["topics"] = topics
    program_row = training_repo.create_program(db, data)
    logger.info(f"Training program created: {program_row.title}")
    
    return TrainingProgram(
        id=program_row.id,
        program_id=program_row.program_id,
        title=program_row.title,
        description=program_row.description or "",
        duration=program_row.duration or "",
        topics=(program_row.topics or "").split(",") if program_row.topics else [],
        created_at=program_row.created_at,
    )

@router.put("/admin/programs/{program_id}", response_model=TrainingProgram)
async def update_training_program(
    program_id: str,
    program_data: dict,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Update a training program (admin only)."""
    update_data = {k: v for k, v in program_data.items() if v is not None}
    
    program_row = training_repo.get_program(db, program_id)
    if not program_row:
        raise HTTPException(status_code=404, detail="Training program not found")
    
    updated_program = training_repo.update_program(db, program_row, update_data)
    logger.info(f"Training program updated: {updated_program.title}")
    
    return TrainingProgram(
        id=updated_program.id,
        program_id=updated_program.program_id,
        title=updated_program.title,
        description=updated_program.description or "",
        duration=updated_program.duration or "",
        topics=(updated_program.topics or "").split(",")
        if updated_program.topics
        else [],
        created_at=updated_program.created_at,
    )

@router.delete("/admin/programs/{program_id}")
async def delete_training_program(
    program_id: str,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Delete a training program (admin only)."""
    program_row = training_repo.get_program(db, program_id)
    if not program_row:
        raise HTTPException(status_code=404, detail="Training program not found")
    
    training_repo.delete_program(db, program_row)
    logger.info(f"Training program deleted: {program_id}")
    
    return {"message": "Training program deleted successfully"}