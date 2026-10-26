#!/usr/bin/env python3
"""Rasterize hampton-logo.svg to PNG for print/PDF packs."""

from pathlib import Path

from playwright.sync_api import sync_playwright


def main() -> int:
    svg_path = Path("/app/assets/hampton-logo.svg")
    out = Path("/app/routes/uploads/company-profile/hampton-logo.png")
    out.parent.mkdir(parents=True, exist_ok=True)
    svg = svg_path.read_text(encoding="utf-8")
    html = (
        "<!DOCTYPE html><html><head><meta charset='utf-8'></head>"
        "<body style='margin:0;padding:24px;background:#ffffff;'>"
        f"{svg}</body></html>"
    )
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1200, "height": 280}, device_scale_factor=2)
        page.set_content(html, wait_until="networkidle")
        page.locator("svg").first.screenshot(path=str(out), omit_background=False)
        browser.close()
    print(f"wrote {out} ({out.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
