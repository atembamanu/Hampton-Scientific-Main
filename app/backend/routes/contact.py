from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime

from sqlalchemy.orm import Session

from models.contact import (
    ContactInquiry,
    ContactInquiryCreate,
    NewsletterSubscription,
    NewsletterSubscribe,
)
from models.user import UserResponse
from utils.auth import get_admin_user
from utils.email_service import send_contact_inquiry_email, send_newsletter_welcome_email
from utils.email_followup import get_followup_settings, update_followup_settings, get_email_logs
from utils.logger import logger
from deps import get_db
from repositories import contact as contact_repo

router = APIRouter()

# ---- public contact routes -----------------------------------------------

@router.post("/contact/inquiry", response_model=ContactInquiry)
async def create_contact_inquiry(
    inquiry_data: ContactInquiryCreate,
    db: Session = Depends(get_db),
):
    """Create a contact inquiry (public endpoint)."""
    inquiry_data_dict = inquiry_data.dict()
    inquiry = contact_repo.create_contact_inquiry(db, inquiry_data_dict)
    logger.info(f"New contact inquiry from {inquiry.email}")
    
    # Send email notification
    send_contact_inquiry_email(
        inquiry.name,
        inquiry.email,
        inquiry.phone or "Not provided",
        inquiry.subject,
        inquiry.message
    )
    
    return inquiry

@router.post("/newsletter/subscribe", response_model=NewsletterSubscription)
async def subscribe_newsletter(
    subscribe_data: NewsletterSubscribe,
    db: Session = Depends(get_db),
):
    """Subscribe to newsletter (public endpoint)."""
    # Check if already subscribed
    existing = contact_repo.get_newsletter_by_email(db, subscribe_data.email)
    if existing:
        if existing.subscribed:
            return NewsletterSubscription.from_orm(existing)
        else:
            # Resubscribe
            updated = contact_repo.resubscribe_newsletter(db, existing)
            return NewsletterSubscription.from_orm(updated)
    
    subscription_row = contact_repo.create_newsletter_subscription(
        db, subscribe_data.email
    )
    subscription = NewsletterSubscription.from_orm(subscription_row)
    logger.info(f"New newsletter subscription: {subscription.email}")
    
    # Send welcome email
    send_newsletter_welcome_email(subscription.email)
    
    return subscription

@router.get("/settings")
async def get_settings(db: Session = Depends(get_db)):
    """Get public site settings (contact info, etc.)."""
    settings_row = contact_repo.get_site_settings(db)
    
    if not settings_row:
        settings = {}
    else:
        settings = {
            "company_name": settings_row.company_name or "",
            "website": getattr(settings_row, "website", None) or "",
            "address": settings_row.address or "",
            "po_box": settings_row.po_box or "",
            "phone": settings_row.phone or "",
            "email": settings_row.email or "",
            "working_hours": settings_row.working_hours or "",
            "google_maps_url": settings_row.google_maps_url or "",
            "facebook_url": settings_row.facebook_url or "",
            "twitter_url": settings_row.twitter_url or "",
            "linkedin_url": settings_row.linkedin_url or "",
            "bank_name": settings_row.bank_name or "",
            "bank_account_name": settings_row.bank_account_name or "",
            "bank_account_number": settings_row.bank_account_number or "",
            "mpesa_paybill": settings_row.mpesa_paybill or "",
            "mpesa_account_number": settings_row.mpesa_account_number or "",
            "mpesa_account_name": settings_row.mpesa_account_name or "",
            "default_payment_terms": settings_row.default_payment_terms or "Net 30",
            "default_quote_validity_days": getattr(settings_row, "default_quote_validity_days", None) or 7,
            "default_invoice_due_days": getattr(settings_row, "default_invoice_due_days", None) or 14,
            "default_tax_rate": settings_row.default_tax_rate or 16,
            "default_include_vat": (
                settings_row.default_include_vat
                if settings_row.default_include_vat is not None
                else True
            ),
        }
    # Ensure payment defaults for existing documents missing these fields
    defaults = {
        "bank_name": "Kenya Commercial Bank",
        "bank_account_name": "Hampton Scientific Limited",
        "bank_account_number": "1234567890",
        "mpesa_paybill": "880100",
        "mpesa_account_number": "919070",
        "mpesa_account_name": "Hampton Scientific Limited",
        "default_payment_terms": "Net 30",
        "default_quote_validity_days": 7,
        "default_invoice_due_days": 14,
        "default_tax_rate": 16,
        "default_include_vat": True,
    }
    for key, val in defaults.items():
        if key not in settings:
            settings[key] = val
    return settings

