from pydantic import BaseModel, Field, field_validator, model_validator
from models.base import AppModel
from typing import List, Optional
from datetime import datetime
import uuid

class Product(AppModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    name: str
    price: float
    buying_price: float = 0  # Admin-only supplier cost
    package: str = ""  # e.g., "1*10ml", "1*25T"
    stocking_unit: str = ""  # e.g., "PCs", "Box", "Pack"
    unit: str = ""  # Legacy field, kept for compatibility
    category_id: str
    category_name: str = ""
    in_stock: bool = True
    image_url: Optional[str] = None
    images: List[str] = Field(default_factory=list)
    description: Optional[str] = None
    is_featured: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    @field_validator("package", "stocking_unit", "unit", "category_name", mode="before")
    @classmethod
    def empty_if_none(cls, value):
        return "" if value is None else value

    @field_validator("images", mode="before")
    @classmethod
    def coerce_images(cls, value):
        if not value:
            return []
        if isinstance(value, str):
            return [value] if value.strip() else []
        if isinstance(value, (list, tuple)):
            return [str(item).strip() for item in value if str(item or "").strip()]
        return []

    @model_validator(mode="after")
    def sync_primary_image(self):
        source = list(self.images or [])
        if not source and self.image_url:
            source = [self.image_url]
        urls = []
        seen = set()
        for raw in source:
            url = str(raw or "").strip()
            if not url or url in seen:
                continue
            seen.add(url)
            urls.append(url)
        self.images = urls
        if urls:
            self.image_url = urls[0]
        return self

    class Config:
        from_attributes = True

class ProductCategory(AppModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category_id: str
    name: str
    description: Optional[str] = None
    image: Optional[str] = None
    is_featured: bool = False
    nav_group: str = "other"
    display_order: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True