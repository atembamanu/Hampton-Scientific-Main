from repositories.products import catalog_sort_direction


def test_catalog_sort_direction_accepts_id_aliases():
    assert catalog_sort_direction("id") == "asc"
    assert catalog_sort_direction("id_asc") == "asc"
    assert catalog_sort_direction("ID-DESC") == "desc"
    assert catalog_sort_direction("product_id") == "asc"
    assert catalog_sort_direction("category_id_desc") == "desc"


def test_catalog_sort_direction_ignores_other_sorts():
    assert catalog_sort_direction(None) is None
    assert catalog_sort_direction("") is None
    assert catalog_sort_direction("name") is None
    assert catalog_sort_direction("newest") is None
