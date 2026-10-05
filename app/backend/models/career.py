from datetime import datetime
from typing import Optional
import uuid

from pydantic import BaseModel, EmailStr, Field

from models.base import AppModel
from utils.contact_validation import OptionalPhoneStr


class JobPost(AppModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    department: str = ""
    location: str = ""
    employment_type: str = "full-time"
    description: str = ""
    requirements: str = ""
    is_published: bool = True
    application_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class JobPostCreate(BaseModel):
    title: str
    department: str = ""
    location: str = ""
    employment_type: str = "full-time"
    description: str = ""
    requirements: str = ""
    is_published: bool = True


class JobApplication(AppModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: str
    job_title: str = ""
    name: str
    email: EmailStr
    phone: Optional[str] = None
    cover_letter: Optional[str] = None
    cv_filename: Optional[str] = None
    cv_url: Optional[str] = None
    status: str = "new"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class JobApplicationCreate(BaseModel):
    name: str
    email: EmailStr
    phone: OptionalPhoneStr = None
    cover_letter: Optional[str] = None
