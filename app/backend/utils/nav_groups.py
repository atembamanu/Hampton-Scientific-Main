NAV_GROUPS = (
    ("reagents", "Reagents"),
    ("equipment", "Equipment"),
    ("consumables", "Consumables"),
    ("diagnostics", "Diagnostics"),
    ("other", "Other"),
)

NAV_GROUP_IDS = {group_id for group_id, _label in NAV_GROUPS}


def normalize_nav_group(value):
    """Return a known menu group id, None when blank, or '' when the value is not a group."""
    if value is None or str(value).strip() == "":
        return None
    key = str(value).strip().lower()
    if key in NAV_GROUP_IDS:
        return key
    return ""
