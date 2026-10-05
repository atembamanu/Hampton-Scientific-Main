from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from typing import List, Optional
from pathlib import Path
from datetime import datetime
from io import StringIO
import csv
import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy import func

from models.user import UserResponse, UserUpdate, CompanyStaffCreate
from models.product import Product
from models.quote import ModifiedQuoteCreate, ModifiedQuote
from utils.auth import get_password_hash
from utils.permissions import can_see_buying_price, require_company_permission
from utils.logger import logger
from utils.list_query import clamp_page, paginated_payload
from utils.app_time import format_app, serialize_datetime
from deps import get_db
from repositories import users as users_repo
from repositories import products as products_repo
from db.models import Quote as QuoteModel, QuoteItem as QuoteItemModel, Invoice as InvoiceModel, InvoiceItem as InvoiceItemModel
from db.models import Product as ProductRow, ProductCategory as CategoryRow
from db.models import (
    Organization,
    SalesAgentCounty,
    SalesAgentTarget,
    SalesProspect,
    SalesVisit,
    SalesWorkday,
)
from utils.nav_groups import normalize_nav_group
from utils.sales_performance import DEFAULT_COMMISSION_RATE, resolve_commission_rate

router = APIRouter()

require_catalogue = require_company_permission("catalogue")
require_company_users = require_company_permission("company_users")
require_settings = require_company_permission("settings")

# Directory for product image uploads (reuse original path)
UPLOAD_DIR = Path(__file__).parent / "uploads" / "products"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _csv_dt(value) -> str:
    """Company-zone timestamp for CSV exports (YYYY-MM-DD HH:MM:SS)."""
    if not value:
        return ""
    if isinstance(value, datetime):
        return format_app(value, "%Y-%m-%d %H:%M:%S")
    text = str(value).replace("T", " ")
    return text[:19]


