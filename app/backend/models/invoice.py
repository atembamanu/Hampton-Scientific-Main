from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime

class InvoiceItem(BaseModel):
    """Model for individual invoice items."""
    product_id: str
    product_name: str
    category: str
    quantity: int
    original_price: float
    modified_price: float
    discount_percent: float = 0
    notes: Optional[str] = None

class InvoiceCreate(BaseModel):
    """Model for creating new invoices."""
    quote_id: str
    modified_quote_id: Optional[str] = None
    payment_terms: Optional[int] = 30
    notes: Optional[str] = None

class Invoice(BaseModel):
    """Model for invoice responses."""
    id: Optional[str] = None
    invoice_id: str
    quote_id: str
    modified_quote_id: Optional[str] = None
    user_id: Optional[str] = None
    facility_name: str
    contact_person: str
    email: str
    phone: str
    address: Optional[str] = None
    items: List[InvoiceItem]
    subtotal: float
    discount_amount: float
    tax_rate: float
    tax_amount: float
    total: float
    payment_terms: int
    due_date: datetime
    status: str = "pending"
    notes: Optional[str] = None
    created_by: str
    created_at: datetime
    updated_at: datetime
    sequence: int
    payment_method: Optional[str] = None
    paid_at: Optional[datetime] = None
    paid_by: Optional[str] = None
    marked_paid_by: Optional[str] = None

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }