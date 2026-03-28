from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from .base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    facility_name = Column(String, nullable=False)
    facility_type = Column(String, nullable=True)
    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    postal_code = Column(String, nullable=True)
    role = Column(String, default="customer")
    can_login = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ProductCategory(Base):
    __tablename__ = "product_categories"

    id = Column(String, primary_key=True)
    category_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    image = Column(String, nullable=True)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True)
    product_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    category_id = Column(String, ForeignKey("product_categories.category_id"))
    category_name = Column(String, nullable=True)
    price = Column(Float, default=0)
    package = Column(String, nullable=True)
    stocking_unit = Column(String, nullable=True)
    unit = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    in_stock = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    category = relationship("ProductCategory", back_populates="products", viewonly=True, primaryjoin="Product.category_id==ProductCategory.category_id")


class Quote(Base):
    __tablename__ = "quotes"

    id = Column(String, primary_key=True, index=True)
    quote_number = Column(String, unique=True, index=True, nullable=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    facility_name = Column(String, nullable=False)
    contact_person = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    address = Column(String, nullable=True)
    additional_notes = Column(Text, nullable=True)

    status = Column(String, default="pending")
    customer_response = Column(String, nullable=True)
    customer_notes = Column(Text, nullable=True)
    current_handler = Column(String, default="ADMIN_REVIEW")

    discount_amount = Column(Float, default=0)
    tax_rate = Column(Float, default=16)
    tax_amount = Column(Float, default=0)
    subtotal = Column(Float, default=0)
    total = Column(Float, default=0)
    include_vat = Column(Boolean, default=True)
    # How many days the quote is valid for (used for due date / PDF content)
    validity_days = Column(Integer, default=30)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class QuoteItem(Base):
    __tablename__ = "quote_items"

    id = Column(String, primary_key=True)
    quote_id = Column(String, ForeignKey("quotes.id"), index=True, nullable=False)

    product_id = Column(String, nullable=True)
    product_name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    quantity = Column(Integer, default=1)
    unit_price = Column(Float, default=0)
    customer_proposed_price = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)


class ModifiedQuote(Base):
    __tablename__ = "modified_quotes"

    id = Column(String, primary_key=True)
    original_quote_id = Column(String, ForeignKey("quotes.id"), index=True, nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)

    facility_name = Column(String, nullable=False)
    contact_person = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    address = Column(String, nullable=True)

    subtotal = Column(Float, default=0)
    discount_amount = Column(Float, default=0)
    tax_rate = Column(Float, default=0)
    tax_amount = Column(Float, default=0)
    total = Column(Float, default=0)
    validity_days = Column(Integer, default=30)
    terms_and_conditions = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    modified_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ModifiedQuoteItem(Base):
    __tablename__ = "modified_quote_items"

    id = Column(String, primary_key=True)
    modified_quote_id = Column(String, ForeignKey("modified_quotes.id"), index=True, nullable=False)

    product_id = Column(String, nullable=True)
    product_name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    quantity = Column(Integer, default=1)
    original_price = Column(Float, nullable=True)
    modified_price = Column(Float, nullable=True)
    customer_proposed_price = Column(Float, nullable=True)
    discount_percent = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)


class QuoteRevision(Base):
    __tablename__ = "quote_revisions"

    id = Column(String, primary_key=True)
    quote_id = Column(String, ForeignKey("quotes.id"), index=True, nullable=False)
    revised_by = Column(String, nullable=False)  # "admin" or "customer"
    revised_by_id = Column(String, ForeignKey("users.id"), nullable=True)

    discount_amount = Column(Float, default=0)
    tax_rate = Column(Float, default=0)
    subtotal = Column(Float, default=0)
    total = Column(Float, default=0)
    notes = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(String, primary_key=True)
    invoice_number = Column(String, unique=True, index=True, nullable=False)
    quote_id = Column(String, ForeignKey("quotes.id"), index=True, nullable=False)
    modified_quote_id = Column(String, ForeignKey("modified_quotes.id"), nullable=True)

    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    facility_name = Column(String, nullable=False)
    contact_person = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    address = Column(String, nullable=True)

    subtotal = Column(Float, default=0)
    discount_amount = Column(Float, default=0)
    tax_rate = Column(Float, default=0)
    tax_amount = Column(Float, default=0)
    total = Column(Float, default=0)
    include_vat = Column(Boolean, default=True)

    payment_terms = Column(String, default="Net 30")
    due_date = Column(DateTime, nullable=True)
    status = Column(String, default="unpaid")
    notes = Column(Text, nullable=True)

    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    paid_at = Column(DateTime, nullable=True)


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(String, primary_key=True)
    invoice_id = Column(String, ForeignKey("invoices.id"), index=True, nullable=False)

    product_id = Column(String, nullable=True)
    product_name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    quantity = Column(Integer, default=1)
    original_price = Column(Float, nullable=True)
    modified_price = Column(Float, nullable=True)
    discount_percent = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)


