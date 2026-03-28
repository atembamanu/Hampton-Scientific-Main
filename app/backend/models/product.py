from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    name: str
    price: float
    package: str = ""  # e.g., "1*10ml", "1*25T"
    stocking_unit: str = ""  # e.g., "PCs", "Box", "Pack"
    unit: str = ""  # Legacy field, kept for compatibility
    category_id: str
    category_name: str
    in_stock: bool = True
    image_url: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True

class ProductCategory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category_id: str
    name: str
    description: str = ""
    image: Optional[str] = None
    display_order: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True