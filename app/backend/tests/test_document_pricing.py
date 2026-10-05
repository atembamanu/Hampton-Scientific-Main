from utils.totals import document_pricing, DEFAULT_TAX_RATE


def test_discount_is_list_minus_quoted():
    items = [
        {"list_price": 100, "unit_price": 80, "quantity": 2},
        {"list_price": 50, "unit_price": 50, "quantity": 1},
    ]
    priced = document_pricing(items, tax_rate=16, include_vat=True)
    assert priced["list_subtotal"] == 250
    assert priced["quoted_subtotal"] == 210
    assert priced["discount_amount"] == 40
    assert priced["tax_rate"] == 16
    assert priced["tax_amount"] == round(210 * 0.16, 2)
    assert priced["total"] == round(210 + priced["tax_amount"], 2)


def test_vat_not_applied_when_excluded():
    items = [{"list_price": 100, "unit_price": 90, "quantity": 1}]
    priced = document_pricing(items, tax_rate=DEFAULT_TAX_RATE, include_vat=False)
    assert priced["discount_amount"] == 10
    assert priced["tax_amount"] == 0
    assert priced["total"] == 90
