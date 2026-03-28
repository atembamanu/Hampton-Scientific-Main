from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import List, Optional
from pathlib import Path
from datetime import datetime
import uuid

from sqlalchemy.orm import Session

from models.user import AdminUserCreate, UserResponse, UserUpdate
from models.product import Product
from models.quote import ModifiedQuoteCreate, ModifiedQuote
from utils.auth import get_password_hash, get_admin_user
from utils.logger import logger
from deps import get_db
from repositories import users as users_repo
from repositories import products as products_repo
from db.models import Quote as QuoteModel, QuoteItem as QuoteItemModel, Invoice as InvoiceModel, InvoiceItem as InvoiceItemModel

router = APIRouter()

# Directory for product image uploads (reuse original path)
UPLOAD_DIR = Path(__file__).parent / "uploads" / "products"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ============================================
# Admin User Management Routes
# ============================================

@router.get("/users")
async def list_users(
    current_user: UserResponse = Depends(get_admin_user),
    limit: int = 50,
    skip: int = 0,
    db: Session = Depends(get_db),
):
    """List all users (admin only)."""
    users = users_repo.list_users(db, skip=skip, limit=limit)
    total = users_repo.count_users(db)

    return {
        "users": [
            UserResponse(
                id=u.id,
                firstName=u.first_name,
                lastName=u.last_name,
                email=u.email,
                phone=u.phone,
                facilityName=u.facility_name,
                facilityType=u.facility_type,
                address=u.address,
                city=u.city,
                postalCode=u.postal_code,
                role=u.role,
                can_login=u.can_login,
                created_at=u.created_at,
            )
            for u in users
        ],
        "total": total,
    }

