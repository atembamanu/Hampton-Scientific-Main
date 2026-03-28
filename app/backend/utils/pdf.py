"""
HTML + Playwright + Jinja2 PDF generation for quotes and invoices.

- Jinja2 for injecting dynamic data into HTML templates
- Playwright to render that HTML and export high-fidelity PDFs
- Optimized for high-performance FastAPI environments.

Public API (backwards compatible):
- generate_quote_pdf(quote_data, company_info, is_modified=False) -> base64 PDF
- generate_invoice_pdf(invoice_data, company_info, is_paid=False) -> base64 PDF
"""

from __future__ import annotations
import base64
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict
from jinja2 import Environment, FileSystemLoader, select_autoescape

logger = logging.getLogger(__name__)

TEMPLATES_DIR = Path(__file__).resolve().parent
from utils.document_context import build_invoice_context, build_quote_context


def _get_jinja_env() -> Environment:
    """Create a Jinja2 environment for the utils templates directory."""
    return Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=select_autoescape(["html", "xml"]),
    )


async def _render_pdf_from_html(html: str) -> bytes:
    """
    Renders HTML to PDF using the SHARED browser instance.
    Note: We import PDFManager here to avoid circular imports.
    """
    from server import PDFManager 
    
    # We use the existing shared browser to open a new page
    page = await PDFManager.browser.new_page()
    try:
        # Avoid writing to disk if possible; set content directly
        await page.set_content(html)
        await page.wait_for_load_state("networkidle")

        pdf_bytes: bytes = await page.pdf(
            format="A4",
            print_background=True,
            margin={"top": "20px", "bottom": "20px", "left": "20px", "right": "20px"},
        )
        return pdf_bytes
    finally:
        await page.close()

def get_base64_image(image_path: str) -> str:
    try:
        with open(image_path, "rb") as image_file:
            return f"data:image/png;base64,{base64.b64encode(image_file.read()).decode('utf-8')}"
    except Exception as e:
        logger.error(f"Could not load image: {e}")
        return ""

async def generate_invoice_pdf(
    invoice_data: Dict[str, Any],
    company_info: Dict[str, Any],
    is_paid: bool = False,
) -> str:
    env = _get_jinja_env()
    template = env.get_template("invoice_template.html")

    paid_stamp_data = get_base64_image("/app/assets/paid-stamp.webp") if is_paid else ""
    context = build_invoice_context(
        invoice_data,
        company_info,
        is_paid=is_paid,
        logo_data=get_base64_image("/app/assets/hampton-logo.png"),
        paid_stamp_data=paid_stamp_data,
    )

    html = template.render(**context)
    pdf_bytes = await _render_pdf_from_html(html)
    return base64.b64encode(pdf_bytes).decode("utf-8")


async def generate_quote_pdf(
    quote_data: Dict[str, Any],
    company_info: Dict[str, Any],
    is_modified: bool = False,
) -> str:
    """
    Generate quote PDF using `quote_template.html` with dynamic data.

    Returns a base64-encoded PDF string.
    """
    env = _get_jinja_env()
    template = env.get_template("quote_template.html")
    context = build_quote_context(
        quote_data,
        company_info,
        is_modified=is_modified,
        logo_data=get_base64_image("/app/assets/hampton-logo.png"),
    )

    html = template.render(**context)
    pdf_bytes = await _render_pdf_from_html(html)
    return base64.b64encode(pdf_bytes).decode("utf-8")