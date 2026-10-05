import re
import uuid
from pathlib import Path
from urllib.parse import urlparse

from fastapi import HTTPException, UploadFile

CHAT_UPLOAD_DIR = Path(__file__).resolve().parent.parent / "routes" / "uploads" / "chat"
CHAT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_ATTACHMENTS = 5
MAX_FILE_BYTES = 10 * 1024 * 1024
CHAT_FILE_PREFIX = "/files/chat/"

_ALLOWED_EXTS = {
    "pdf", "png", "jpg", "jpeg", "webp", "gif",
    "doc", "docx", "xls", "xlsx", "csv", "txt", "zip",
}
_ALLOWED_MIMES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "text/plain",
    "application/zip",
    "application/x-zip-compressed",
}

_SAFE_NAME = re.compile(r"[^A-Za-z0-9._\- ]+")


def _safe_filename(name: str) -> str:
    cleaned = _SAFE_NAME.sub("", (name or "file").strip())[:120].strip() or "file"
    return cleaned


def sanitize_attachments(raw) -> list:
    if not raw:
        return []
    if not isinstance(raw, list):
        raise HTTPException(status_code=400, detail="Invalid attachments")
    if len(raw) > MAX_ATTACHMENTS:
        raise HTTPException(status_code=400, detail=f"At most {MAX_ATTACHMENTS} attachments per message")
    out = []
    for item in raw:
        if not isinstance(item, dict):
            raise HTTPException(status_code=400, detail="Invalid attachment")
        kind = str(item.get("type") or "").strip().lower()
        url = str(item.get("url") or "").strip()
        name = _safe_filename(str(item.get("name") or ""))
        mime = str(item.get("mime") or "").strip()[:120] or None
        if kind == "link":
            parsed = urlparse(url)
            if parsed.scheme not in ("http", "https") or not parsed.netloc:
                raise HTTPException(status_code=400, detail="Links must use http or https")
            out.append({"type": "link", "name": name or parsed.netloc, "url": url, "mime": None})
        elif kind == "file":
            if not url.startswith(CHAT_FILE_PREFIX):
                raise HTTPException(status_code=400, detail="Invalid file attachment")
            filename = url[len(CHAT_FILE_PREFIX):]
            if "/" in filename or "\\" in filename or ".." in filename:
                raise HTTPException(status_code=400, detail="Invalid file attachment")
            out.append({"type": "file", "name": name or filename, "url": url, "mime": mime})
        else:
            raise HTTPException(status_code=400, detail="Attachment type must be file or link")
    return out


def save_chat_upload(file: UploadFile, content: bytes) -> dict:
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB")
    original = _safe_filename(file.filename or "file")
    ext = original.rsplit(".", 1)[-1].lower() if "." in original else ""
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if ext not in _ALLOWED_EXTS and content_type not in _ALLOWED_MIMES:
        raise HTTPException(
            status_code=400,
            detail="File type not allowed. Use PDF, image, Word, Excel, CSV, text, or ZIP.",
        )
    stored_ext = ext if ext in _ALLOWED_EXTS else "bin"
    unique_name = f"{uuid.uuid4()}.{stored_ext}"
    dest = CHAT_UPLOAD_DIR / unique_name
    dest.write_bytes(content)
    return {
        "type": "file",
        "name": original,
        "url": f"{CHAT_FILE_PREFIX}{unique_name}",
        "mime": content_type or None,
    }


def serialize_quote_message(msg, extra=None) -> dict:
    attachments = getattr(msg, "attachments", None)
    if not isinstance(attachments, list):
        attachments = []
    data = {
        "id": msg.id,
        "quote_id": msg.quote_id,
        "sender_id": msg.sender_id,
        "sender_role": msg.sender_role,
        "sender_name": msg.sender_name,
        "body": msg.body or "",
        "attachments": attachments,
        "is_read": msg.is_read,
        "created_at": msg.created_at,
    }
    if extra:
        data.update(extra)
    return data
