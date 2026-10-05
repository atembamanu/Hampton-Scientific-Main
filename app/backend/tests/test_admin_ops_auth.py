from utils.auth import get_admin_user
from routes.admin_ops import router


def test_all_admin_ops_routes_require_admin_user():
    """Every admin operations endpoint must verify admin authorization server-side."""
    missing = []
    for route in router.routes:
        calls = []
        dependant = getattr(route, "dependant", None)
        if not dependant:
            continue
        stack = [dependant]
        while stack:
            current = stack.pop()
            if current.call:
                calls.append(current.call)
            stack.extend(current.dependencies)
        if get_admin_user not in calls:
            missing.append(getattr(route, "path", str(route)))
    assert missing == [], f"Admin ops routes missing get_admin_user: {missing}"
