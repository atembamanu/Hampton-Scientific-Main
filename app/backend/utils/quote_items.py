"""Match and persist admin quote line-item edits."""
from typing import Any, Iterable
from uuid import uuid4


def match_quote_item(existing_items: list, payload_item: Any):
    item_id = getattr(payload_item, "id", None)
    if item_id is None and isinstance(payload_item, dict):
        item_id = payload_item.get("id")
    if item_id:
        for it in existing_items:
            if it.id == item_id:
                return it
    product_id = getattr(payload_item, "product_id", None)
    if product_id is None and isinstance(payload_item, dict):
        product_id = payload_item.get("product_id")
    if product_id:
        for it in existing_items:
            if it.product_id == product_id:
                return it
    return None


def _val(item: Any, *names, default=None):
    for name in names:
        if isinstance(item, dict):
            if name in item and item[name] is not None:
                return item[name]
        elif hasattr(item, name):
            value = getattr(item, name)
            if value is not None:
                return value
    return default


def apply_quote_item_updates(
    existing_items: list,
    payload_items: Iterable[Any],
    *,
    allow_buying: bool = False,
) -> int:
    """Write quoted qty/prices onto ORM quote items. Returns number of rows updated."""
    updated = 0
    for payload in payload_items or []:
        row = match_quote_item(existing_items, payload)
        if not row:
            continue
        qty = _val(payload, "quoted_quantity", "quantity")
        if qty is not None:
            row.quantity = int(qty)
            row.quoted_quantity = int(qty)
        list_price = _val(payload, "list_price", "original_price")
        if list_price is not None:
            row.list_price = float(list_price or 0)
        quoted = _val(payload, "unit_price", "modified_price")
        if quoted is not None:
            row.unit_price = float(quoted or 0)
        if allow_buying:
            buying = _val(payload, "buying_price")
            if buying is not None:
                row.buying_price = float(buying or 0)
        notes = _val(payload, "admin_notes", "notes")
        if notes is not None:
            row.admin_notes = notes
        updated += 1
    return updated


def sync_quote_items(
    db,
    quote_id: str,
    existing_items: list,
    payload_items: Iterable[Any],
    *,
    allow_buying: bool = False,
) -> list:
    """Replace quote lines with the payload: update, insert, and delete missing rows."""
    from db.models import QuoteItem, Product

    working = list(existing_items or [])
    kept = []

    for payload in payload_items or []:
        row = match_quote_item(working, payload)
        if row:
            apply_quote_item_updates([row], [payload], allow_buying=allow_buying)
            kept.append(row)
            continue

        product_id = _val(payload, "product_id")
        product = None
        if product_id:
            product = db.query(Product).filter(Product.id == product_id).one_or_none()
            if not product:
                product = db.query(Product).filter(Product.product_id == product_id).one_or_none()
        qty = int(_val(payload, "quoted_quantity", "quantity", default=1) or 1)
        list_price = _val(payload, "list_price", "original_price")
        if list_price is None and product is not None:
            list_price = product.price
        buying = _val(payload, "buying_price")
        if buying is None and allow_buying and product is not None:
            buying = product.buying_price
        quoted = _val(payload, "unit_price", "modified_price", default=0)
        row = QuoteItem(
            id=str(uuid4()),
            quote_id=quote_id,
            product_id=(product.id if product else product_id),
            product_name=_val(payload, "product_name") or (product.name if product else "Item"),
            category=_val(payload, "category") or (product.category_name if product else "General"),
            quantity=qty,
            quoted_quantity=qty,
            list_price=float(list_price or 0),
            buying_price=float(buying or 0) if buying is not None else None,
            unit_price=float(quoted or 0),
            admin_notes=_val(payload, "admin_notes", "notes", default="") or "",
        )
        db.add(row)
        working.append(row)
        kept.append(row)

    kept_ids = {row.id for row in kept}
    for row in list(working):
        if row.id not in kept_ids:
            db.delete(row)
            working.remove(row)
    return kept


def recalc_quote_totals(quote, items: list, *, discount=None, tax_rate=None, include_vat=None) -> None:
    from utils.totals import document_pricing, items_to_pricing_payload

    if tax_rate is not None:
        quote.tax_rate = float(tax_rate)
    if include_vat is not None:
        quote.include_vat = bool(include_vat)
    pricing = document_pricing(
        items_to_pricing_payload(items),
        tax_rate=quote.tax_rate,
        include_vat=quote.include_vat is not False,
        delivery_charge=getattr(quote, "delivery_charge", 0) or 0,
    )
    quote.list_subtotal = pricing["list_subtotal"]
    quote.subtotal = pricing["quoted_subtotal"]
    quote.discount_amount = pricing["discount_amount"]
    quote.tax_amount = pricing["tax_amount"]
    quote.total = pricing["total"]
