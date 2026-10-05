import re
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

CAREER_UPLOAD_DIR = Path(__file__).resolve().parent.parent / "routes" / "uploads" / "careers"
CAREER_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_CV_BYTES = 5 * 1024 * 1024
CAREER_FILE_PREFIX = "/files/careers/"

_ALLOWED_EXTS = {"pdf", "doc", "docx"}
_ALLOWED_MIMES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
_SAFE_NAME = re.compile(r"[^A-Za-z0-9._\- ]+")


def _safe_filename(name: str) -> str:
    cleaned = _SAFE_NAME.sub("", (name or "cv").strip())[:120].strip() or "cv"
    return cleaned


def save_cv_upload(file: UploadFile, content: bytes) -> dict:
    if not content:
        raise HTTPException(status_code=400, detail="Please attach a CV")
    if len(content) > MAX_CV_BYTES:
        raise HTTPException(status_code=400, detail="CV is too large. Maximum size is 5MB")
    original = _safe_filename(file.filename or "cv.pdf")
    ext = original.rsplit(".", 1)[-1].lower() if "." in original else ""
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if ext not in _ALLOWED_EXTS:
        raise HTTPException(status_code=400, detail="CV must be a PDF or Word document")
    if content_type and content_type not in _ALLOWED_MIMES and content_type != "application/octet-stream":
        raise HTTPException(status_code=400, detail="CV must be a PDF or Word document")
    stored = f"{uuid.uuid4().hex}.{ext}"
    dest = CAREER_UPLOAD_DIR / stored
    dest.write_bytes(content)
    return {
        "filename": original,
        "url": f"{CAREER_FILE_PREFIX}{stored}",
        "path": stored,
    }


def cv_disk_path(stored_name: str) -> Path:
    name = Path(stored_name or "").name
    if not name or name != stored_name or ".." in name:
        raise HTTPException(status_code=400, detail="Invalid CV file")
    path = CAREER_UPLOAD_DIR / name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="CV file not found")
    return path