# ---- admin contact routes -----------------------------------------------

@router.put("/admin/settings")
async def update_settings(
    settings_data: dict,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Update site settings - Admin only."""
    allowed_fields = [
        "company_name",
        "website",
        "address",
        "po_box",
        "phone",
        "email",
        "working_hours",
        "google_maps_url",
        "facebook_url",
        "twitter_url",
        "linkedin_url",
        "bank_name",
        "bank_account_name",
        "bank_account_number",
        "mpesa_paybill",
        "mpesa_account_number",
        "mpesa_account_name",
        "default_payment_terms",
        "default_quote_validity_days",
        "default_invoice_due_days",
        "default_tax_rate",
        "default_include_vat",
    ]
    
    update_data = {k: v for k, v in settings_data.items() if k in allowed_fields}
    update_data["updated_at"] = datetime.utcnow()
    update_data["updated_by"] = current_user.email
    
    settings_row = contact_repo.upsert_site_settings(db, update_data)
    
    logger.info(f"Site settings updated by {current_user.email}")
    # Refresh email templates cache
    from utils.email_service import set_company_info

    ci = {
        "company_name": settings_row.company_name or "",
        "website": getattr(settings_row, "website", None) or "",
        "address": settings_row.address or "",
        "po_box": settings_row.po_box or "",
        "phone": settings_row.phone or "",
        "email": settings_row.email or "",
        "working_hours": settings_row.working_hours or "",
        "bank_name": settings_row.bank_name or "",
        "bank_account_name": settings_row.bank_account_name or "",
        "bank_account_number": settings_row.bank_account_number or "",
        "mpesa_paybill": settings_row.mpesa_paybill or "",
        "mpesa_account_number": settings_row.mpesa_account_number or "",
        "mpesa_account_name": settings_row.mpesa_account_name or "",
    }
    set_company_info(ci)
    return {"message": "Settings updated successfully"}

@router.get("/admin/inquiries")
async def get_all_inquiries(
    current_user: UserResponse = Depends(get_admin_user),
    limit: int = 50,
    skip: int = 0,
    db: Session = Depends(get_db),
):
    """Get all contact inquiries - Admin only."""
    inquiries = contact_repo.list_contact_inquiries(db, skip=skip, limit=limit)
    total = contact_repo.count_contact_inquiries(db)
    
    return {
        "inquiries": [ContactInquiry.from_orm(inq) for inq in inquiries],
        "total": total
    }

@router.get("/admin/email-settings")
async def get_email_settings(
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Get email follow-up settings - Admin only."""
    settings = await get_followup_settings(db)
    return settings

@router.put("/admin/email-settings")
async def update_email_settings(
    settings_data: dict,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Update email follow-up settings - Admin only."""
    updated = await update_followup_settings(db, settings_data)
    logger.info(f"Email settings updated by {current_user.email}")
    return {"message": "Email settings updated successfully", "settings": updated}

@router.get("/admin/email-logs")
async def get_admin_email_logs(
    limit: int = 100,
    email_type: str = None,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Get email logs - Admin only."""
    filters = {}
    if email_type:
        filters["type"] = email_type
    logs = await get_email_logs(db, filters, limit)
    return {"logs": logs, "total": len(logs)}