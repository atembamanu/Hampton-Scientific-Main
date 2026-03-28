"""
Seed initial data into Postgres: admin user, sample users, categories, and products.

Run this inside the backend container:

    docker compose exec backend python -m scripts.seed_initial_data
"""

import uuid
from datetime import datetime

from db.session import SessionLocal
from db.models import User, ProductCategory, Product, SiteSettings, EmailSettings
from utils.auth import get_password_hash


def ensure_admin_user(session: SessionLocal) -> None:
    """Create admin user if it does not exist."""
    admin_email = "admin@hamptonscientific.co.ke"
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
    print(f"[seed] Admin user created: {admin_email} / HamptonAdmin2026!")


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
        email="info@hamptonscientific.co.ke",
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
    """Create a few sample categories and products if none exist."""
    has_products = session.query(Product).first() is not None
    if has_products:
        print("[seed] Products already exist; skipping sample product seeding")
        return

    now = datetime.utcnow()

    categories = [
        {
            "category_id": "c1",
            "name": "Laboratory Equipment",
            "description": "General lab equipment and instruments.",
        },
        {
            "category_id": "c2",
            "name": "Consumables",
            "description": "Lab consumables and reagents.",
        },
    ]

    for idx, c in enumerate(categories, start=1):
        existing = (
            session.query(ProductCategory)
            .filter(ProductCategory.category_id == c["category_id"])
            .one_or_none()
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
            "product_id": "p1",
            "name": "Microscope",
            "category_id": "c1",
            "price": 150000,
            "package": "1 unit",
            "stocking_unit": "unit",
            "unit": "",
        },
        {
            "product_id": "p2",
            "name": "Test Tubes (Pack of 100)",
            "category_id": "c2",
            "price": 5000,
            "package": "Pack of 100",
            "stocking_unit": "pack",
            "unit": "",
        },
    ]

    for p in products:
        existing = (
            session.query(Product)
            .filter(Product.product_id == p["product_id"])
            .one_or_none()
        )
        if existing:
            continue
        cat = cat_map.get(p["category_id"])
        product = Product(
            id=str(uuid.uuid4()),
            product_id=p["product_id"],
            name=p["name"],
            category_id=p["category_id"],
            category_name=cat.name if cat else "",
            price=p["price"],
            package=p["package"],
            stocking_unit=p["stocking_unit"],
            unit=p["unit"],
            image_url=None,
            description=None,
            in_stock=True,
            created_at=now,
            updated_at=now,
        )
        session.add(product)

    session.commit()
    print("[seed] Sample categories and products created")


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

