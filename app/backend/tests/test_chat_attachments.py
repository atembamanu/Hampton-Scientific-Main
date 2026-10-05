from utils.chat_attachments import sanitize_attachments
from fastapi import HTTPException
import pytest


def test_sanitize_link_and_file():
    out = sanitize_attachments([
        {"type": "link", "name": "Spec", "url": "https://example.com/spec"},
        {"type": "file", "name": "quote.pdf", "url": "/files/chat/abc.pdf", "mime": "application/pdf"},
    ])
    assert out[0]["type"] == "link"
    assert out[1]["url"] == "/files/chat/abc.pdf"


def test_reject_javascript_link():
    with pytest.raises(HTTPException):
        sanitize_attachments([{"type": "link", "url": "javascript:alert(1)"}])


def test_reject_path_traversal_file():
    with pytest.raises(HTTPException):
        sanitize_attachments([{"type": "file", "url": "/files/chat/../secret.pdf"}])
