"""
Utility functions for calculating quote and invoice totals.
Handles subtotal, discount, tax, and final total calculations.
"""

from typing import List, Dict, Tuple

# Fallback only when a document has no stored tax_rate. Prefer SiteSettings / the document's tax_rate.
DEFAULT_TAX_RATE = 16.0


def _item_quantity(item: Dict) -> int:
    return int(item.get("quoted_quantity") or item.get("quantity") or 1)


def calculate_list_subtotal(items: List[Dict]) -> float:
    """Calculate subtotal from catalogue/list price snapshots."""
    subtotal = 0.0
    for item in items:
        price = float(item.get("list_price") or item.get("original_price") or 0)
        subtotal += price * _item_quantity(item)
    return subtotal


def calculate_subtotal(items: List[Dict]) -> float:
    """Calculate quoted subtotal from unit_price (quoted/agreed price) and quantity."""
    subtotal = 0.0
    for item in items:
        price = float(
            item.get("unit_price")
            or item.get("modified_price")
            or item.get("agreed_unit_price")
            or 0
        )
        subtotal += price * _item_quantity(item)
    return subtotal


def document_pricing(
    items: List[Dict],
    *,
    tax_rate: float | None = None,
    include_vat: bool = True,
    delivery_charge: float = 0,
) -> Dict:
    """Canonical document totals.

    Discount is always list subtotal minus quoted subtotal.
    VAT is applied to the quoted subtotal (list minus discount).
    Total is quoted subtotal + VAT + delivery — discount is not subtracted again.
    """
    list_subtotal = round(calculate_list_subtotal(items), 2)
    quoted_subtotal = round(calculate_subtotal(items), 2)
    discount_amount = round(max(0.0, list_subtotal - quoted_subtotal), 2) if quoted_subtotal > 0 else 0.0
    if tax_rate is None:
        rate = DEFAULT_TAX_RATE
    else:
        rate = float(tax_rate)
    if include_vat and rate <= 0:
        rate = DEFAULT_TAX_RATE
    vat_on = quoted_subtotal if quoted_subtotal > 0 else 0.0
    tax_amount = round(vat_on * (rate / 100.0), 2) if include_vat and rate > 0 else 0.0
    delivery = float(delivery_charge or 0)
    total = round(vat_on + tax_amount + delivery, 2)
    return {
        "list_subtotal": list_subtotal,
        "quoted_subtotal": quoted_subtotal,
        "subtotal": quoted_subtotal,
        "display_subtotal": list_subtotal,
        "discount_amount": discount_amount,
        "tax_rate": rate,
        "tax_amount": tax_amount,
        "delivery_charge": delivery,
        "include_vat": bool(include_vat),
        "total": total,
    }


def overlay_document_pricing(payload: Dict, items=None) -> Dict:
    pricing = document_pricing(
        items_to_pricing_payload(items if items is not None else payload.get("items")),
        tax_rate=payload.get("tax_rate"),
        include_vat=payload.get("include_vat", True) is not False,
        delivery_charge=payload.get("delivery_charge") or 0,
    )
    payload["list_subtotal"] = pricing["list_subtotal"]
    payload["discount_amount"] = pricing["discount_amount"]
    payload["subtotal"] = pricing["quoted_subtotal"]
    payload["tax_rate"] = pricing["tax_rate"]
    payload["tax_amount"] = pricing["tax_amount"]
    payload["total"] = pricing["total"]
    payload["net"] = round(max(0.0, pricing["total"] - pricing["tax_amount"]), 2)
    payload["include_vat"] = pricing["include_vat"]
    return payload


def items_to_pricing_payload(items) -> List[Dict]:
    payload = []
    for item in items or []:
        if isinstance(item, dict):
            payload.append(
                {
                    "list_price": item.get("list_price")
                    or item.get("original_price")
                    or item.get("listPrice")
                    or 0,
                    "unit_price": item.get("unit_price")
                    or item.get("modified_price")
                    or item.get("agreed_unit_price")
                    or item.get("quoted_unit_price")
                    or 0,
                    "quantity": item.get("quoted_quantity") or item.get("quantity") or 1,
                }
            )
        else:
            payload.append(
                {
                    "list_price": getattr(item, "list_price", None)
                    or getattr(item, "original_price", None)
                    or 0,
                    "unit_price": getattr(item, "unit_price", None)
                    or getattr(item, "modified_price", None)
                    or getattr(item, "agreed_unit_price", None)
                    or 0,
                    "quantity": getattr(item, "quoted_quantity", None)
                    or getattr(item, "quantity", None)
                    or 1,
                }
            )
    return payload


