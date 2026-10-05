"""Remap catalogue category_id / product_id values to sequential numbers."""

from sqlalchemy import text
from sqlalchemy.orm import Session

from db.models import Product, ProductCategory


def _already_sequential(values: list[str]) -> bool:
    if not values:
        return True
    expected = [str(i) for i in range(1, len(values) + 1)]
    return values == expected


def migrate_sequential_catalog_ids(db: Session) -> int:
    categories = (
        db.query(ProductCategory)
        .order_by(ProductCategory.created_at.asc(), ProductCategory.name.asc())
        .all()
    )
    products = (
        db.query(Product)
        .order_by(Product.created_at.asc(), Product.name.asc())
        .all()
    )
    cat_ids = [c.category_id for c in categories]
    product_ids = [p.product_id for p in products]
    if _already_sequential(cat_ids) and _already_sequential(product_ids):
        return 0

    db.execute(text("ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_id_fkey"))

    changed = 0
    for index, cat in enumerate(categories, start=1):
        if cat.category_id != str(index):
            changed += 1
        temp = f"__tmp_c_{index}"
        db.query(Product).filter(Product.category_id == cat.category_id).update(
            {Product.category_id: temp},
            synchronize_session=False,
        )
        cat.category_id = temp
    db.flush()

    for cat in db.query(ProductCategory).filter(ProductCategory.category_id.like("__tmp_c_%")).all():
        final = cat.category_id.replace("__tmp_c_", "")
        db.query(Product).filter(Product.category_id == cat.category_id).update(
            {Product.category_id: final},
            synchronize_session=False,
        )
        cat.category_id = final

    for index, product in enumerate(products, start=1):
        if product.product_id != str(index):
            changed += 1
        product.product_id = f"__tmp_p_{index}"
    db.flush()

    for product in db.query(Product).filter(Product.product_id.like("__tmp_p_%")).all():
        product.product_id = product.product_id.replace("__tmp_p_", "")

    db.commit()
    db.execute(text(
        """
        DO $$ BEGIN
          ALTER TABLE products ADD CONSTRAINT products_category_id_fkey
            FOREIGN KEY (category_id) REFERENCES product_categories(category_id);
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
        """
    ))
    db.commit()
    return changed
