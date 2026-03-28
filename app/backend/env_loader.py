"""Load a single monorepo-root .env when present (local dev). In Docker, env is injected — no file in the image."""

from pathlib import Path

from dotenv import load_dotenv

_BACKEND_ROOT = Path(__file__).resolve().parent


def load_app_env() -> None:
    repo_root = _BACKEND_ROOT.parent.parent
    for candidate in (repo_root / ".env", _BACKEND_ROOT / ".env"):
        if candidate.is_file():
            load_dotenv(candidate)
            return
