from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship

from .base import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    facility_type = Column(String, nullable=False)
    registration_number = Column(String, nullable=True)
    tax_number = Column(String, nullable=True)
    phone = Column(String, nullable=False)
    email = Column(String, nullable=False)
    website = Column(String, nullable=True)
    address_line = Column(String, nullable=False)
    county = Column(String, nullable=True)
    country = Column(String, default="Kenya")
    is_multi_branch = Column(Boolean, default=False)
    settings = Column(JSON, default=dict)
    registered_by_user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    branches = relationship("Branch", back_populates="organization")
    users = relationship("User", back_populates="organization", foreign_keys="User.organization_id")
    delivery_locations = relationship("DeliveryLocation", back_populates="organization")


class Branch(Base):
    __tablename__ = "branches"
    __table_args__ = (UniqueConstraint("organization_id", "branch_code", name="uq_org_branch_code"),)

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id"), index=True, nullable=False)
    name = Column(String, nullable=False)
    branch_code = Column(String, nullable=False)
    contact_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    physical_address = Column(String, nullable=False)
    delivery_address = Column(String, nullable=True)
    county = Column(String, nullable=True)
    status = Column(String, default="active")
    is_main = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization = relationship("Organization", back_populates="branches")
    user_assignments = relationship("UserBranchAssignment", back_populates="branch")


class UserBranchAssignment(Base):
    __tablename__ = "user_branch_assignments"
    __table_args__ = (UniqueConstraint("user_id", "branch_id", name="uq_user_branch"),)

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    branch_id = Column(String, ForeignKey("branches.id"), index=True, nullable=False)
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="branch_assignments")
    branch = relationship("Branch", back_populates="user_assignments")


class DeliveryLocation(Base):
    __tablename__ = "delivery_locations"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id"), index=True, nullable=False)
    branch_id = Column(String, ForeignKey("branches.id"), nullable=True)
    label = Column(String, nullable=False)
    contact_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    address_line = Column(String, nullable=False)
    county = Column(String, nullable=True)
    country = Column(String, default="Kenya")
    delivery_instructions = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization = relationship("Organization", back_populates="delivery_locations")
    branch = relationship("Branch")


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=True, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    job_title = Column(String, nullable=True)
    facility_name = Column(String, nullable=False)
    facility_type = Column(String, nullable=True)
    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    postal_code = Column(String, nullable=True)
    role = Column(String, default="customer")
    can_login = Column(Boolean, default=True)
    reset_token = Column(String, nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization = relationship("Organization", back_populates="users", foreign_keys=[organization_id])
    branch_assignments = relationship("UserBranchAssignment", back_populates="user")


class ProductCategory(Base):
    __tablename__ = "product_categories"

    id = Column(String, primary_key=True)
    category_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    image = Column(String, nullable=True)
    is_featured = Column(Boolean, default=False, nullable=False)
    nav_group = Column(String, nullable=False, default="other")
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True)
    product_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    category_id = Column(String, ForeignKey("product_categories.category_id"))
    category_name = Column(String, nullable=True)
    price = Column(Float, default=0)
    buying_price = Column(Float, default=0)
    package = Column(String, nullable=True)
    stocking_unit = Column(String, nullable=True)
    unit = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    images = Column(JSON, default=list)
    description = Column(Text, nullable=True)
    in_stock = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    category = relationship("ProductCategory", back_populates="products", viewonly=True, primaryjoin="Product.category_id==ProductCategory.category_id")


class Quote(Base):
    __tablename__ = "quotes"

    id = Column(String, primary_key=True, index=True)
    quote_number = Column(String, unique=True, index=True, nullable=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=True, index=True)
    ordered_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    ordered_for_branch_id = Column(String, ForeignKey("branches.id"), nullable=True)
    delivery_location_id = Column(String, ForeignKey("delivery_locations.id"), nullable=True)
    delivery_snapshot = Column(JSON, nullable=True)
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
    list_subtotal = Column(Float, default=0)
    delivery_charge = Column(Float, default=0)
    total = Column(Float, default=0)
    include_vat = Column(Boolean, default=True)
    customer_snapshot = Column(JSON, nullable=True)
    quoted_at = Column(DateTime, nullable=True)
    quoted_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    assigned_admin_id = Column(String, ForeignKey("users.id"), nullable=True)
    assigned_sales_user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
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
    quoted_quantity = Column(Integer, nullable=True)
    list_price = Column(Float, nullable=True)
    buying_price = Column(Float, nullable=True)
    unit_price = Column(Float, default=0)
    customer_proposed_price = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    admin_notes = Column(Text, nullable=True)


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
    buying_price = Column(Float, nullable=True)
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
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=True, index=True)
    branch_id = Column(String, ForeignKey("branches.id"), nullable=True)
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
    status = Column(String, default="awaiting_payment")  # awaiting_payment | paid
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
    impact_stats = Column(JSON, nullable=True)
    partners = Column(JSON, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow)
    updated_by = Column(String, nullable=True)


class JobPost(Base):
    __tablename__ = "job_posts"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    department = Column(String, nullable=True)
    location = Column(String, nullable=True)
    employment_type = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    requirements = Column(Text, nullable=True)
    is_published = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    applications = relationship("JobApplication", back_populates="job", cascade="all, delete-orphan")


