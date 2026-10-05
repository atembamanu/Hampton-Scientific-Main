from types import SimpleNamespace

from utils.quote_items import apply_quote_item_updates, match_quote_item, sync_quote_items


class _FakeDb:
    def __init__(self):
        self.deleted = []
        self.added = []

    def add(self, row):
        self.added.append(row)

    def delete(self, row):
        self.deleted.append(row)

    def query(self, model):
        class _Q:
            def filter(self, *args, **kwargs):
                return self

            def one_or_none(self):
                return None

        return _Q()


def test_match_prefers_item_id():
    a = SimpleNamespace(id="a", product_id="p1")
    b = SimpleNamespace(id="b", product_id="p1")
    found = match_quote_item([a, b], SimpleNamespace(id="b", product_id="p1"))
    assert found is b


def test_apply_quote_item_updates_writes_prices():
    row = SimpleNamespace(
        id="i1",
        product_id="p1",
        quantity=1,
        quoted_quantity=1,
        list_price=100,
        unit_price=0,
        buying_price=0,
        admin_notes="",
    )
    updated = apply_quote_item_updates(
        [row],
        [SimpleNamespace(id="i1", unit_price=90, buying_price=40, quoted_quantity=2)],
        allow_buying=True,
    )
    assert updated == 1
    assert row.unit_price == 90
    assert row.buying_price == 40
    assert row.quoted_quantity == 2


def test_sync_deletes_items_missing_from_payload():
    row = SimpleNamespace(
        id="i1",
        product_id="p1",
        quantity=1,
        quoted_quantity=1,
        list_price=100,
        unit_price=90,
        buying_price=0,
        admin_notes="",
    )
    db = _FakeDb()
    kept = sync_quote_items(db, "q1", [row], [])
    assert kept == []
    assert db.deleted == [row]
