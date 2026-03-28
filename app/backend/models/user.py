from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal
from datetime import datetime
import uuid

class UserCreate(BaseModel):
    firstName: str
    lastName: str
    email: EmailStr
    phone: str
    password: str
    facilityName: str
    facilityType: Optional[str] = None
    address: str
    city: str
    postalCode: Optional[str] = None

    class Config:
        from_attributes = True

class AdminUserCreate(BaseModel):
    """Model for admin creating users"""
    firstName: str
    lastName: str
    email: EmailStr
    phone: str
    facilityName: str
    facilityType: Optional[str] = None
    address: Optional[str] = ""
    city: Optional[str] = ""
    postalCode: Optional[str] = None
    role: Literal["admin", "customer"] = "customer"
    can_login: bool = True

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    firstName: str
    lastName: str
    email: EmailStr
    phone: str
    hashed_password: str
    facilityName: str
    facilityType: Optional[str] = None
    address: str
    city: str
    postalCode: Optional[str] = None
    role: Literal["admin", "customer"] = "customer"
    can_login: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True

class UserResponse(BaseModel):
    id: str
    firstName: str
    lastName: str
    email: EmailStr
    phone: str
    facilityName: str
    facilityType: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postalCode: Optional[str] = None
    role: str = "customer"
    can_login: bool = True
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    phone: Optional[str] = None
    facilityName: Optional[str] = None
    facilityType: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postalCode: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    can_login: Optional[bool] = None

    class Config:
        from_attributes = True