class JobApplication(Base):
    __tablename__ = "job_applications"

    id = Column(String, primary_key=True)
    job_id = Column(String, ForeignKey("job_posts.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    cover_letter = Column(Text, nullable=True)
    cv_filename = Column(String, nullable=True)
    cv_url = Column(String, nullable=True)
    status = Column(String, default="new")
    created_at = Column(DateTime, default=datetime.utcnow)

    job = relationship("JobPost", back_populates="applications")


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


class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, index=True)
    order_number = Column(String, unique=True, index=True, nullable=False)
    organization_id = Column(String, ForeignKey("organizations.id"), index=True, nullable=False)
    ordered_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    ordered_for_branch_id = Column(String, ForeignKey("branches.id"), nullable=False)
    delivery_location_id = Column(String, ForeignKey("delivery_locations.id"), nullable=True)
    quote_id = Column(String, ForeignKey("quotes.id"), nullable=True)
    assigned_sales_user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    status = Column(String, default="quote_requested")
    delivery_status = Column(String, default="pending")
    delivery_snapshot = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)
    ordered_at = Column(DateTime, default=datetime.utcnow)
    dispatched_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(String, primary_key=True)
    order_id = Column(String, ForeignKey("orders.id"), index=True, nullable=False)
    product_id = Column(String, nullable=True)
    product_name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    quantity = Column(Integer, default=1)
    list_price = Column(Float, nullable=True)
    buying_price = Column(Float, nullable=True)
    unit_price = Column(Float, default=0)
    notes = Column(Text, nullable=True)

    order = relationship("Order", back_populates="items")


class QuoteMessage(Base):
    __tablename__ = "quote_messages"

    id = Column(String, primary_key=True)
    quote_id = Column(String, ForeignKey("quotes.id"), index=True, nullable=False)
    sender_id = Column(String, ForeignKey("users.id"), nullable=True)
    sender_role = Column(String, nullable=False)  # admin | customer
    sender_name = Column(String, nullable=True)
    body = Column(Text, nullable=False)
    attachments = Column(JSON, default=list)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class ActivityEvent(Base):
    __tablename__ = "activity_events"

    id = Column(String, primary_key=True)
    entity_type = Column(String, nullable=False, index=True)  # quote | order | invoice
    entity_id = Column(String, nullable=False, index=True)
    event_type = Column(String, nullable=False)
    actor_id = Column(String, ForeignKey("users.id"), nullable=True)
    actor_name = Column(String, nullable=True)
    actor_role = Column(String, nullable=True)
    summary = Column(Text, nullable=False)
    field_name = Column(String, nullable=True)
    previous_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    is_customer_visible = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class Shipment(Base):
    __tablename__ = "shipments"

    id = Column(String, primary_key=True)
    order_id = Column(String, ForeignKey("orders.id"), index=True, nullable=False)
    status = Column(String, default="processing")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ShipmentItem(Base):
    __tablename__ = "shipment_items"

    id = Column(String, primary_key=True)
    shipment_id = Column(String, ForeignKey("shipments.id"), index=True, nullable=False)
    order_item_id = Column(String, ForeignKey("order_items.id"), nullable=True)
    product_id = Column(String, nullable=True)
    product_name = Column(String, nullable=False)
    quantity = Column(Integer, default=1)


class ChatMessage(Base):
    __tablename__ = "chat_history"

    id = Column(String, primary_key=True)
    session_id = Column(String, index=True, nullable=False)
    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


class SalesAgentCounty(Base):
    __tablename__ = "sales_agent_counties"
    __table_args__ = (UniqueConstraint("user_id", "county", name="uq_sales_agent_county"),)

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    county = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class SalesProspect(Base):
    __tablename__ = "sales_prospects"

    id = Column(String, primary_key=True)
    agent_id = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    organization_id = Column(String, ForeignKey("organizations.id"), index=True, nullable=True)
    facility_name = Column(String, nullable=False)
    facility_name_key = Column(String, index=True, nullable=False)
    facility_type = Column(String, nullable=False, default="other")
    county = Column(String, nullable=False)
    address = Column(Text, nullable=True)
    facility_phone = Column(String, nullable=True)
    facility_email = Column(String, nullable=True)
    contact_name = Column(String, nullable=True)
    contact_title = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    probability = Column(Integer, nullable=True)
    visit_count = Column(Integer, default=0, nullable=False)
    last_visited_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SalesVisit(Base):
    __tablename__ = "sales_visits"

    id = Column(String, primary_key=True)
    prospect_id = Column(String, ForeignKey("sales_prospects.id"), index=True, nullable=False)
    agent_id = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    checked_in_at = Column(DateTime, nullable=False)
    check_in_latitude = Column(Float, nullable=True)
    check_in_longitude = Column(Float, nullable=True)
    check_in_accuracy_m = Column(Float, nullable=True)
    checked_out_at = Column(DateTime, nullable=True)
    check_out_latitude = Column(Float, nullable=True)
    check_out_longitude = Column(Float, nullable=True)
    check_out_accuracy_m = Column(Float, nullable=True)
    facility_name = Column(String, nullable=False)
    facility_type = Column(String, nullable=False, default="other")
    county = Column(String, nullable=False)
    address = Column(Text, nullable=True)
    facility_phone = Column(String, nullable=True)
    facility_email = Column(String, nullable=True)
    contact_name = Column(String, nullable=True)
    contact_title = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    probability = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SalesAgentTarget(Base):
    __tablename__ = "sales_agent_targets"

    user_id = Column(String, ForeignKey("users.id"), primary_key=True)
    monthly_target = Column(Float, nullable=False, default=0)
    commission_band = Column(String, nullable=False, default="standard")
    commission_rate = Column(Float, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SalesWorkday(Base):
    __tablename__ = "sales_workdays"
    __table_args__ = (UniqueConstraint("agent_id", "work_date", name="uq_sales_workday"),)

    id = Column(String, primary_key=True)
    agent_id = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    work_date = Column(Date, nullable=False)
    checked_in_at = Column(DateTime, nullable=False)
    checked_out_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


