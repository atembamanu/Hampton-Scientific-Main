from __future__ import annotations

import hashlib
import hmac
import os
from typing import Optional
from urllib.parse import urlencode


def newsletter_unsub_token(email: str) -> str:
    secret = (os.environ.get("SECRET_KEY") or "hampton-newsletter").encode("utf-8")
    normalized = (email or "").strip().lower().encode("utf-8")
    return hmac.new(secret, normalized, hashlib.sha256).hexdigest()[:40]


def verify_newsletter_unsub_token(email: str, token: str) -> bool:
    expected = newsletter_unsub_token(email)
    return hmac.compare_digest(expected, (token or "").strip())


def newsletter_unsubscribe_url(email: str, frontend_base: Optional[str] = None) -> str:
    base = (frontend_base or os.environ.get("FRONTEND_URL") or "http://localhost:3001").rstrip("/")
    query = urlencode({
        "email": (email or "").strip().lower(),
        "token": newsletter_unsub_token(email),
    })
    return f"{base}/newsletter/unsubscribe?{query}"
