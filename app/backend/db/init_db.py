from pathlib import Path

from db.base import Base
from db.session import engine
from sqlalchemy import text


def _strip_sql_comments(statement: str) -> str:
    lines = [
        line
        for line in statement.splitlines()
        if line.strip() and not line.strip().startswith("--")
    ]
    return "\n".join(lines).strip()


def _assign_initial_nav_groups() -> None:
    """Map the existing catalogue into menu groups once.

    Later admin edits stay as saved. A restart only fills groups when every
    category is still the default Other value.
    """
    with engine.begin() as conn:
        has_column = conn.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = 'product_categories' AND column_name = 'nav_group'"
            )
        ).first()
        if not has_column:
            return
        total = conn.execute(text("SELECT COUNT(*) FROM product_categories")).scalar() or 0
        assigned = conn.execute(
            text("SELECT COUNT(*) FROM product_categories WHERE nav_group <> 'other'")
        ).scalar() or 0
        if total == 0 or assigned:
            return
        conn.execute(
            text(
                "UPDATE product_categories SET nav_group = 'consumables' "
                "WHERE name ILIKE '%consumable%' OR name ILIKE '%glove%' "
                "OR name ILIKE '%suture%' OR name ILIKE '%sample collection%'"
            )
        )
        conn.execute(
            text(
                "UPDATE product_categories SET nav_group = 'diagnostics' "
                "WHERE name ILIKE '%test%' OR name ILIKE '%stain%'"
            )
        )
        conn.execute(
            text(
                "UPDATE product_categories SET nav_group = 'reagents' "
                "WHERE name ILIKE '%reagent%'"
            )
        )
        # Equipment last so names that also mention lab/test stay under Equipment.
        conn.execute(
            text(
                "UPDATE product_categories SET nav_group = 'equipment' "
                "WHERE name ILIKE '%equipment%' OR name ILIKE '%oxygen%' "
                "OR name ILIKE '%latest arrivals%'"
            )
        )


def init_db() -> None:
    """
    Create all SQLAlchemy tables in the configured Postgres database
    based on the models registered with Base.
    """
    Base.metadata.create_all(bind=engine)

    migrations_dir = Path(__file__).parent / "migrations"
    for migration_path in sorted(migrations_dir.glob("*.sql")):
        sql = migration_path.read_text(encoding="utf-8")
        with engine.begin() as conn:
            for statement in sql.split(";"):
                stmt = _strip_sql_comments(statement)
                if stmt:
                    conn.execute(text(stmt))

    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE quotes ADD COLUMN IF NOT EXISTS validity_days INTEGER DEFAULT 30"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_snapshot JSON"
            )
        )

    try:
        from db.session import SessionLocal as CatalogSession
        from db.migrate_catalog_ids import migrate_sequential_catalog_ids

        catalog_db = CatalogSession()
        try:
            n = migrate_sequential_catalog_ids(catalog_db)
            if n:
                print(f"Migrated {n} catalogue IDs to sequential numbers")
        finally:
            catalog_db.close()
    except Exception as e:
        print(f"Catalogue ID migration skipped or partial: {e}")

    try:
        from db.migrate_legacy_users import migrate_legacy_users

        count = migrate_legacy_users()
        if count:
            print(f"Migrated {count} legacy users to organizations")
    except Exception as e:
        print(f"Legacy user migration skipped or partial: {e}")

    try:
        from db.session import SessionLocal
        from utils.document_refs import migrate_document_references

        db = SessionLocal()
        try:
            n = migrate_document_references(db)
            if n:
                print(f"Migrated {n} document references")
        finally:
            db.close()
    except Exception as e:
        print(f"Document reference migration skipped or partial: {e}")

    try:
        _assign_initial_nav_groups()
    except Exception as e:
        print(f"Menu group assignment skipped or partial: {e}")