def calculate_customer_savings(items: List[Dict]) -> float:
    """Sum of (list_price - quoted_price) * qty where quoted is lower than list."""
    savings = 0.0
    for item in items:
        list_price = float(item.get("list_price") or item.get("original_price") or 0)
        quoted = float(item.get("unit_price") or item.get("modified_price") or 0)
        if list_price > 0 and quoted > 0 and quoted < list_price:
            savings += (list_price - quoted) * _item_quantity(item)
    return savings


def calculate_tax(subtotal: float, discount: float = 0, tax_rate: float = DEFAULT_TAX_RATE) -> float:
    """Calculate tax amount based on subtotal, discount, and tax rate.
    
    Args:
        subtotal: The subtotal before discount and tax
        discount: Discount amount (subtracted before tax)
        tax_rate: Tax rate as percentage (e.g., 16 for 16% VAT)
        
    Returns:
        Tax amount calculated as: (subtotal - discount) * (tax_rate / 100)
    """
    if tax_rate <= 0:
        return 0
    
    taxable_amount = subtotal - discount
    tax_amount = taxable_amount * (tax_rate / 100)
    return tax_amount


def calculate_totals(
    items: List[Dict],
    discount: float = 0,
    tax_rate: float = 16
) -> Tuple[float, float, float, float]:
    """Calculate complete pricing breakdown: subtotal, discount, tax, and total.
    
    Args:
        items: List of quote/invoice items with 'unit_price' and 'quantity'
        discount: Discount amount in base currency (default: 0)
        tax_rate: Tax rate as percentage (default: 16 for VAT)
        
    Returns:
        Tuple of (subtotal, tax_amount, total)
        where total = subtotal - discount + tax_amount
    """
    subtotal = calculate_subtotal(items)
    tax_amount = calculate_tax(subtotal, discount, tax_rate)
    total = subtotal - discount + tax_amount
    
    return subtotal, tax_amount, total


def calculate_line_total(unit_price: float, quantity: int, discount_percent: float = 0) -> float:
    """Calculate total for a single line item with optional discount percentage.
    
    Args:
        unit_price: Price per unit
        quantity: Quantity ordered
        discount_percent: Optional discount as percentage (e.g., 10 for 10% off)
        
    Returns:
        Line total after quantity and discount applied
    """
    line_subtotal = float(unit_price or 0) * int(quantity or 1)
    
    if discount_percent > 0:
        discount_amount = line_subtotal * (discount_percent / 100)
        line_subtotal -= discount_amount
    
    return line_subtotal


def calculate_with_breakdown(
    items: List[Dict],
    discount: float = 0,
    tax_rate: float = 16
) -> Dict:
    """Calculate totals and return complete breakdown for display/reporting.
    
    Args:
        items: List of quote/invoice items
        discount: Discount amount
        tax_rate: Tax rate percentage
        
    Returns:
        Dictionary with keys:
        - subtotal: Sum of all items
        - discount: Discount amount
        - discount_percent: Discount as percentage of subtotal
        - subtotal_after_discount: subtotal - discount
        - tax_rate: Tax rate percentage
        - tax_amount: Tax amount
        - total: Final amount due
    """
    subtotal = calculate_subtotal(items)
    tax_amount = calculate_tax(subtotal, discount, tax_rate)
    total = subtotal - discount + tax_amount
    
    discount_percent = (discount / subtotal * 100) if subtotal > 0 else 0
    subtotal_after_discount = subtotal - discount
    
    return {
        "subtotal": subtotal,
        "discount": discount,
        "discount_percent": round(discount_percent, 2),
        "subtotal_after_discount": subtotal_after_discount,
        "tax_rate": tax_rate,
        "tax_amount": tax_amount,
        "total": total
    }


def apply_discount(subtotal: float, discount: float) -> float:
    """Apply a flat discount to subtotal.
    
    Args:
        subtotal: Original subtotal
        discount: Discount amount to apply
        
    Returns:
        subtotal - discount
    """
    return max(0, subtotal - discount)


def apply_discount_percent(subtotal: float, discount_percent: float) -> float:
    """Apply a percentage discount to subtotal.
    
    Args:
        subtotal: Original subtotal
        discount_percent: Discount as percentage (e.g., 10 for 10%)
        
    Returns:
        subtotal with percentage discount applied
    """
    if discount_percent <= 0:
        return subtotal
    
    discount_amount = subtotal * (discount_percent / 100)
    return max(0, subtotal - discount_amount)


def validate_pricing(subtotal: float, discount: float, tax_rate: float) -> bool:
    """Validate pricing inputs to ensure they're reasonable.
    
    Args:
        subtotal: Quote/invoice subtotal
        discount: Discount amount
        tax_rate: Tax rate percentage
        
    Returns:
        True if all values are valid, False otherwise
    """
    # Subtotal must be positive
    if subtotal < 0:
        return False
    
    if discount < 0:
        return False
    
    # Tax rate should be between 0 and 100
    if tax_rate < 0 or tax_rate > 100:
        return False
    
    return True