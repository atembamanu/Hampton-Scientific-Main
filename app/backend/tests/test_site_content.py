from utils.site_content import (
    DEFAULT_IMPACT_STATS,
    DEFAULT_PARTNERS,
    normalize_impact_stats,
    normalize_partners,
)


def test_normalize_impact_stats_filters_and_caps():
    raw = [
        {"value": "50+", "label": "Hospitals"},
        {"value": "", "label": "Skip"},
        "nope",
        {"value": "10+", "label": "Years"},
    ]
    assert normalize_impact_stats(raw) == [
        {"value": "50+", "label": "Hospitals"},
        {"value": "10+", "label": "Years"},
    ]


def test_normalize_impact_stats_falls_back():
    assert normalize_impact_stats(None) == DEFAULT_IMPACT_STATS
    assert normalize_impact_stats([], fallback=False) == []


def test_normalize_partners_dedupes():
    assert normalize_partners(["Mindray", " mindray ", "Roche"]) == ["Mindray", "Roche"]
    assert normalize_partners([], fallback=True) == DEFAULT_PARTNERS
