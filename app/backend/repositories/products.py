from collections.abc import Sequence
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from db.models import Product, ProductCategory


def list_products(db: Session, limit: int = 1000) -> Sequence[Product]:
    return (
        db.query(Product)
        .order_by(Product.created_at.desc())
        .limit(limit)
        .all()
    )


def list_categories(db: Session, limit: int = 100) -> Sequence[ProductCategory]:
    return (
        db.query(ProductCategory)
        .order_by(ProductCategory.display_order.asc())
        .limit(limit)
        .all()
    )


def get_product_by_product_id(db: Session, product_id: str) -> Optional[Product]:
    return (
        db.query(Product)
        .filter(Product.product_id == product_id)
        .one_or_none()
    )


def search_products(db: Session, query: str, limit: int = 50) -> Sequence[Product]:
    pattern = f"%{query}%"
    return (
        db.query(Product)
        .filter(
            or_(
                Product.name.ilike(pattern),
                Product.category_name.ilike(pattern),
            )
        )
        .limit(limit)
        .all()
    )


def count_products(db: Session) -> int:
    return db.query(Product).count()


def get_category_by_category_id(
    db: Session, category_id: str
) -> Optional[ProductCategory]:
    return (
        db.query(ProductCategory)
        .filter(ProductCategory.category_id == category_id)
        .one_or_none()
    )


def get_category_by_id(db: Session, id_: str) -> Optional[ProductCategory]:
    return (
        db.query(ProductCategory)
        .filter(ProductCategory.id == id_)
        .one_or_none()
    )


def count_categories(db: Session) -> int:
    return db.query(ProductCategory).count()

