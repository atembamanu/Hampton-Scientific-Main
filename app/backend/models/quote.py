from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime
import uuid

class QuoteItem(BaseModel):
    product_id: str
    product_name: str
    category: str
    quantity: int
    unit_price: Optional[float] = None  # Admin-set price (hidden from customers initially)
    customer_proposed_price: Optional[float] = None  # Customer's counter-offer
    notes: Optional[str] = None

class ModifiedQuoteItem(BaseModel):
    """Quote item with admin-modified pricing"""
    product_id: str
    product_name: str
    category: str
    quantity: int
    original_price: Optional[float] = None
    modified_price: Optional[float] = None
    customer_proposed_price: Optional[float] = None  # Customer's counter-offer
    discount_percent: Optional[float] = None
    notes: Optional[str] = None

class QuoteRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    quote_number: Optional[str] = None
    user_id: Optional[str] = None
    facility_name: str
    contact_person: str
    email: EmailStr
    phone: str
    address: Optional[str] = None
    items: List[QuoteItem]
    additional_notes: Optional[str] = None
    status: str = "pending"  # pending, quoted, approved, invoiced
    customer_response: Optional[str] = None  # accepted, negotiating
    customer_notes: Optional[str] = None
    current_handler: str = "ADMIN_REVIEW"  # ADMIN_REVIEW, CUSTOMER_REVIEW, LOCKED_APPROVED
    discount_amount: float = 0
    tax_rate: float = 16
    tax_amount: float = 0
    subtotal: float = 0
    total: float = 0
    include_vat: bool = True
    validity_days: int = 30
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class QuoteRevision(BaseModel):
    """Snapshot of a quote when prices change"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    quote_id: str
    revised_by: str  # "admin" or "customer"
    revised_by_id: Optional[str] = None
    item_prices: List[dict]  # snapshot of items with prices
    discount_amount: float = 0
    tax_rate: float = 0
    subtotal: float = 0
    total: float = 0
    notes: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ModifiedQuote(BaseModel):
    """Admin-modified version of a quote"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    original_quote_id: str
    user_id: Optional[str] = None
    facility_name: str
    contact_person: str
    email: EmailStr
    phone: str
    address: Optional[str] = None
    items: List[ModifiedQuoteItem]
    subtotal: float
    discount_amount: float = 0
    tax_rate: float = 0  # e.g., 16 for 16%
    tax_amount: float = 0
    total: float
    validity_days: int = 30
    terms_and_conditions: Optional[str] = None
    notes: Optional[str] = None
    modified_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Invoice(BaseModel):
    """Invoice generated from approved quote"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str
    quote_id: str
    modified_quote_id: Optional[str] = None
    user_id: Optional[str] = None
    facility_name: str
    contact_person: str
    email: EmailStr
    phone: str
    address: Optional[str] = None
    items: List[ModifiedQuoteItem]
    subtotal: float
    discount_amount: float = 0
    tax_rate: float = 0
    tax_amount: float = 0
    total: float
    payment_terms: str = "Net 30"
    due_date: Optional[datetime] = None
    status: str = "unpaid"  # unpaid, paid, overdue, cancelled
    notes: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    paid_at: Optional[datetime] = None

class QuoteRequestCreate(BaseModel):
    facility_name: str
    contact_person: str
    email: EmailStr
    phone: str
    address: Optional[str] = None
    items: List[QuoteItem]
    additional_notes: Optional[str] = None

class ModifiedQuoteCreate(BaseModel):
    """Create modified quote from original - original_quote_id comes from URL path"""
    facility_name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    items: List[ModifiedQuoteItem]
    discount_amount: float = 0
    tax_rate: float = 0
    include_vat: bool = True
    validity_days: int = 30
    terms_and_conditions: Optional[str] = None
    notes: Optional[str] = None

class CustomerQuoteResponse(BaseModel):
    """Customer's response to a quoted price"""
    response: str  # accepted, negotiating
    items: Optional[List[dict]] = None  # Items with customer_proposed_price
    notes: Optional[str] = None
    discount_amount: Optional[float] = None  # Customer can propose discount

class InvoiceCreate(BaseModel):
    """Create invoice from quote"""
    quote_id: str
    modified_quote_id: Optional[str] = None
    payment_terms: str = "Net 30"
    due_days: int = 30
    notes: Optional[str] = None
