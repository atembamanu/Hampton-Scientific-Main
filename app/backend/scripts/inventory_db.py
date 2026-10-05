#!/usr/bin/env python3
"""Inventory Postgres schema vs current Hampton models (read-only).

Usage (from app/backend, with DATABASE_URL set):
  python -m scripts.inventory_db

Or via Docker:
  docker compose exec backend python -m scripts.inventory_db
"""

from __future__ import annotations

import sys
from pathlib import Path

# Allow running as `python scripts/inventory_db.py` from app/backend
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import inspect, text

from db.base import Base
from db.session import engine
import db.models  # noqa: F401 — register models on Base


EXPECTED_TABLES = sorted(Base.metadata.tables.keys())

COUNT_TABLES = [
    "users",
    "organizations",
    "branches",
    "quotes",
    "quote_items",
    "invoices",
    "invoice_items",
    "orders",
    "products",
    "product_categories",
    "training_programs",
    "training_registrations",
    "contact_inquiries",
    "newsletter_subscriptions",
    "site_settings",
    "email_logs",
    "sales_prospects",
    "sales_visits",
]

def _table_exists(inspector, name: str) -> bool:
    return name in inspector.get_table_names()


def inventory() -> dict:
    inspector = inspect(engine)
    present = set(inspector.get_table_names())
    missing = [t for t in EXPECTED_TABLES if t not in present]
    unexpected = sorted(present - set(EXPECTED_TABLES))

    legacy_signals = {
        "users.organization_id": False,
        "quotes.organization_id": False,
        "invoices.organization_id": False,
        "organizations_table": "organizations" in present,
        "branches_table": "branches" in present,
        "orders_table": "orders" in present,
        "users_without_org": None,
        "customer_role_count": None,
    }

    counts = {}
    with engine.connect() as conn:
        for table in COUNT_TABLES:
            if not _table_exists(inspector, table):
                counts[table] = None
                continue
            counts[table] = conn.execute(text(f'SELECT COUNT(*) FROM "{table}"')).scalar() or 0

        if _table_exists(inspector, "users"):
            cols = {c["name"] for c in inspector.get_columns("users")}
            legacy_signals["users.organization_id"] = "organization_id" in cols
            if "organization_id" in cols and "role" in cols:
                legacy_signals["users_without_org"] = conn.execute(
                    text(
                        "SELECT COUNT(*) FROM users "
                        "WHERE organization_id IS NULL "
                        "AND role IN ('customer', 'org_admin', 'branch_admin', 'branch_user')"
                    )
                ).scalar() or 0
            if "role" in cols:
                legacy_signals["customer_role_count"] = conn.execute(
                    text("SELECT COUNT(*) FROM users WHERE role = 'customer'")
                ).scalar() or 0

        if _table_exists(inspector, "quotes"):
            cols = {c["name"] for c in inspector.get_columns("quotes")}
            legacy_signals["quotes.organization_id"] = "organization_id" in cols
            legacy_signals["unassigned_quotes"] = conn.execute(
                text(
                    "SELECT COUNT(*) FROM quotes "
                    "WHERE organization_id IS NULL "
                    "AND (user_id IS NULL OR btrim(user_id) = '')"
                )
            ).scalar() or 0

        if _table_exists(inspector, "invoices"):
            cols = {c["name"] for c in inspector.get_columns("invoices")}
            legacy_signals["invoices.organization_id"] = "organization_id" in cols

    needs_legacy_user_migrate = bool(
        legacy_signals.get("users_without_org")
        or legacy_signals.get("customer_role_count")
        or not legacy_signals.get("organizations_table")
    )

    return {
        "expected_tables": EXPECTED_TABLES,
        "present_tables": sorted(present),
        "missing_tables": missing,
        "unexpected_tables": unexpected,
        "row_counts": counts,
        "legacy_signals": legacy_signals,
        "needs_legacy_user_migrate": needs_legacy_user_migrate,
        "schema_ready": not missing and not needs_legacy_user_migrate,
    }


def print_report(report: dict) -> None:
    print("=== Hampton Postgres inventory ===")
    print(f"Tables present: {len(report['present_tables'])}")
    print(f"Expected tables: {len(report['expected_tables'])}")
    if report["missing_tables"]:
        print("MISSING tables:")
        for name in report["missing_tables"]:
            print(f"  - {name}")
    else:
        print("Missing tables: none")
    if report["unexpected_tables"]:
        print("Unexpected tables (not in current models):")
        for name in report["unexpected_tables"]:
            print(f"  - {name}")
    print("\nRow counts:")
    for name, count in report["row_counts"].items():
        label = "absent" if count is None else str(count)
        print(f"  {name}: {label}")
    print("\nLegacy signals:")
    for key, value in report["legacy_signals"].items():
        print(f"  {key}: {value}")
    print(f"\nNeeds legacy user migrate: {report['needs_legacy_user_migrate']}")
    print(f"Schema ready for v2: {report['schema_ready']}")


def main() -> int:
    report = inventory()
    print_report(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
