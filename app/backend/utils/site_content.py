DEFAULT_IMPACT_STATS = [
    {"value": "50+", "label": "Hospitals Supplied"},
    {"value": "100+", "label": "Healthcare Facilities"},
    {"value": "10+", "label": "Years Experience"},
    {"value": "1,000+", "label": "Staff Trained"},
]

DEFAULT_PARTNERS = ["Mindray", "Omron", "Haier", "Sysmex", "Abbott", "Roche"]


def normalize_impact_stats(raw, *, fallback=True):
    items = raw if isinstance(raw, list) else []
    out = []
    for item in items:
        if not isinstance(item, dict):
            continue
        value = str(item.get("value") or "").strip()[:40]
        label = str(item.get("label") or "").strip()[:80]
        if value and label:
            out.append({"value": value, "label": label})
        if len(out) >= 8:
            break
    if out:
        return out
    return list(DEFAULT_IMPACT_STATS) if fallback else []


def normalize_partners(raw, *, fallback=True):
    items = raw if isinstance(raw, list) else []
    out = []
    seen = set()
    for item in items:
        name = str(item if isinstance(item, str) else (item or {}).get("name") or "").strip()[:80]
        key = name.lower()
        if not name or key in seen:
            continue
        seen.add(key)
        out.append(name)
        if len(out) >= 20:
            break
    if out:
        return out
    return list(DEFAULT_PARTNERS) if fallback else []
