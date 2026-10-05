"""
Seed initial data into Postgres: admin user, categories, products, and settings.

Run this inside the backend container:

    docker compose exec backend python -m scripts.seed_initial_data
    docker compose exec backend python -m scripts.seed_ops_sample_data
"""

import uuid
from datetime import datetime

from db.session import SessionLocal
from db.models import User, ProductCategory, Product, SiteSettings, EmailSettings
from utils.auth import get_password_hash


def ensure_admin_user(session: SessionLocal) -> None:
    """Create admin user if it does not exist."""
    admin_email = "admin@hamptonscientific.com"
    user = session.query(User).filter(User.email == admin_email).one_or_none()
    if user:
        print(f"[seed] Admin user already exists: {admin_email}")
        return

    admin = User(
        id=str(uuid.uuid4()),
        first_name="Admin",
        last_name="User",
        email=admin_email,
        phone="",
        hashed_password=get_password_hash("HamptonAdmin2026!"),
        facility_name="Hampton Scientific",
        facility_type="Admin",
        address="",
        city="Nairobi",
        postal_code="",
        role="admin",
        can_login=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(admin)
    session.commit()
    '''print(f"[seed] Admin user created: {admin_email} / HamptonAdmin2026!")'''


def ensure_site_settings(session: SessionLocal) -> None:
    """Create default site settings if missing."""
    settings = session.query(SiteSettings).filter(SiteSettings.id == "site_settings").one_or_none()
    if settings:
        print("[seed] Site settings already exist")
        return

    settings = SiteSettings(
        id="site_settings",
        company_name="Hampton Scientific Limited",
        address="",
        po_box="",
        phone="",
        email="info@hamptonscientific.com",
        working_hours="Mon–Fri 8:00–17:00",
        default_payment_terms="Net 30",
        updated_at=datetime.utcnow(),
        updated_by=None,
    )
    session.add(settings)
    session.commit()
    print("[seed] Default site settings created")


def ensure_email_settings(session: SessionLocal) -> None:
    """Create default email follow-up settings if missing."""
    settings = session.query(EmailSettings).filter(EmailSettings.id == "followup_settings").one_or_none()
    if settings:
        print("[seed] Email settings already exist")
        return

    settings = EmailSettings(
        id="followup_settings",
        quote_followup_enabled=True,
        quote_followup_hours=24,
        invoice_followup_enabled=True,
        invoice_followup_days=7,
        invoice_overdue_reminder_days=3,
        updated_at=datetime.utcnow(),
    )
    session.add(settings)
    session.commit()
    print("[seed] Default email follow-up settings created")


def ensure_categories_and_products(session: SessionLocal) -> None:
    """Create sample categories and products (idempotent by category_id / product_id)."""
    now = datetime.utcnow()

    categories = [
        {
            "category_id": "1",
            "legacy_id": "c1",
            "name": "Laboratory Equipment",
            "description": "General lab equipment and instruments.",
        },
        {
            "category_id": "2",
            "legacy_id": "c2",
            "name": "Consumables",
            "description": "Lab consumables and reagents.",
        },
        {
            "category_id": "3",
            "legacy_id": "c3",
            "name": "Haematology",
            "description": "Haematology analyzers and related equipment.",
        },
        {
            "category_id": "4",
            "legacy_id": "c4",
            "name": "Point of Care",
            "description": "Portable diagnostic and screening devices.",
        },
    ]

    for idx, c in enumerate(categories, start=1):
        existing = (
            session.query(ProductCategory)
            .filter(
                (ProductCategory.category_id == c["category_id"])
                | (ProductCategory.category_id == c["legacy_id"])
                | (ProductCategory.name == c["name"])
            )
            .first()
        )
        if existing:
            continue
        cat = ProductCategory(
            id=str(uuid.uuid4()),
            category_id=c["category_id"],
            name=c["name"],
            description=c["description"],
            image=None,
            display_order=idx,
            created_at=now,
        )
        session.add(cat)

    session.commit()

    # Refresh categories to get names
    cat_map = {
        c.category_id: c
        for c in session.query(ProductCategory).all()
    }

    products = [
        {
            "product_id": "1",
            "legacy_id": "p1",
            "name": "Microscope",
            "category_id": "1",
            "legacy_category_id": "c1",
            "price": 150000,
            "buying_price": 105000,
            "package": "1 unit",
            "stocking_unit": "unit",
            "unit": "",
            "description": "Binocular laboratory microscope for routine microscopy.",
        },
        {
            "product_id": "2",
            "legacy_id": "p2",
            "name": "Test Tubes (Pack of 100)",
            "category_id": "2",
            "legacy_category_id": "c2",
            "price": 5000,
            "buying_price": 3500,
            "package": "Pack of 100",
            "stocking_unit": "pack",
            "unit": "",
            "description": "Borosilicate glass test tubes, 16×100 mm.",
        },
        {
            "product_id": "3",
            "legacy_id": "p3",
            "name": "CellScan 30 Analyzer",
            "category_id": "3",
            "legacy_category_id": "c3",
            "price": 1850000,
            "buying_price": 1295000,
            "package": "1 unit",
            "stocking_unit": "unit",
            "unit": "",
            "description": "3-part haematology analyzer for moderate-volume laboratories.",
        },
        {
            "product_id": "4",
            "legacy_id": "p4",
            "name": "Hemochroma HB Meter",
            "category_id": "4",
            "legacy_category_id": "c4",
            "price": 85000,
            "buying_price": 59500,
            "package": "1 unit",
            "stocking_unit": "unit",
            "unit": "",
            "description": "Portable haemoglobin meter for point-of-care screening.",
        },
        {
            "product_id": "5",
            "legacy_id": "p5",
            "name": "Centrifuge 4000 RPM",
            "category_id": "1",
            "legacy_category_id": "c1",
            "price": 320000,
            "buying_price": 224000,
            "package": "1 unit",
            "stocking_unit": "unit",
            "unit": "",
            "description": "Benchtop centrifuge for sample preparation.",
        },
        {
            "product_id": "6",
            "legacy_id": "p6",
            "name": "Cellscan Reagents Kit",
            "category_id": "2",
            "legacy_category_id": "c2",
            "price": 42000,
            "buying_price": 29400,
            "package": "1 kit",
            "stocking_unit": "kit",
            "unit": "",
            "description": "Diluent and lyse reagents for CellScan analyzers.",
        },
    ]

    for p in products:
        existing = (
            session.query(Product)
            .filter(
                (Product.product_id == p["product_id"])
                | (Product.product_id == p["legacy_id"])
                | (Product.name == p["name"])
            )
            .first()
        )
        if existing:
            continue
        cat = cat_map.get(p["category_id"]) or cat_map.get(p["legacy_category_id"])
        product = Product(
            id=str(uuid.uuid4()),
            product_id=p["product_id"],
            name=p["name"],
            category_id=cat.category_id if cat else p["category_id"],
            category_name=cat.name if cat else "",
            price=p["price"],
            buying_price=p.get("buying_price", 0),
            package=p["package"],
            stocking_unit=p["stocking_unit"],
            unit=p["unit"],
            image_url=None,
            description=p.get("description"),
            in_stock=True,
            created_at=now,
            updated_at=now,
        )
        session.add(product)

    session.commit()
    product_count = session.query(Product).count()
    print(f"[seed] Sample categories and products ensured ({product_count} products)")


def main() -> None:
    session = SessionLocal()
    try:
        ensure_admin_user(session)
        ensure_site_settings(session)
        ensure_email_settings(session)
        ensure_categories_and_products(session)
    finally:
        session.close()


if __name__ == "__main__":
    main()

