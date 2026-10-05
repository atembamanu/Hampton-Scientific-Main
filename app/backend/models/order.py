from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from models.base import AppModel


class OrderItemInput(BaseModel):
    product_id: Optional[str] = None
    product_name: str
    category: Optional[str] = None
    quantity: int = 1
    unit_price: float = 0
    notes: Optional[str] = None


class OrderCreate(BaseModel):
    orderedForBranchId: str
    deliveryLocationId: Optional[str] = None
    deliverySnapshot: Optional[dict] = None
    quoteId: Optional[str] = None
    items: List[OrderItemInput] = Field(default_factory=list)
    notes: Optional[str] = None
    status: str = "quote_requested"


class OrderStatusUpdate(BaseModel):
    status: str


class OrderResponse(AppModel):
    id: str
    orderNumber: str
    organizationId: str
    orderedByUserId: str
    orderedForBranchId: str
    deliveryLocationId: Optional[str] = None
    quoteId: Optional[str] = None
    status: str
    deliverySnapshot: Optional[dict] = None
    notes: Optional[str] = None
    items: List[dict] = Field(default_factory=list)
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None
    orderedByName: Optional[str] = None
    orderedForBranchName: Optional[str] = None
    deliveryLabel: Optional[str] = None
