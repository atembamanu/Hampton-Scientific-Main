from datetime import datetime
from typing import Optional, Literal

from pydantic import BaseModel, EmailStr
from models.base import AppModel

from utils.contact_validation import OptionalPhoneStr


BranchStatus = Literal["active", "inactive"]


class BranchCreate(BaseModel):
    name: str
    branchCode: str
    contactName: Optional[str] = None
    phone: OptionalPhoneStr = None
    email: Optional[EmailStr] = None
    physicalAddress: str
    deliveryAddress: Optional[str] = None
    county: Optional[str] = None
    isMain: bool = False


class BranchUpdate(BaseModel):
    name: Optional[str] = None
    branchCode: Optional[str] = None
    contactName: Optional[str] = None
    phone: OptionalPhoneStr = None
    email: Optional[EmailStr] = None
    physicalAddress: Optional[str] = None
    deliveryAddress: Optional[str] = None
    county: Optional[str] = None
    status: Optional[BranchStatus] = None


class BranchResponse(AppModel):
    id: str
    organizationId: str
    name: str
    branchCode: str
    contactName: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    physicalAddress: str
    deliveryAddress: Optional[str] = None
    county: Optional[str] = None
    status: str = "active"
    isMain: bool = False
    createdAt: Optional[datetime] = None

    class Config:
        from_attributes = True
