from fastapi import APIRouter, Depends
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from models.user import UserResponse
from utils.auth import get_admin_user
from utils.logger import logger
from deps import get_db
from db.models import (
    User as UserModel,
    Quote,
    Invoice,
    Product,
    TrainingRegistrationORM,
    ContactInquiry,
    NewsletterSubscription,
)

router = APIRouter()


@router.get("/stats")
async def get_admin_stats(
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Get dashboard statistics - Admin only"""
    # Count totals
    total_users = db.query(UserModel).count()
    total_quotes = db.query(Quote).count()
    total_products = db.query(Product).count()
    total_training_regs = db.query(TrainingRegistrationORM).count()
    total_inquiries = db.query(ContactInquiry).count()
    total_subscribers = (
        db.query(NewsletterSubscription)
        .filter(NewsletterSubscription.subscribed.is_(True))
        .count()
    )
    total_invoices = db.query(Invoice).count()

    # Quote status breakdown (statuses: quoted, invoiced)
    quoted_quotes = db.query(Quote).filter(Quote.status == "quoted").count()
    invoiced_quotes = db.query(Quote).filter(Quote.status == "invoiced").count()

    # Customer response breakdown
    accepted_quotes = (
        db.query(Quote)
        .filter(Quote.customer_response == "accepted")
        .count()
    )
    negotiating_quotes = (
        db.query(Quote)
        .filter(Quote.customer_response == "negotiating")
        .count()
    )

    # Invoice status (pending/paid)
    unpaid_invoices = db.query(Invoice).filter(Invoice.status == "pending").count()
    paid_invoices = (
        db.query(Invoice).filter(Invoice.status == "paid").count()
    )

    # Recent activity (last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    recent_quotes = (
        db.query(Quote).filter(Quote.created_at >= thirty_days_ago).count()
    )
    recent_users = (
        db.query(UserModel)
        .filter(UserModel.created_at >= thirty_days_ago)
        .count()
    )

    # Calculate estimated revenue from quotes
    all_quotes = db.query(Quote).all()
    total_revenue = sum(q.total or 0 for q in all_quotes)

    # Calculate invoiced amount
    all_invoices = db.query(Invoice).all()
    total_invoiced = sum(inv.total or 0 for inv in all_invoices)
    total_paid = sum(
        inv.total or 0 for inv in all_invoices if inv.status == "paid"
    )

    return {
        "users": {"total": total_users, "recent": recent_users},
        "quotes": {
            "total": total_quotes,
            "quoted": quoted_quotes,
            "invoiced": invoiced_quotes,
            "accepted": accepted_quotes,
            "negotiating": negotiating_quotes,
            "recent": recent_quotes,
        },
        "invoices": {
            "total": total_invoices,
            "unpaid": unpaid_invoices,
            "paid": paid_invoices,
            "total_invoiced": total_invoiced,
            "total_paid": total_paid,
        },
        "products": {"total": total_products},
        "training": {"registrations": total_training_regs},
        "inquiries": {"total": total_inquiries},
        "newsletter": {"subscribers": total_subscribers},
        "revenue": {"estimated_total": total_revenue},
    }