@router.post("/users")
async def create_user(
    user_data: AdminUserCreate,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Create a new user (admin only)."""
    existing_user = users_repo.get_user_by_email(db, user_data.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    # Generate random password for admin-created users
    temp_password = str(uuid.uuid4())[:8]
    hashed_password = get_password_hash(temp_password)
    
    new_id = str(uuid.uuid4())
    now = datetime.utcnow()
    from db.models import User as UserModel

    user_row = UserModel(
        id=new_id,
        first_name=user_data.firstName,
        last_name=user_data.lastName,
        email=user_data.email,
        phone=user_data.phone,
        hashed_password=hashed_password,
        facility_name=user_data.facilityName,
        facility_type=user_data.facilityType,
        address=user_data.address,
        city=user_data.city,
        postal_code=user_data.postalCode,
        role=user_data.role,
        can_login=user_data.can_login,
        created_at=now,
        updated_at=now,
    )

    db.add(user_row)
    db.commit()
    logger.info(f"User created by admin {current_user.email}: {user_data.email}")
    
    # Return user plus temporary password for admin UI
    return {
        "user": UserResponse(
            id=user_row.id,
            firstName=user_row.first_name,
            lastName=user_row.last_name,
            email=user_row.email,
            phone=user_row.phone,
            facilityName=user_row.facility_name,
            facilityType=user_row.facility_type,
            address=user_row.address,
            city=user_row.city,
            postalCode=user_row.postal_code,
            role=user_row.role,
            can_login=user_row.can_login,
            created_at=user_row.created_at,
        ),
        "temp_password": temp_password
    }


# ============================================
# Admin Product Management Routes
# ============================================

@router.post("/categories")
async def create_category_admin(
    category: dict,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Create a product category (admin only)."""
    from db.models import ProductCategory as CategoryModel

    existing = products_repo.get_category_by_category_id(
        db, category_id=category.get("category_id", "")
    )
    if existing:
        raise HTTPException(status_code=400, detail="Category ID already exists")

    next_seq = products_repo.count_categories(db) + 1
    category_id = category.get("category_id") or str(next_seq)

    row = CategoryModel(
        id=str(uuid.uuid4()),
        category_id=category_id,
        name=category["name"],
        description=category.get("description"),
        image=category.get("image"),
        display_order=next_seq,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return {"category": row}


@router.put("/categories/{category_id}")
async def update_category_admin(
    category_id: str,
    category: dict,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Update a product category (admin only)."""
    row = products_repo.get_category_by_category_id(db, category_id)
    if not row:
        raise HTTPException(status_code=404, detail="Category not found")

    update_fields = {k: v for k, v in category.items() if v is not None}
    for key, value in update_fields.items():
        setattr(row, key, value)

    db.add(row)
    db.commit()
    db.refresh(row)

    return {"category": row}


@router.delete("/categories/{category_id}")
async def delete_category_admin(
    category_id: str,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Delete a product category (admin only)."""
    row = products_repo.get_category_by_category_id(db, category_id)
    if not row:
        raise HTTPException(status_code=404, detail="Category not found")

    db.delete(row)
    db.commit()

    return {"message": "Category deleted"}


@router.post("/products")
async def create_product_admin(
    product_data: dict,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Create a new product - Admin only."""
    from db.models import Product as ProductModel

    now = datetime.utcnow()
    next_seq = products_repo.count_products(db) + 1
    product_id = product_data.get("product_id") or f"p{next_seq}"

    category_id = product_data["category_id"]
    category_row = products_repo.get_category_by_category_id(db, category_id)

    category_name = product_data.get("category_name") or (category_row.name if category_row else "")
    image_url = product_data.get("image_url") or (category_row.image if category_row else None)

    product_row = ProductModel(
        id=str(uuid.uuid4()),
        product_id=product_id,
        name=product_data["name"],
        price=product_data.get("price", 0),
        package=product_data.get("package", ""),
        stocking_unit=product_data.get("stocking_unit", ""),
        unit=product_data.get("unit", ""),
        category_id=category_id,
        category_name=category_name,
        description=product_data.get("description"),
        image_url=image_url,
        in_stock=product_data.get("in_stock", True),
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
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Update product details - Admin only."""
    update_data = {k: v for k, v in product_data.items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()

    product_row = products_repo.get_product_by_product_id(db, product_id)
    if not product_row:
        raise HTTPException(status_code=404, detail="Product not found")

    for key, value in update_data.items():
        setattr(product_row, key, value)

    db.add(product_row)
    db.commit()

    return {"message": "Product updated successfully"}


@router.delete("/products/{product_id}")
async def delete_product_admin(
    product_id: str,
    current_user: UserResponse = Depends(get_admin_user),
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
    current_user: UserResponse = Depends(get_admin_user)
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
    package: str = Form(""),
    stocking_unit: str = Form(""),
    description: str = Form(""),
    in_stock: bool = Form(True),
    image_url: str = Form(""),
    image: UploadFile = File(None),
    current_user: UserResponse = Depends(get_admin_user),
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
    next_seq = products_repo.count_products(db) + 1
    product_id = f"p{next_seq}"

    category_row = products_repo.get_category_by_category_id(db, category_id)
    category_name = category_row.name if category_row else ""
    if category_row and not final_image_url:
        final_image_url = category_row.image or final_image_url

    product_row = ProductModel(
        id=str(uuid_module.uuid4()),
        product_id=product_id,
        name=name,
        price=price,
        package=package,
        stocking_unit=stocking_unit,
        unit="",
        category_id=category_id,
        category_name=category_name,
        description=description,
        image_url=final_image_url,
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

@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Update a user (admin only)."""
    update_data = user_update.dict(exclude_unset=True)
    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    
    update_data["updated_at"] = datetime.utcnow()

    user_row = users_repo.get_user_by_id(db, user_id)
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")

    for key, value in update_data.items():
        if key == "firstName":
            setattr(user_row, "first_name", value)
        elif key == "lastName":
            setattr(user_row, "last_name", value)
        elif key == "facilityName":
            setattr(user_row, "facility_name", value)
        elif key == "facilityType":
            setattr(user_row, "facility_type", value)
        elif key == "postalCode":
            setattr(user_row, "postal_code", value)
        else:
            setattr(user_row, key, value)

    db.add(user_row)
    db.commit()
    db.refresh(user_row)
    logger.info(f"User updated by admin {current_user.email}: {user_id}")
    
    return UserResponse(
        id=user_row.id,
        firstName=user_row.first_name,
        lastName=user_row.last_name,
        email=user_row.email,
        phone=user_row.phone,
        facilityName=user_row.facility_name,
        facilityType=user_row.facility_type,
        address=user_row.address,
        city=user_row.city,
        postalCode=user_row.postal_code,
        role=user_row.role,
        can_login=user_row.can_login,
        created_at=user_row.created_at,
    )


# ============================================
# Admin Dev Utilities (Test Emails)
# ============================================

@router.post("/test-email/quote/{quote_id}")
async def send_test_quote_email(
    quote_id: str,
    to_email: str = "manuatemba@gmail.com",
    current_user: UserResponse = Depends(get_admin_user),
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
    current_user: UserResponse = Depends(get_admin_user),
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

    due_date_str = inv_row.due_date.isoformat() if inv_row.due_date else ""

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
async def delete_user(
    user_id: str,
    current_user: UserResponse = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Delete a user (admin only)."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    user_row = users_repo.get_user_by_id(db, user_id)
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user_row)
    db.commit()

    logger.info(f"User deleted by admin {current_user.email}: {user_id}")
    
    return {"message": "User deleted successfully"}