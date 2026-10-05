from typing import Optional, List

from pydantic import BaseModel, EmailStr

from utils.contact_validation import OptionalPhoneStr, PhoneStr

from models.organization import OrganizationCreate
from models.branch import BranchCreate


class PrimaryContactInput(BaseModel):
    firstName: str
    lastName: str
    jobTitle: Optional[str] = None
    phone: PhoneStr
    email: EmailStr


class CredentialsInput(BaseModel):
    email: EmailStr
    password: str


class FacilityRegistration(BaseModel):
    prospectId: Optional[str] = None
    organization: OrganizationCreate
    primaryContact: PrimaryContactInput
    credentials: CredentialsInput
    multiBranch: bool = False
    firstBranch: Optional[BranchCreate] = None


class FacilityUserCreate(BaseModel):
    firstName: str
    lastName: str
    email: EmailStr
    phone: PhoneStr
    jobTitle: Optional[str] = None
    role: str = "branch_user"
    branchIds: List[str] = []
    password: str


class FacilityUserUpdate(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    phone: OptionalPhoneStr = None
    jobTitle: Optional[str] = None
    role: Optional[str] = None
    branchIds: Optional[List[str]] = None
    canLogin: Optional[bool] = None
    password: Optional[str] = None
