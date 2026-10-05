from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr
from models.base import AppModel

from utils.contact_validation import OptionalPhoneStr


class DeliveryLocationCreate(BaseModel):
    branchId: Optional[str] = None
    label: str
    contactName: Optional[str] = None
    phone: OptionalPhoneStr = None
    email: Optional[EmailStr] = None
    addressLine: str
    county: Optional[str] = None
    country: str = "Kenya"
    deliveryInstructions: Optional[str] = None
    isDefault: bool = False


class DeliveryLocationUpdate(BaseModel):
    branchId: Optional[str] = None
    label: Optional[str] = None
    contactName: Optional[str] = None
    phone: OptionalPhoneStr = None
    email: Optional[EmailStr] = None
    addressLine: Optional[str] = None
    county: Optional[str] = None
    country: Optional[str] = None
    deliveryInstructions: Optional[str] = None
    isDefault: Optional[bool] = None


class DeliveryLocationResponse(AppModel):
    id: str
    organizationId: str
    branchId: Optional[str] = None
    label: str
    contactName: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    addressLine: str
    county: Optional[str] = None
    country: str = "Kenya"
    deliveryInstructions: Optional[str] = None
    isDefault: bool = False
    createdAt: Optional[datetime] = None

    class Config:
        from_attributes = True
