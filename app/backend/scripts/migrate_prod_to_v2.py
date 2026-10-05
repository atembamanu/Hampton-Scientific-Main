#!/usr/bin/env python3
"""Bring an older Hampton Postgres DB forward to the current org/branch schema.

Safe to re-run. Prefer a staging clone before production.

Usage (DATABASE_URL must point at the target database):
  python -m scripts.migrate_prod_to_v2
  python -m scripts.migrate_prod_to_v2 --dry-run   # inventory only

Docker:
  docker compose exec backend python -m scripts.migrate_prod_to_v2
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import text

from db.init_db import init_db
from db.session import SessionLocal, engine
from scripts.inventory_db import inventory, print_report


def _gap_fill() -> dict:
    """Backfill org/branch links and retire obsolete statuses after SQL migrations."""
    stats = {
        "quotes_org_backfilled": 0,
        "quotes_branch_backfilled": 0,
        "invoices_org_backfilled": 0,
        "invoices_branch_backfilled": 0,
        "quotes_status_preparing_retired": 0,
        "invoices_status_awaiting_payment": 0,
        "products_featured_defaulted": 0,
        "categories_nav_group_defaulted": 0,
    }

    with engine.begin() as conn:
        # Quotes: organization_id from owning user
        stats["quotes_org_backfilled"] = conn.execute(
            text(
                """
                UPDATE quotes q
                SET organization_id = u.organization_id
                FROM users u
                WHERE q.user_id = u.id
                  AND q.organization_id IS NULL
                  AND u.organization_id IS NOT NULL
                """
            )
        ).rowcount or 0

        # Quotes: ordered_for_branch_id from org main branch
        stats["quotes_branch_backfilled"] = conn.execute(
            text(
                """
                UPDATE quotes q
                SET ordered_for_branch_id = b.id
                FROM branches b
                WHERE q.organization_id = b.organization_id
                  AND b.is_main IS TRUE
                  AND q.ordered_for_branch_id IS NULL
                  AND q.organization_id IS NOT NULL
                """
            )
        ).rowcount or 0

        # Invoices: organization_id from owning user
        stats["invoices_org_backfilled"] = conn.execute(
            text(
                """
                UPDATE invoices i
                SET organization_id = u.organization_id
                FROM users u
                WHERE i.user_id = u.id
                  AND i.organization_id IS NULL
                  AND u.organization_id IS NOT NULL
                """
            )
        ).rowcount or 0

        # Invoices: branch_id from org main branch
        stats["invoices_branch_backfilled"] = conn.execute(
            text(
                """
                UPDATE invoices i
                SET branch_id = b.id
                FROM branches b
                WHERE i.organization_id = b.organization_id
                  AND b.is_main IS TRUE
                  AND i.branch_id IS NULL
                  AND i.organization_id IS NOT NULL
                """
            )
        ).rowcount or 0

        # Retire preparing quote status (migration 013)
        has_quotes_status = conn.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = 'quotes' AND column_name = 'status'"
            )
        ).first()
        if has_quotes_status:
            stats["quotes_status_preparing_retired"] = conn.execute(
                text(
                    "UPDATE quotes SET status = 'draft' WHERE lower(status) = 'preparing'"
                )
            ).rowcount or 0

        # Invoice awaiting_payment alias normalization if still on legacy labels
        has_inv_status = conn.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = 'invoices' AND column_name = 'status'"
            )
        ).first()
        if has_inv_status:
            stats["invoices_status_awaiting_payment"] = conn.execute(
                text(
                    """
                    UPDATE invoices
                    SET status = 'awaiting_payment'
                    WHERE lower(status) IN ('unpaid', 'pending_payment', 'pending')
                    """
                )
            ).rowcount or 0

        has_featured = conn.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = 'products' AND column_name = 'is_featured'"
            )
        ).first()
        if has_featured:
            stats["products_featured_defaulted"] = conn.execute(
                text(
                    "UPDATE products SET is_featured = FALSE WHERE is_featured IS NULL"
                )
            ).rowcount or 0

        has_nav = conn.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = 'product_categories' AND column_name = 'nav_group'"
            )
        ).first()
        if has_nav:
            stats["categories_nav_group_defaulted"] = conn.execute(
                text(
                    "UPDATE product_categories SET nav_group = 'other' "
                    "WHERE nav_group IS NULL OR btrim(nav_group) = ''"
                )
            ).rowcount or 0

    return stats


def _orphan_report() -> dict:
    with SessionLocal() as db:
        users_no_org = db.execute(
            text(
                "SELECT COUNT(*) FROM users "
                "WHERE organization_id IS NULL "
                "AND role IN ('customer', 'org_admin', 'branch_admin', 'branch_user')"
            )
        ).scalar() or 0
        customer_roles = db.execute(
            text("SELECT COUNT(*) FROM users WHERE role = 'customer'")
        ).scalar() or 0
        # Quotes still tied to a facility user but missing organization_id
        quotes_no_org = db.execute(
            text(
                "SELECT COUNT(*) FROM quotes "
                "WHERE organization_id IS NULL "
                "AND user_id IS NOT NULL AND btrim(user_id) <> ''"
            )
        ).scalar() or 0
        unassigned_quotes = db.execute(
            text(
                "SELECT COUNT(*) FROM quotes "
                "WHERE organization_id IS NULL "
                "AND (user_id IS NULL OR btrim(user_id) = '')"
            )
        ).scalar() or 0
        invoices_no_org = db.execute(
            text("SELECT COUNT(*) FROM invoices WHERE organization_id IS NULL")
        ).scalar() or 0
    return {
        "users_without_org": users_no_org,
        "customer_role_count": customer_roles,
        "quotes_without_org": quotes_no_org,
        "unassigned_quotes_warning": unassigned_quotes,
        "invoices_without_org": invoices_no_org,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate Hampton Postgres to v2 schema")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print inventory only; do not apply migrations",
    )
    args = parser.parse_args()

    print("=== BEFORE ===")
    before = inventory()
    print_report(before)

    if args.dry_run:
        print("\nDry run complete (no changes).")
        return 0

    print("\n=== Applying init_db (SQL 001–021 + legacy users + catalog/doc refs) ===")
    init_db()

    print("\n=== Gap-fill transforms ===")
    gap = _gap_fill()
    for key, value in gap.items():
        print(f"  {key}: {value}")

    print("\n=== AFTER ===")
    after = inventory()
    print_report(after)

    orphans = _orphan_report()
    print("\n=== Orphans / blockers ===")
    for key, value in orphans.items():
        print(f"  {key}: {value}")

    blocking_keys = (
        "users_without_org",
        "customer_role_count",
        "quotes_without_org",
        "invoices_without_org",
    )
    blocking = any(orphans.get(k) for k in blocking_keys)
    if orphans.get("unassigned_quotes_warning"):
        print(
            "\nNote: unassigned quotes (no user/org) left as-is — "
            "usually admin drafts awaiting a client."
        )
    if blocking:
        print(
            "\nWARNING: migration finished with remaining orphans. "
            "Inspect users/quotes/invoices before cutover."
        )
        return 2

    print("\nMigration complete. Schema ready for frontend.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
