from datetime import datetime
from typing import Optional, Literal

from pydantic import BaseModel, EmailStr, Field
from models.base import AppModel

from utils.contact_validation import OptionalEmailStr, OptionalPhoneStr, PhoneStr


FacilityType = Literal[
    "hospital", "clinic", "pharmacy", "laboratory",
    "medical_centre", "ngo", "other",
]


class OrganizationBase(BaseModel):
    name: str
    facilityType: FacilityType
    registrationNumber: Optional[str] = None
    taxNumber: Optional[str] = None
    phone: PhoneStr
    email: EmailStr
    website: Optional[str] = None
    addressLine: str
    county: Optional[str] = None
    country: str = "Kenya"
    isMultiBranch: bool = False


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    facilityType: Optional[FacilityType] = None
    registrationNumber: Optional[str] = None
    taxNumber: Optional[str] = None
    phone: OptionalPhoneStr = None
    email: OptionalEmailStr = None
    website: Optional[str] = None
    addressLine: Optional[str] = None
    county: Optional[str] = None
    country: Optional[str] = None
    branchUsersCanOrderDirectly: Optional[bool] = None


class OrganizationResponse(AppModel):
    id: str
    name: str
    facilityType: str
    registrationNumber: Optional[str] = None
    taxNumber: Optional[str] = None
    phone: str
    email: str
    website: Optional[str] = None
    addressLine: str
    county: Optional[str] = None
    country: str = "Kenya"
    isMultiBranch: bool = False
    settings: dict = Field(default_factory=dict)
    createdAt: Optional[datetime] = None

    class Config:
        from_attributes = True
