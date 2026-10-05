from pydantic import BaseModel, EmailStr, Field
from models.base import AppModel

from utils.contact_validation import OptionalPhoneStr
from typing import Literal, Optional
from datetime import datetime
import uuid

class ContactInquiry(AppModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    phone: Optional[str] = None
    subject: str
    message: str
    status: str = "new"  # new, in_progress, resolved
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True

class ContactInquiryCreate(BaseModel):
    name: str
    email: EmailStr
    phone: OptionalPhoneStr = None
    subject: str
    message: str

class NewsletterSubscription(AppModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    subscribed: bool = True
    subscribed_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True

class NewsletterSubscribe(BaseModel):
    email: EmailStr

class NewsletterSubscribeResponse(AppModel):
    id: str
    email: EmailStr
    subscribed: bool = True
    subscribed_at: datetime
    status: Literal["created", "already_subscribed", "resubscribed"]
    message: str
    unsubscribe_url: Optional[str] = None

class NewsletterUnsubscribe(BaseModel):
    email: EmailStr
    token: str

class NewsletterUnsubscribeResponse(AppModel):
    email: EmailStr
    subscribed: bool = False
    message: str
