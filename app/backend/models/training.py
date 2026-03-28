from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
import uuid

class TrainingProgram(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    program_id: str
    title: str
    description: str
    duration: str
    topics: List[str]
    created_at: datetime = Field(default_factory=datetime.utcnow)

class TrainingRegistration(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    facility_name: str
    contact_person: str
    email: EmailStr
    phone: str
    training_type: str
    number_of_participants: int
    preferred_date: Optional[str] = None
    message: Optional[str] = None
    status: str = "pending"  # pending, scheduled, completed, cancelled
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class TrainingRegistrationCreate(BaseModel):
    facility_name: str
    contact_person: str
    email: EmailStr
    phone: str
    training_type: str
    number_of_participants: int
    preferred_date: Optional[str] = None
    message: Optional[str] = None