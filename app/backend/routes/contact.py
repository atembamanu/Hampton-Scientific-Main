from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime

from sqlalchemy.orm import Session

from models.contact import (
    ContactInquiry,
    ContactInquiryCreate,
    NewsletterSubscription,
    NewsletterSubscribe,
    NewsletterSubscribeResponse,
    NewsletterUnsubscribe,
    NewsletterUnsubscribeResponse,
)
from models.user import UserResponse
from utils.auth import get_admin_user
from utils.permissions import require_company_permission
from utils.email_service import (
    send_contact_inquiry_email,
    send_newsletter_already_subscribed_email,
    send_newsletter_welcome_email,
)
from utils.newsletter_tokens import (
    newsletter_unsubscribe_url,
    verify_newsletter_unsub_token,
)
from utils.email_followup import get_followup_settings, update_followup_settings, get_email_logs
from utils.contact_validation import raise_if_invalid_email, raise_if_invalid_phone
from utils.logger import logger
from utils.site_content import normalize_impact_stats, normalize_partners
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

@router.post("/newsletter/subscribe", response_model=NewsletterSubscribeResponse)
async def subscribe_newsletter(
    subscribe_data: NewsletterSubscribe,
    db: Session = Depends(get_db),
):
    """Subscribe to newsletter (public endpoint)."""
    email = str(subscribe_data.email).strip().lower()
    existing = contact_repo.get_newsletter_by_email(db, email)
    unsub_url = newsletter_unsubscribe_url(email)

    if existing and existing.subscribed:
        send_newsletter_already_subscribed_email(email)
        return NewsletterSubscribeResponse(
            id=existing.id,
            email=existing.email,
            subscribed=True,
            subscribed_at=existing.subscribed_at,
            status="already_subscribed",
            message="You're already on our newsletter list.",
            unsubscribe_url=unsub_url,
        )

    if existing:
        updated = contact_repo.resubscribe_newsletter(db, existing)
        send_newsletter_welcome_email(updated.email)
        logger.info(f"Newsletter resubscribed: {updated.email}")
        return NewsletterSubscribeResponse(
            id=updated.id,
            email=updated.email,
            subscribed=True,
            subscribed_at=updated.subscribed_at,
            status="resubscribed",
            message="Welcome back — you're subscribed again.",
            unsubscribe_url=unsub_url,
        )

    subscription_row = contact_repo.create_newsletter_subscription(db, email)
    send_newsletter_welcome_email(subscription_row.email)
    logger.info(f"New newsletter subscription: {subscription_row.email}")
    return NewsletterSubscribeResponse(
        id=subscription_row.id,
        email=subscription_row.email,
        subscribed=True,
        subscribed_at=subscription_row.subscribed_at,
        status="created",
        message="Thanks for subscribing — check your inbox for a welcome email.",
        unsubscribe_url=unsub_url,
    )


@router.post("/newsletter/unsubscribe", response_model=NewsletterUnsubscribeResponse)
async def unsubscribe_newsletter(
    body: NewsletterUnsubscribe,
    db: Session = Depends(get_db),
):
    """Public unsubscribe — requires signed token from email or subscribe response."""
    email = str(body.email).strip().lower()
    if not verify_newsletter_unsub_token(email, body.token):
        raise HTTPException(status_code=400, detail="Invalid or expired unsubscribe link.")

    existing = contact_repo.get_newsletter_by_email(db, email)
    if not existing:
        return NewsletterUnsubscribeResponse(
            email=email,
            subscribed=False,
            message="This email is not on our newsletter list.",
        )
    if not existing.subscribed:
        return NewsletterUnsubscribeResponse(
            email=email,
            subscribed=False,
            message="You're already unsubscribed.",
        )

    contact_repo.unsubscribe_newsletter(db, existing)
    logger.info(f"Newsletter unsubscribed: {email}")
    return NewsletterUnsubscribeResponse(
        email=email,
        subscribed=False,
        message="You've been unsubscribed. You won't receive further newsletter emails.",
    )

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
            "impact_stats": normalize_impact_stats(
                getattr(settings_row, "impact_stats", None),
                fallback=getattr(settings_row, "impact_stats", None) is None,
            ),
            "partners": normalize_partners(
                getattr(settings_row, "partners", None),
                fallback=getattr(settings_row, "partners", None) is None,
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
        "impact_stats": normalize_impact_stats(None),
        "partners": normalize_partners(None),
    }
    for key, val in defaults.items():
        if key not in settings:
            settings[key] = val
    return settings

# ---- admin contact routes -----------------------------------------------

@router.put("/admin/settings")
async def update_settings(
    settings_data: dict,
    current_user: UserResponse = Depends(require_company_permission("settings")),
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
        "impact_stats",
        "partners",
    ]
    
    update_data = {k: v for k, v in settings_data.items() if k in allowed_fields}
    if "email" in update_data:
        raise_if_invalid_email(update_data.get("email") or "")
    if "phone" in update_data:
        raise_if_invalid_phone(update_data.get("phone") or "")
    if "impact_stats" in update_data:
        update_data["impact_stats"] = normalize_impact_stats(update_data.get("impact_stats"), fallback=False)
    if "partners" in update_data:
        update_data["partners"] = normalize_partners(update_data.get("partners"), fallback=False)
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
    current_user: UserResponse = Depends(require_company_permission("contact")),
    limit: int = 50,
    skip: int = 0,
    db: Session = Depends(get_db),
):
    """Get all contact inquiries - Admin only."""
    inquiries = contact_repo.list_contact_inquiries(db, skip=skip, limit=limit)
    total = contact_repo.count_contact_inquiries(db)
    
    return {
        "inquiries": [ContactInquiry.model_validate(inq) for inq in inquiries],
        "total": total
    }

@router.get("/admin/email-settings")
async def get_email_settings(
    current_user: UserResponse = Depends(require_company_permission("settings")),
    db: Session = Depends(get_db),
):
    """Get email follow-up settings - Admin only."""
    settings = await get_followup_settings(db)
    return settings

@router.put("/admin/email-settings")
async def update_email_settings(
    settings_data: dict,
    current_user: UserResponse = Depends(require_company_permission("settings")),
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
    current_user: UserResponse = Depends(require_company_permission("settings")),
    db: Session = Depends(get_db),
):
    """Get email logs - Admin only."""
    filters = {}
    if email_type:
        filters["type"] = email_type
    logs = await get_email_logs(db, filters, limit)
    return {"logs": logs, "total": len(logs)}