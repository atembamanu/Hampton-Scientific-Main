from utils.nav_groups import normalize_nav_group


def test_normalize_nav_group_accepts_known_groups():
    assert normalize_nav_group("Reagents") == "reagents"
    assert normalize_nav_group(" equipment ") == "equipment"
    assert normalize_nav_group("diagnostics") == "diagnostics"


def test_normalize_nav_group_rejects_unknown_and_blank():
    assert normalize_nav_group(None) is None
    assert normalize_nav_group("  ") is None
    assert normalize_nav_group("laboratory") == ""
