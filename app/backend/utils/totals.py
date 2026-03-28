"""
Utility functions for calculating quote and invoice totals.
Handles subtotal, discount, tax, and final total calculations.
"""

from typing import List, Dict, Tuple


def calculate_subtotal(items: List[Dict]) -> float:
    """Calculate subtotal from a list of items with unit_price and quantity.
    
    Args:
        items: List of dicts with 'unit_price' and 'quantity' keys
        
    Returns:
        Total sum of (unit_price * quantity) for all items
    """
    subtotal = 0
    for item in items:
        price = float(item.get("unit_price", 0) or 0)
        qty = int(item.get("quantity", 1))
        subtotal += price * qty
    return subtotal


def calculate_tax(subtotal: float, discount: float = 0, tax_rate: float = 16) -> float:
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
    
    # Discount cannot exceed subtotal
    if discount > subtotal:
        return False
    
    # Tax rate should be between 0 and 100
    if tax_rate < 0 or tax_rate > 100:
        return False
    
    return True