class ContactInquiry(Base):
    __tablename__ = "contact_inquiries"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    subject = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String, default="new")
    created_at = Column(DateTime, default=datetime.utcnow)


class NewsletterSubscription(Base):
    __tablename__ = "newsletter_subscriptions"

    id = Column(String, primary_key=True)
    email = Column(String, unique=True, index=True, nullable=False)
    subscribed = Column(Boolean, default=True)
    subscribed_at = Column(DateTime, default=datetime.utcnow)


class SiteSettings(Base):
    __tablename__ = "site_settings"

    id = Column(String, primary_key=True)  # always "site_settings"
    company_name = Column(String, nullable=True)
    website = Column(String, nullable=True)
    address = Column(String, nullable=True)
    po_box = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    working_hours = Column(String, nullable=True)
    google_maps_url = Column(String, nullable=True)
    facebook_url = Column(String, nullable=True)
    twitter_url = Column(String, nullable=True)
    linkedin_url = Column(String, nullable=True)
    bank_name = Column(String, nullable=True)
    bank_account_name = Column(String, nullable=True)
    bank_account_number = Column(String, nullable=True)
    mpesa_paybill = Column(String, nullable=True)
    mpesa_account_number = Column(String, nullable=True)
    mpesa_account_name = Column(String, nullable=True)
    default_payment_terms = Column(String, default="Net 30")
    default_quote_validity_days = Column(Integer, default=7)
    default_invoice_due_days = Column(Integer, default=14)
    default_tax_rate = Column(Float, default=16)
    default_include_vat = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow)
    updated_by = Column(String, nullable=True)


class TrainingProgramORM(Base):
    __tablename__ = "training_programs"

    id = Column(String, primary_key=True)
    program_id = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    duration = Column(String, nullable=True)
    topics = Column(Text, nullable=True)  # store as comma-separated or JSON if desired
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TrainingRegistrationORM(Base):
    __tablename__ = "training_registrations"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    facility_name = Column(String, nullable=False)
    contact_person = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    training_type = Column(String, nullable=False)
    number_of_participants = Column(Integer, default=1)
    preferred_date = Column(String, nullable=True)
    message = Column(Text, nullable=True)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EmailSettings(Base):
    __tablename__ = "email_settings"

    id = Column(String, primary_key=True)  # "followup_settings"
    quote_followup_enabled = Column(Boolean, default=True)
    quote_followup_hours = Column(Integer, default=24)
    invoice_followup_enabled = Column(Boolean, default=True)
    invoice_followup_days = Column(Integer, default=7)
    invoice_overdue_reminder_days = Column(Integer, default=3)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EmailLog(Base):
    __tablename__ = "email_logs"

    id = Column(String, primary_key=True)
    to = Column(Text, nullable=False)
    subject = Column(String, nullable=False)
    type = Column(String, default="general")
    related_id = Column(String, nullable=True)
    status = Column(String, default="sent")
    sent_at = Column(DateTime, default=datetime.utcnow)
    error = Column(Text, nullable=True)


class ChatMessage(Base):
    __tablename__ = "chat_history"

    id = Column(String, primary_key=True)
    session_id = Column(String, index=True, nullable=False)
    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