def _csv_response(content: str, filename: str) -> StreamingResponse:
    return StreamingResponse(
        iter([content]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _read_csv_upload(file: UploadFile) -> list[dict]:
    raw = file.file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
    reader = csv.DictReader(StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file is missing a header row")
    rows = []
    for row in reader:
        cleaned = {(k or "").strip().lower().replace(" ", "_"): (v or "").strip() for k, v in row.items()}
        if any(cleaned.values()):
            rows.append(cleaned)
    return rows


def _truthy(value) -> bool:
    return str(value or "").strip().lower() in ("1", "true", "yes", "y", "in stock")


def _serialize_admin_category(row, product_count: int = 0) -> dict:
    return {
        "id": row.id,
        "category_id": row.category_id,
        "name": row.name,
        "description": row.description or "",
        "image": row.image,
        "is_featured": bool(getattr(row, "is_featured", False)),
        "nav_group": getattr(row, "nav_group", None) or "other",
        "product_count": product_count,
        "created_at": row.created_at,
        "updated_at": getattr(row, "updated_at", None) or row.created_at,
    }


def _category_counts(db: Session) -> dict:
    return dict(
        db.query(ProductRow.category_id, func.count(ProductRow.id))
        .group_by(ProductRow.category_id)
        .all()
    )

# ============================================
# Admin User Management Routes
# ============================================

def _staff_sales_profile(db: Session, user_ids: list[str]) -> dict:
    profile = {
        user_id: {"monthlyTarget": 0, "commissionRate": DEFAULT_COMMISSION_RATE, "counties": []}
        for user_id in user_ids
    }
    if not user_ids:
        return profile
    for row in db.query(SalesAgentTarget).filter(SalesAgentTarget.user_id.in_(user_ids)).all():
        profile[row.user_id]["monthlyTarget"] = float(row.monthly_target or 0)
        profile[row.user_id]["commissionRate"] = resolve_commission_rate(row)
    for row in db.query(SalesAgentCounty).filter(SalesAgentCounty.user_id.in_(user_ids)).order_by(SalesAgentCounty.county.asc()).all():
        profile[row.user_id]["counties"].append(row.county)
    return profile


def _serialize_staff(u, sales_profile: Optional[dict] = None) -> dict:
    sales = u.role == "sales"
    extra = (sales_profile or {}).get(u.id, {})
    return {
        "id": u.id,
        "firstName": u.first_name,
        "lastName": u.last_name,
        "email": u.email,
        "phone": u.phone or "",
        "role": u.role,
        "can_login": bool(u.can_login),
        "created_at": u.created_at,
        "monthlyTarget": extra.get("monthlyTarget", 0) if sales else None,
        "commissionRate": extra.get("commissionRate") if sales else None,
        "counties": extra.get("counties", []) if sales else [],
    }


@router.get("/users")
@router.get("/company-staff")
async def list_company_staff(
    current_user: UserResponse = Depends(require_company_users),
    db: Session = Depends(get_db),
):
    """List Hampton company staff (Global Admin only)."""
    users = users_repo.list_company_staff(db)
    profile = _staff_sales_profile(db, [u.id for u in users if u.role == "sales"])
    return {"users": [_serialize_staff(u, profile) for u in users], "total": len(users)}


@router.post("/users")
@router.post("/company-staff")
async def create_company_staff(
    user_data: CompanyStaffCreate,
    current_user: UserResponse = Depends(require_company_users),
    db: Session = Depends(get_db),
):
    """Create Sales, Operations, or Global Admin staff."""
    if user_data.role not in ("admin", "operations", "sales"):
        raise HTTPException(status_code=400, detail="Invalid company role")
    if not user_data.password or len(user_data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    existing_user = users_repo.get_user_by_email(db, user_data.email.lower())
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    now = datetime.utcnow()
    from db.models import User as UserModel

    user_row = UserModel(
        id=str(uuid.uuid4()),
        first_name=user_data.firstName,
        last_name=user_data.lastName,
        email=user_data.email.lower(),
        phone=user_data.phone or "",
        hashed_password=get_password_hash(user_data.password),
        facility_name="Hampton Scientific",
        facility_type="company",
        address="",
        city="",
        postal_code="",
        role=user_data.role,
        can_login=True,
        organization_id=None,
        created_at=now,
        updated_at=now,
    )
    db.add(user_row)
    db.commit()
    logger.info(f"Company staff created by {current_user.email}: {user_data.email} ({user_data.role})")
    return {"user": _serialize_staff(user_row), "message": "Staff member created"}


# ============================================
# Admin Product Management Routes
# ============================================

@router.get("/categories")
async def list_categories_admin(
    search: Optional[str] = None,
    has_products: Optional[bool] = None,
    for_select: bool = False,
    sort: Optional[str] = None,
    page: Optional[int] = None,
    limit: int = 20,
    current_user: UserResponse = Depends(require_catalogue),
    db: Session = Depends(get_db),
):
    q = products_repo.query_categories(db, search=search, has_products=has_products)
    if for_select:
        rows = q.order_by(CategoryRow.name.asc()).all()
        return [{"category_id": r.category_id, "name": r.name} for r in rows]
    if page is None:
        rows = products_repo.apply_catalog_sort(q, sort, CategoryRow.category_id, CategoryRow.name.asc()).all()
        counts = _category_counts(db)
        return [_serialize_admin_category(r, counts.get(r.category_id, 0)) for r in rows]
    page_n, limit_n, skip = clamp_page(page, limit)
    total = q.count()
    rows = products_repo.apply_catalog_sort(
        q, sort, CategoryRow.category_id, CategoryRow.name.asc()
    ).offset(skip).limit(limit_n).all()
    counts = _category_counts(db)
    return paginated_payload(
        [_serialize_admin_category(r, counts.get(r.category_id, 0)) for r in rows],
        total,
        page_n,
        limit_n,
    )


@router.get("/categories/export")
async def export_categories_admin(
    search: Optional[str] = None,
    has_products: Optional[bool] = None,
    current_user: UserResponse = Depends(require_catalogue),
    db: Session = Depends(get_db),
):
    rows = products_repo.query_categories(db, search=search, has_products=has_products).order_by(CategoryRow.name.asc()).all()
    counts = _category_counts(db)
    buf = StringIO()
    writer = csv.DictWriter(buf, fieldnames=["category_id", "name", "description", "nav_group", "product_count", "Created Date Time", "Modified Date Time"])
    writer.writeheader()
    for row in rows:
        writer.writerow({
            "category_id": row.category_id,
            "name": row.name,
            "description": row.description or "",
            "nav_group": getattr(row, "nav_group", None) or "other",
            "product_count": counts.get(row.category_id, 0),
            "Created Date Time": _csv_dt(row.created_at),
            "Modified Date Time": _csv_dt(getattr(row, "updated_at", None)),
        })
    return _csv_response(buf.getvalue(), "categories.csv")


@router.post("/categories/import")
async def import_categories_admin(
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(require_catalogue),
    db: Session = Depends(get_db),
):
    rows = _read_csv_upload(file)
    created = 0
    updated = 0
    for row in rows:
        name = row.get("name")
        if not name:
            continue
        category_id = row.get("category_id") or ""
        existing = None
        if category_id:
            existing = products_repo.get_category_by_category_id(db, category_id)
        if not existing:
            existing = products_repo.get_category_by_name(db, name)
        if existing:
            existing.name = name
            if "description" in row:
                existing.description = row.get("description") or existing.description
            if "nav_group" in row:
                group = normalize_nav_group(row.get("nav_group"))
                if group:
                    existing.nav_group = group
            existing.updated_at = datetime.utcnow()
            updated += 1
            continue
        next_seq = products_repo.next_sequential_id(db, CategoryRow, "category_id")
        imported_group = normalize_nav_group(row.get("nav_group")) if "nav_group" in row else None
        db.add(CategoryRow(
            id=str(uuid.uuid4()),
            category_id=category_id if str(category_id).isdigit() else next_seq,
            name=name,
            description=row.get("description") or None,
            nav_group=imported_group or "other",
            display_order=0,
        ))
        created += 1
    db.commit()
    return {"created": created, "updated": updated, "total": created + updated}


@router.post("/categories")
async def create_category_admin(
    category: dict,
    current_user: UserResponse = Depends(require_catalogue),
    db: Session = Depends(get_db),
):
    """Create a product category (admin only)."""
    from db.models import ProductCategory as CategoryModel

    next_seq = products_repo.next_sequential_id(db, CategoryModel, "category_id")
    category_id = next_seq

    nav_group = normalize_nav_group(category.get("nav_group"))
    if not nav_group:
        raise HTTPException(status_code=400, detail="Choose a menu group")

    now = datetime.utcnow()
    row = CategoryModel(
        id=str(uuid.uuid4()),
        category_id=category_id,
        name=category["name"],
        description=category.get("description"),
        image=category.get("image"),
        is_featured=bool(category.get("is_featured")),
        nav_group=nav_group,
        display_order=0,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return {"category": row}


@router.put("/categories/{category_id}")
async def update_category_admin(
    category_id: str,
    category: dict,
    current_user: UserResponse = Depends(require_catalogue),
    db: Session = Depends(get_db),
):
    """Update a product category (admin only)."""
    row = products_repo.get_category_by_category_id(db, category_id)
    if not row:
        raise HTTPException(status_code=404, detail="Category not found")

    update_fields = {k: v for k, v in category.items() if v is not None and k not in ("id", "category_id", "display_order", "created_at", "updated_at")}
    if "nav_group" in update_fields:
        nav_group = normalize_nav_group(update_fields.get("nav_group"))
        if not nav_group:
            raise HTTPException(status_code=400, detail="Choose a menu group")
        update_fields["nav_group"] = nav_group
    for key, value in update_fields.items():
        setattr(row, key, value)
    row.updated_at = datetime.utcnow()

    db.add(row)
    db.commit()
    db.refresh(row)

    return {"category": row}


@router.patch("/categories/{category_id}/featured")
async def set_category_featured(
    category_id: str,
    body: dict,
    current_user: UserResponse = Depends(require_catalogue),
    db: Session = Depends(get_db),
):
    """Mark or unmark a category as featured for the public site."""
    row = products_repo.get_category_by_category_id(db, category_id)
    if not row:
        raise HTTPException(status_code=404, detail="Category not found")
    row.is_featured = bool(body.get("is_featured"))
    row.updated_at = datetime.utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
    counts = _category_counts(db)
    return {"category": _serialize_admin_category(row, counts.get(row.category_id, 0))}


@router.delete("/categories")
async def delete_all_categories_admin(
    current_user: UserResponse = Depends(require_catalogue),
    db: Session = Depends(get_db),
):
    """Delete every catalogue category. Refused while any category still has products."""
    linked = (
        db.query(ProductRow.id)
        .join(CategoryRow, ProductRow.category_id == CategoryRow.category_id)
        .first()
    )
    if linked:
        raise HTTPException(
            status_code=409,
            detail="Delete all products before deleting categories. Categories that still have products cannot be removed.",
        )
    try:
        deleted = db.query(CategoryRow).delete(synchronize_session=False)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Delete all products before deleting categories. Categories that still have products cannot be removed.",
        )
    logger.info(f"All categories deleted by {current_user.email}: {deleted}")
    return {"deleted": deleted, "message": "Categories deleted"}


@router.delete("/categories/{category_id}")
async def delete_category_admin(
    category_id: str,
    current_user: UserResponse = Depends(require_catalogue),
    db: Session = Depends(get_db),
):
    """Delete a product category (admin only)."""
    row = products_repo.get_category_by_category_id(db, category_id)
    if not row:
        raise HTTPException(status_code=404, detail="Category not found")

    db.delete(row)
    db.commit()

    return {"message": "Category deleted"}


def _serialize_admin_product(row) -> dict:
    images = products_repo.normalize_image_urls(getattr(row, "images", None), row.image_url)
    return {
        "id": row.id,
        "product_id": row.product_id,
        "name": row.name,
        "price": float(row.price or 0),
        "buying_price": float(getattr(row, "buying_price", 0) or 0),
        "package": row.package or "",
        "stocking_unit": row.stocking_unit or "",
        "unit": row.unit or "",
        "category_id": row.category_id,
        "category_name": row.category_name or "",
        "in_stock": bool(row.in_stock),
        "is_featured": bool(getattr(row, "is_featured", False)),
        "image_url": images[0] if images else row.image_url,
        "images": images,
        "description": row.description,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


@router.get("/products")
async def list_products_admin(
    search: Optional[str] = None,
    category_id: Optional[str] = None,
    in_stock: Optional[bool] = None,
    sort: Optional[str] = None,
    page: Optional[int] = None,
    limit: int = 20,
    current_user: UserResponse = Depends(require_catalogue),
    db: Session = Depends(get_db),
):
    """List products. Omit page to return a full array (quote workspace)."""
    q = products_repo.query_products(db, search=search, category_id=category_id, in_stock=in_stock)
    if page is None:
        rows = products_repo.apply_catalog_sort(
            q, sort, ProductRow.product_id, ProductRow.created_at.desc()
        ).limit(2000).all()
        return [_serialize_admin_product(r) for r in rows]
    page_n, limit_n, skip = clamp_page(page, limit)
    total = q.count()
    rows = products_repo.apply_catalog_sort(
        q, sort, ProductRow.product_id, ProductRow.created_at.desc()
    ).offset(skip).limit(limit_n).all()
    return paginated_payload([_serialize_admin_product(r) for r in rows], total, page_n, limit_n)


@router.get("/products/export")
async def export_products_admin(
    search: Optional[str] = None,
    category_id: Optional[str] = None,
    in_stock: Optional[bool] = None,
    current_user: UserResponse = Depends(require_catalogue),
    db: Session = Depends(get_db),
):
    rows = products_repo.query_products(
        db, search=search, category_id=category_id, in_stock=in_stock
    ).order_by(ProductRow.name.asc()).all()
    show_buying = can_see_buying_price(current_user.role)
    fields = ["product_id", "name", "category_id", "category_name", "price"]
    if show_buying:
        fields.append("buying_price")
    fields.extend(["package", "stocking_unit", "in_stock", "description", "image_url", "Created Date Time", "Modified Date Time"])
    buf = StringIO()
    writer = csv.DictWriter(buf, fieldnames=fields)
    writer.writeheader()
    for row in rows:
        item = {
            "product_id": row.product_id,
            "name": row.name,
            "category_id": row.category_id or "",
            "category_name": row.category_name or "",
            "price": row.price or 0,
            "package": row.package or "",
            "stocking_unit": row.stocking_unit or "",
            "in_stock": "true" if row.in_stock else "false",
            "description": row.description or "",
            "image_url": row.image_url or "",
            "Created Date Time": _csv_dt(row.created_at),
            "Modified Date Time": _csv_dt(row.updated_at),
        }
        if show_buying:
            item["buying_price"] = getattr(row, "buying_price", 0) or 0
        writer.writerow(item)
    return _csv_response(buf.getvalue(), "products.csv")


@router.post("/products/import")
async def import_products_admin(
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(require_catalogue),
    db: Session = Depends(get_db),
):
    rows = _read_csv_upload(file)
    created = 0
    updated = 0
    errors = []
    show_buying = can_see_buying_price(current_user.role)
    planned_ids = products_repo.plan_import_ids(
        [row.get("product_id") or "" for row in rows],
        products_repo.collect_numeric_ids(db, ProductRow, "product_id"),
    )
    for index, (row, assigned_id) in enumerate(zip(rows, planned_ids), start=2):
        name = row.get("name")
        if not name:
            errors.append(f"Row {index}: name is required")
            continue
        category_id = row.get("category_id") or ""
        category_name = row.get("category_name") or ""
        category_row = None
        if category_id:
            category_row = products_repo.get_category_by_category_id(db, category_id)
        if not category_row and category_name:
            category_row = products_repo.get_category_by_name(db, category_name)
        if not category_row:
            errors.append(f"Row {index}: unknown category")
            continue
        product_id = row.get("product_id") or ""
        existing = products_repo.get_product_by_product_id(db, product_id) if product_id else None
        try:
            price = float(row.get("price") or 0)
        except ValueError:
            errors.append(f"Row {index}: invalid price")
            continue
        buying_price = None
        if show_buying and row.get("buying_price") not in (None, ""):
            try:
                buying_price = float(row.get("buying_price") or 0)
            except ValueError:
                errors.append(f"Row {index}: invalid buying_price")
                continue
        in_stock = True if "in_stock" not in row else _truthy(row.get("in_stock"))
        now = datetime.utcnow()
        if existing:
            existing.name = name
            existing.price = price
            if buying_price is not None:
                existing.buying_price = buying_price
            existing.package = row.get("package") or existing.package
            existing.stocking_unit = row.get("stocking_unit") or existing.stocking_unit
            existing.category_id = category_row.category_id
            existing.category_name = category_row.name
            if "description" in row:
                existing.description = row.get("description") or None
            existing.in_stock = in_stock
            existing.updated_at = now
            updated += 1
            continue
        db.add(ProductRow(
            id=str(uuid.uuid4()),
            product_id=assigned_id,
            name=name,
            price=price,
            buying_price=buying_price or 0,
            package=row.get("package") or "",
            stocking_unit=row.get("stocking_unit") or "",
            unit="",
            category_id=category_row.category_id,
            category_name=category_row.name,
            description=row.get("description") or None,
            in_stock=in_stock,
            created_at=now,
            updated_at=now,
        ))
        created += 1
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Import stopped because two products resolved to the same product ID.",
        )
    return {"created": created, "updated": updated, "total": created + updated, "errors": errors}


@router.post("/products")
async def create_product_admin(
    product_data: dict,
    current_user: UserResponse = Depends(require_catalogue),
    db: Session = Depends(get_db),
):
    """Create a new product - Admin only."""
    from db.models import Product as ProductModel

    now = datetime.utcnow()
    product_id = products_repo.next_sequential_id(db, ProductModel, "product_id")

    category_id = product_data["category_id"]
    category_row = products_repo.get_category_by_category_id(db, category_id)

    category_name = product_data.get("category_name") or (category_row.name if category_row else "")
    gallery = products_repo.normalize_image_urls(
        product_data.get("images"),
        product_data.get("image_url") or (category_row.image if category_row else None),
    )

    product_row = ProductModel(
        id=str(uuid.uuid4()),
        product_id=product_id,
        name=product_data["name"],
        price=product_data.get("price", 0),
        buying_price=float(product_data.get("buying_price", 0) or 0),
        package=product_data.get("package", ""),
        stocking_unit=product_data.get("stocking_unit", ""),
        unit=product_data.get("unit", ""),
        category_id=category_id,
        category_name=category_name,
        description=product_data.get("description"),
        image_url=gallery[0] if gallery else None,
        images=gallery,
        in_stock=product_data.get("in_stock", True),
        is_featured=bool(product_data.get("is_featured")),
        created_at=now,
        updated_at=now,
    )

    db.add(product_row)
    db.commit()

    logger.info(f"Product created by admin {current_user.email}: {product_row.name}")

    product_response = Product.from_orm(product_row)

    return {
        "message": "Product created successfully",
        "product_id": product_row.product_id,
        "product": product_response,
    }


@router.put("/products/{product_id}")
async def update_product_admin(
    product_id: str,
    product_data: dict,
    current_user: UserResponse = Depends(require_catalogue),
    db: Session = Depends(get_db),
):
    """Update product details - Admin only."""
    product_row = products_repo.get_product_by_product_id(db, product_id)
    if not product_row:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = {
        k: v
        for k, v in product_data.items()
        if v is not None and k not in ("id", "product_id", "images", "image_url")
    }
    if update_data.get("category_id"):
        category_row = products_repo.get_category_by_category_id(db, update_data["category_id"])
        if category_row:
            update_data["category_name"] = category_row.name
    update_data["updated_at"] = datetime.utcnow()

    for key, value in update_data.items():
        setattr(product_row, key, value)

    if "images" in product_data or "image_url" in product_data:
        products_repo.apply_product_images(
            product_row,
            products_repo.resolve_product_images(product_data, product_row),
        )

    db.add(product_row)
    db.commit()

    return {"message": "Product updated successfully"}


@router.patch("/products/{product_id}/featured")
async def set_product_featured(
    product_id: str,
    body: dict,
    current_user: UserResponse = Depends(require_catalogue),
    db: Session = Depends(get_db),
):
    """Mark or unmark a product as featured for the public homepage."""
    product_row = products_repo.get_product_by_product_id(db, product_id)
    if not product_row:
        raise HTTPException(status_code=404, detail="Product not found")
    product_row.is_featured = bool(body.get("is_featured"))
    product_row.updated_at = datetime.utcnow()
    db.add(product_row)
    db.commit()
    db.refresh(product_row)
    return {"product": _serialize_admin_product(product_row)}


@router.delete("/products")
async def delete_all_products_admin(
    current_user: UserResponse = Depends(require_catalogue),
    db: Session = Depends(get_db),
):
    """Delete every catalogue product. Existing quotes are left unchanged."""
    deleted = db.query(ProductRow).delete(synchronize_session=False)
    db.commit()
    logger.info(f"All products deleted by {current_user.email}: {deleted}")
    return {"deleted": deleted, "message": "Products deleted"}


@router.delete("/products/{product_id}")
async def delete_product_admin(
    product_id: str,
    current_user: UserResponse = Depends(require_catalogue),
    db: Session = Depends(get_db),
):
    """Delete a product - Admin only."""
    product_row = products_repo.get_product_by_product_id(db, product_id)
    if not product_row:
        raise HTTPException(status_code=404, detail="Product not found")

    db.delete(product_row)
    db.commit()

    return {"message": "Product deleted successfully"}


@router.post("/products/upload-image")
async def upload_product_image(
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(require_catalogue)
):
    """Upload a product image - Admin only."""
    import uuid

    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, WebP, GIF")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB")

    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    unique_filename = f"{uuid.uuid4()}.{ext}"
    file_path = UPLOAD_DIR / unique_filename

    with open(file_path, "wb") as f:
        f.write(content)

    image_url = f"/images/products/{unique_filename}"
    logger.info(f"Product image uploaded by {current_user.email}: {unique_filename}")

    return {"image_url": image_url, "filename": unique_filename}


@router.post("/products/with-image")
async def create_product_with_image(
    name: str = Form(...),
    category_id: str = Form(...),
    price: float = Form(0),
    buying_price: float = Form(0),
    package: str = Form(""),
    stocking_unit: str = Form(""),
    description: str = Form(""),
    in_stock: bool = Form(True),
    image_url: str = Form(""),
    image: UploadFile = File(None),
    current_user: UserResponse = Depends(require_catalogue),
    db: Session = Depends(get_db),
):
    """Create a new product with optional image upload - Admin only."""
    import uuid as uuid_module
    from datetime import datetime

    final_image_url = image_url

    if image and image.filename:
        allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
        if image.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, WebP, GIF")

        content = await image.read()
        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB")

        ext = image.filename.split(".")[-1] if "." in image.filename else "jpg"
        unique_filename = f"{uuid_module.uuid4()}.{ext}"
        file_path = UPLOAD_DIR / unique_filename

        with open(file_path, "wb") as f:
            f.write(content)

        final_image_url = f"/images/products/{unique_filename}"
        logger.info(f"Product image uploaded by {current_user.email}: {unique_filename}")

    from db.models import Product as ProductModel

    now = datetime.utcnow()
    product_id = products_repo.next_sequential_id(db, ProductModel, "product_id")

    category_row = products_repo.get_category_by_category_id(db, category_id)
    category_name = category_row.name if category_row else ""
    if category_row and not final_image_url:
        final_image_url = category_row.image or final_image_url
    gallery = products_repo.normalize_image_urls(None, final_image_url)

    product_row = ProductModel(
        id=str(uuid_module.uuid4()),
        product_id=product_id,
        name=name,
        price=price,
        buying_price=float(buying_price or 0),
        package=package,
        stocking_unit=stocking_unit,
        unit="",
        category_id=category_id,
        category_name=category_name,
        description=description,
        image_url=gallery[0] if gallery else None,
        images=gallery,
        in_stock=in_stock,
        created_at=now,
        updated_at=now,
    )

    db.add(product_row)
    db.commit()

    logger.info(f"Product created by admin {current_user.email}: {product_row.name}")

    product_response = Product.from_orm(product_row)

    return {
        "message": "Product created successfully",
        "product_id": product_row.product_id,
        "product": product_response,
    }

@router.put("/users/{user_id}")
@router.put("/company-staff/{user_id}")
async def update_company_staff(
    user_id: str,
    user_update: UserUpdate,
    current_user: UserResponse = Depends(require_company_users),
    db: Session = Depends(get_db),
):
    """Update company staff (role, password, details)."""
    user_row = users_repo.get_user_by_id(db, user_id)
    if not user_row or user_row.organization_id or user_row.role not in ("admin", "operations", "sales"):
        raise HTTPException(status_code=404, detail="Company staff member not found")

    update_data = user_update.dict(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        if len(update_data["password"]) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        user_row.hashed_password = get_password_hash(update_data.pop("password"))
    else:
        update_data.pop("password", None)

    new_role = update_data.get("role")
    if new_role and new_role not in ("admin", "operations", "sales"):
        raise HTTPException(status_code=400, detail="Invalid company role")

    if user_id == current_user.id:
        if new_role and new_role != "admin":
            raise HTTPException(status_code=400, detail="You cannot change your own role")
        if update_data.get("can_login") is False:
            raise HTTPException(status_code=400, detail="You cannot deactivate your own account")

    if (new_role and new_role != "admin" and user_row.role == "admin") or (
        update_data.get("can_login") is False and user_row.role == "admin"
    ):
        if users_repo.count_company_admins(db) <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the last Global Admin")

    if "firstName" in update_data:
        user_row.first_name = update_data["firstName"]
    if "lastName" in update_data:
        user_row.last_name = update_data["lastName"]
    if "phone" in update_data:
        user_row.phone = update_data["phone"]
    if new_role:
        user_row.role = new_role
    if "can_login" in update_data and update_data["can_login"] is not None:
        user_row.can_login = update_data["can_login"]

    user_row.updated_at = datetime.utcnow()
    db.add(user_row)
    db.commit()
    db.refresh(user_row)
    logger.info(f"Company staff updated by {current_user.email}: {user_id}")
    return {"user": _serialize_staff(user_row)}


@router.post("/company-staff/{user_id}/deactivate")
async def deactivate_company_staff(
    user_id: str,
    current_user: UserResponse = Depends(require_company_users),
    db: Session = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    user_row = users_repo.get_user_by_id(db, user_id)
    if not user_row or user_row.organization_id or user_row.role not in ("admin", "operations", "sales"):
        raise HTTPException(status_code=404, detail="Company staff member not found")
    if user_row.role == "admin" and users_repo.count_company_admins(db) <= 1:
        raise HTTPException(status_code=400, detail="Cannot deactivate the last Global Admin")
    user_row.can_login = False
    user_row.updated_at = datetime.utcnow()
    db.add(user_row)
    db.commit()
    return {"message": "Staff member deactivated", "user": _serialize_staff(user_row)}


# ============================================
# Admin Dev Utilities (Test Emails)
# ============================================

@router.post("/test-email/quote/{quote_id}")
async def send_test_quote_email(
    quote_id: str,
    to_email: str = "manuatemba@gmail.com",
    current_user: UserResponse = Depends(require_settings),
    db: Session = Depends(get_db),
):
    """
    Admin-only: send a TEST quote email (rendered from quote_template.html + PDF attachment).
    Guarded by ALLOW_TEST_EMAILS=true.
    """
    import os
    from utils.email_service import send_modified_quote_email

    if os.getenv("ALLOW_TEST_EMAILS", "false").lower() != "true":
        raise HTTPException(status_code=403, detail="Test emails are disabled (ALLOW_TEST_EMAILS != true)")

    quote_row = db.query(QuoteModel).filter(QuoteModel.id == quote_id).one_or_none()
    if not quote_row:
        raise HTTPException(status_code=404, detail="Quote not found")

    items_rows = db.query(QuoteItemModel).filter(QuoteItemModel.quote_id == quote_id).all()
    items = [
        {
            "product_id": it.product_id,
            "product_name": it.product_name,
            "quantity": it.quantity,
            "original_price": it.unit_price or 0,
            "modified_price": it.unit_price or 0,
            "discount_percent": 0,
        }
        for it in items_rows
    ]

    # Send to override address, but keep content from quote data
    send_modified_quote_email(
        contact_person=quote_row.contact_person,
        email=to_email,
        facility_name=quote_row.facility_name,
        items=items,
        subtotal=float(quote_row.subtotal or 0),
        discount=float(quote_row.discount_amount or 0),
        tax_rate=float(quote_row.tax_rate or 0),
        tax_amount=float(quote_row.tax_amount or 0),
        total=float(quote_row.total or 0),
        validity_days=30,
        notes=quote_row.additional_notes or "",
        include_vat=bool(quote_row.include_vat if quote_row.include_vat is not None else True),
        quote_id=quote_row.id,
        quote_number=getattr(quote_row, "quote_number", None),
    )

    return {"message": "Test quote email queued", "to": to_email, "quote_id": quote_id}


@router.post("/test-email/invoice/{invoice_id}")
async def send_test_invoice_email(
    invoice_id: str,
    to_email: str = "manuatemba@gmail.com",
    current_user: UserResponse = Depends(require_settings),
    db: Session = Depends(get_db),
):
    """
    Admin-only: send a TEST invoice email (rendered from invoice_template.html + PDF attachment).
    Guarded by ALLOW_TEST_EMAILS=true.
    """
    import os
    from utils.email_service import send_invoice_email

    if os.getenv("ALLOW_TEST_EMAILS", "false").lower() != "true":
        raise HTTPException(status_code=403, detail="Test emails are disabled (ALLOW_TEST_EMAILS != true)")

    inv_row = db.query(InvoiceModel).filter(InvoiceModel.id == invoice_id).one_or_none()
    if not inv_row:
        raise HTTPException(status_code=404, detail="Invoice not found")

    item_rows = db.query(InvoiceItemModel).filter(InvoiceItemModel.invoice_id == invoice_id).all()
    items = [
        {
            "product_id": it.product_id,
            "product_name": it.product_name,
            "quantity": it.quantity,
            "original_price": it.original_price,
            "modified_price": it.modified_price,
        }
        for it in item_rows
    ]

    due_date_str = serialize_datetime(inv_row.due_date) if inv_row.due_date else ""

    send_invoice_email(
        contact_person=inv_row.contact_person,
        email=to_email,
        facility_name=inv_row.facility_name,
        invoice_number=inv_row.invoice_number,
        items=items,
        subtotal=float(inv_row.subtotal or 0),
        discount=float(inv_row.discount_amount or 0),
        tax_rate=float(inv_row.tax_rate or 0),
        tax_amount=float(inv_row.tax_amount or 0),
        total=float(inv_row.total or 0),
        due_date=due_date_str,
        payment_terms=str(inv_row.payment_terms or ""),
        notes=inv_row.notes or "",
        is_paid=(str(inv_row.status or "").lower() == "paid"),
        include_vat=bool(inv_row.include_vat if inv_row.include_vat is not None else True),
    )

    return {"message": "Test invoice email queued", "to": to_email, "invoice_id": invoice_id}

@router.delete("/users/{user_id}")
@router.delete("/company-staff/{user_id}")
async def delete_user(
    user_id: str,
    current_user: UserResponse = Depends(require_company_users),
    db: Session = Depends(get_db),
):
    """Delete a user (admin only)."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    user_row = users_repo.get_user_by_id(db, user_id)
    if not user_row or user_row.organization_id or user_row.role not in ("admin", "operations", "sales"):
        raise HTTPException(status_code=404, detail="Company staff member not found")
    if user_row.role == "admin" and users_repo.count_company_admins(db) <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last Global Admin")
    has_history = (
        db.query(SalesVisit.id).filter(SalesVisit.agent_id == user_id).first()
        or db.query(SalesProspect.id).filter(SalesProspect.agent_id == user_id).first()
        or db.query(Organization.id).filter(Organization.registered_by_user_id == user_id).first()
    )
    if has_history:
        raise HTTPException(
            status_code=400,
            detail="This person has field visits or facilities they registered. Deactivate them instead of deleting them.",
        )

    db.query(SalesAgentCounty).filter(SalesAgentCounty.user_id == user_id).delete(synchronize_session=False)
    db.query(SalesAgentTarget).filter(SalesAgentTarget.user_id == user_id).delete(synchronize_session=False)
    db.query(SalesWorkday).filter(SalesWorkday.agent_id == user_id).delete(synchronize_session=False)
    db.delete(user_row)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="This person has records in the system. Deactivate them instead of deleting them.",
        )

    logger.info(f"User deleted by admin {current_user.email}: {user_id}")
    
    return {"message": "User deleted successfully"}