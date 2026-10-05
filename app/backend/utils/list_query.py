from __future__ import annotations

from datetime import datetime
from typing import Optional

from utils.app_time import local_day_end, local_day_start


def csv_values(value: Optional[str]) -> list[str]:
    """Split a comma-separated filter into unique, non-empty values. Order is preserved."""
    if value is None:
        return []
    seen = []
    for part in str(value).split(","):
        item = part.strip()
        if item and item not in seen:
            seen.append(item)
    return seen


def parse_day_start(value: Optional[str]) -> Optional[datetime]:
    """Start of a YYYY-MM-DD day in the company time zone, as a naive-UTC bound for DB filters."""
    return local_day_start(value)


def parse_day_end(value: Optional[str]) -> Optional[datetime]:
    """Exclusive end of a YYYY-MM-DD day in the company time zone, as a naive-UTC bound."""
    return local_day_end(value)


def clamp_page(page: Optional[int], limit: int) -> tuple[int, int, int]:
    page_n = max(int(page or 1), 1)
    limit_n = min(max(int(limit or 10), 1), 100)
    skip = (page_n - 1) * limit_n
    return page_n, limit_n, skip


def paginated_payload(items: list, total: int, page: int, limit: int, **extra) -> dict:
    pages = max((total + limit - 1) // limit, 1) if total else 1
    payload = {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages,
    }
    payload.update(extra)
    return payload
