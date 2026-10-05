from __future__ import annotations

import re
from typing import Annotated, Optional

from fastapi import HTTPException
from pydantic import AfterValidator

EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
EMAIL_ERROR = "Enter a valid email address"
PHONE_ERROR = "Enter a valid phone number (e.g. 0712 345 678 or +254712345678)"


def is_valid_email(value: str) -> bool:
    text = (value or "").strip()
    return bool(text and EMAIL_RE.match(text) and len(text) <= 254)


def is_valid_phone(value: str) -> bool:
    raw = (value or "").strip()
    if not raw or len(raw) > 24:
        return False
    if raw.count("+") > 1 or ("+" in raw and not raw.startswith("+")):
        return False
    digits = re.sub(r"\D", "", raw)
    if len(digits) < 9 or len(digits) > 15:
        return False
    if re.fullmatch(r"(?:254|0)?[17]\d{8}", digits):
        return True
    if re.fullmatch(r"(?:254|0)?[1-9]\d{7,9}", digits):
        return True
    return 9 <= len(digits) <= 15


def _require_email(value: str) -> str:
    text = (value or "").strip()
    if not is_valid_email(text):
        raise ValueError(EMAIL_ERROR)
    return text.lower()


def _require_phone(value: str) -> str:
    text = (value or "").strip()
    if not is_valid_phone(text):
        raise ValueError(PHONE_ERROR)
    return text


def _optional_phone(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return ""
    return _require_phone(text)


def _optional_email(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return _require_email(text)


PhoneStr = Annotated[str, AfterValidator(_require_phone)]
OptionalPhoneStr = Annotated[Optional[str], AfterValidator(_optional_phone)]
OptionalEmailStr = Annotated[Optional[str], AfterValidator(_optional_email)]


def raise_if_invalid_email(value: str, *, required: bool = True) -> None:
    text = (value or "").strip()
    if not text:
        if required:
            raise HTTPException(status_code=400, detail="Email is required")
        return
    if not is_valid_email(text):
        raise HTTPException(status_code=400, detail=EMAIL_ERROR)


def raise_if_invalid_phone(value: str, *, required: bool = True) -> None:
    text = (value or "").strip()
    if not text:
        if required:
            raise HTTPException(status_code=400, detail="Phone number is required")
        return
    if not is_valid_phone(text):
        raise HTTPException(status_code=400, detail=PHONE_ERROR)
