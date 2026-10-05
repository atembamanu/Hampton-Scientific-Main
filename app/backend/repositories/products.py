import re
import uuid
from collections.abc import Sequence
from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, cast, exists, func, or_
from sqlalchemy.orm import Query, Session

from db.models import Product, ProductCategory
from utils.list_query import csv_values

_NUMERIC_ID = re.compile(r"^\d+$")
_TRAILING_DIGITS = re.compile(r"(\d+)$")


def catalog_sort_direction(sort: Optional[str]) -> Optional[str]:
    """Map a sort query to ascending or descending catalogue-id order."""
    key = (sort or "").strip().lower().replace("-", "_")
    if key in {"id", "id_asc", "product_id", "category_id"}:
        return "asc"
    if key in {"id_desc", "product_id_desc", "category_id_desc"}:
        return "desc"
    return None


def sequential_id_expr(column):
    """Numeric value of a catalogue id so 2 sorts before 10."""
    digits = func.nullif(func.regexp_replace(column, "[^0-9]", "", "g"), "")
    return cast(digits, BigInteger)


def apply_catalog_sort(query: Query, sort: Optional[str], id_column, *default) -> Query:
    direction = catalog_sort_direction(sort)
    if direction == "asc":
        key = sequential_id_expr(id_column)
        return query.order_by(key.asc().nulls_last(), id_column.asc())
    if direction == "desc":
        key = sequential_id_expr(id_column)
        return query.order_by(key.desc().nulls_last(), id_column.desc())
    return query.order_by(*default)


def next_sequential_id(db: Session, model, attr: str) -> str:
    max_n = 0
    for (value,) in db.query(getattr(model, attr)).all():
        text = str(value or "").strip()
        if _NUMERIC_ID.match(text):
            max_n = max(max_n, int(text))
            continue
        match = _TRAILING_DIGITS.search(text)
        if match:
            max_n = max(max_n, int(match.group(1)))
    return str(max_n + 1)


def collect_numeric_ids(db: Session, model, attr: str) -> set[int]:
    used: set[int] = set()
    for (value,) in db.query(getattr(model, attr)).all():
        text = str(value or "").strip()
        if text.isdigit():
            used.add(int(text))
    return used


def plan_import_ids(raw_ids: list[str], existing: set[int]) -> list[str]:
    """Assign a unique numeric id to every imported row.

    Blank ids take the next free number. Ids already in the database, and ids
    explicitly present anywhere in the file, are kept for those rows so a later
    blank cannot reuse them before they are inserted.
    """
    used = set(existing)
    for raw in raw_ids:
        text = str(raw or "").strip()
        if text.isdigit():
            used.add(int(text))
    planned: list[str] = []
    for raw in raw_ids:
        text = str(raw or "").strip()
        if text.isdigit():
            planned.append(text)
            continue
        number = 1
        while number in used:
            number += 1
        used.add(number)
        planned.append(str(number))
    return planned


def query_products(
    db: Session,
    *,
    search: Optional[str] = None,
    category_id: Optional[str] = None,
    in_stock: Optional[bool] = None,
) -> Query:
    q = db.query(Product)
    if search:
        like = f"%{search.strip()}%"
        q = q.filter(
            or_(
                Product.name.ilike(like),
                Product.product_id.ilike(like),
                Product.category_name.ilike(like),
                Product.package.ilike(like),
            )
        )
    category_ids = csv_values(category_id)
    if category_ids:
        q = q.filter(Product.category_id.in_(category_ids))
    if in_stock is True:
        q = q.filter(Product.in_stock.is_(True))
    elif in_stock is False:
        q = q.filter(Product.in_stock.is_(False))
    return q


def list_products(db: Session, limit: int = 5000) -> Sequence[Product]:
    return (
        db.query(Product)
        .order_by(Product.created_at.desc())
        .limit(limit)
        .all()
    )


def query_categories(
    db: Session,
    *,
    search: Optional[str] = None,
    has_products: Optional[bool] = None,
) -> Query:
    q = db.query(ProductCategory)
    if search:
        like = f"%{search.strip()}%"
        q = q.filter(
            or_(
                ProductCategory.name.ilike(like),
                ProductCategory.category_id.ilike(like),
                ProductCategory.description.ilike(like),
            )
        )
    if has_products is True:
        q = q.filter(exists().where(Product.category_id == ProductCategory.category_id))
    elif has_products is False:
        q = q.filter(~exists().where(Product.category_id == ProductCategory.category_id))
    return q


def list_categories(db: Session, limit: int = 1000) -> Sequence[ProductCategory]:
    return (
        db.query(ProductCategory)
        .order_by(ProductCategory.display_order.asc(), ProductCategory.name.asc())
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


def get_category_by_name(db: Session, name: str) -> Optional[ProductCategory]:
    return (
        db.query(ProductCategory)
        .filter(ProductCategory.name.ilike(name.strip()))
        .first()
    )


def get_category_by_id(db: Session, id_: str) -> Optional[ProductCategory]:
    return (
        db.query(ProductCategory)
        .filter(ProductCategory.id == id_)
        .one_or_none()
    )


def count_categories(db: Session) -> int:
    return db.query(ProductCategory).count()


def normalize_image_urls(images=None, image_url=None) -> list[str]:
    """Ordered unique gallery URLs. First entry is the primary / table thumbnail."""
    urls: list[str] = []
    seen: set[str] = set()

    def add(value) -> None:
        url = str(value or "").strip()
        if not url or url in seen:
            return
        seen.add(url)
        urls.append(url)

    if isinstance(images, str):
        add(images)
    elif isinstance(images, (list, tuple)):
        for item in images:
            add(item)
    add(image_url)
    return urls[:12]


def resolve_product_images(payload: dict, existing=None) -> list[str]:
    existing_urls = normalize_image_urls(
        getattr(existing, "images", None) if existing is not None else None,
        getattr(existing, "image_url", None) if existing is not None else None,
    )
    if "images" in payload:
        return normalize_image_urls(payload.get("images"), None)
    if "image_url" in payload:
        primary = str(payload.get("image_url") or "").strip()
        rest = [url for url in existing_urls if url != primary]
        return ([primary] + rest) if primary else rest
    return existing_urls


def apply_product_images(row, images=None, image_url=None) -> list[str]:
    urls = normalize_image_urls(images, image_url)
    row.images = urls
    row.image_url = urls[0] if urls else None
    return urls


def create_catalog_product(
    db: Session,
    *,
    name: str,
    category_id: str,
    price: float = 0,
    buying_price: float = 0,
    package: str = "",
    stocking_unit: str = "",
    description: Optional[str] = None,
    in_stock: bool = True,
) -> Product:
    category = get_category_by_category_id(db, category_id)
    if not category:
        raise ValueError("Select a category")
    now = datetime.utcnow()
    gallery = normalize_image_urls(None, category.image)
    row = Product(
        id=str(uuid.uuid4()),
        product_id=next_sequential_id(db, Product, "product_id"),
        name=name.strip(),
        price=float(price or 0),
        buying_price=float(buying_price or 0),
        package=package or "",
        stocking_unit=stocking_unit or "",
        unit="",
        category_id=category.category_id,
        category_name=category.name,
        description=description or None,
        image_url=gallery[0] if gallery else None,
        images=gallery,
        in_stock=bool(in_stock),
        is_featured=False,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

