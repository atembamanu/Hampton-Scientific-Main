"""Shared smooth, modern HTML email shell for all Hampton outbound mail."""

from __future__ import annotations

from html import escape
from typing import Optional


# Brand tokens (aligned with frontend storefront)
GREEN = "#006332"
GREEN_DARK = "#004d28"
GREEN_LIGHT = "#4a9b6a"  # secondary strip below header (sample: lighter brand tone)
COPPER = "#c4704a"
INK = "#1a1a1a"
MUTED = "#5c574f"
FAINT = "#9a9590"
CREAM = "#f0eeeb"
CREAM_SOFT = "#f7f6f4"
BORDER = "#e8e4df"
WHITE = "#ffffff"


def e(value) -> str:
    return escape("" if value is None else str(value), quote=True)


def first_name_only(name: Optional[str], fallback: str = "there") -> str:
    """Use the first word of a contact name for greetings (e.g. Emmanuel from Emmanuel Otieno)."""
    text = " ".join(str(name or "").strip().split())
    if not text:
        return fallback
    # Drop common titles if present as the first token
    parts = text.replace(",", " ").split()
    titles = {"mr", "mrs", "ms", "miss", "dr", "prof", "eng", "sir", "madam"}
    if parts and parts[0].rstrip(".").lower() in titles and len(parts) > 1:
        return parts[1]
    return parts[0]


def email_cta(label: str, href: str) -> str:
    return f"""
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 8px;">
      <tr>
        <td style="border-radius:999px; background:{COPPER};">
          <a href="{e(href)}" style="display:inline-block; padding:14px 28px; color:{WHITE}; font-size:14px; font-weight:600; text-decoration:none; border-radius:999px; font-family:Arial, Helvetica, sans-serif;">
            {e(label)}
          </a>
        </td>
      </tr>
    </table>
    """


def email_greeting(name: str, lead: str) -> str:
    who = e(first_name_only(name))
    return (
        f'<p style="margin:0 0 6px 0; color:{INK}; font-size:18px; font-weight:700; line-height:1.35;">'
        f'Dear {who},</p>'
        f'<p style="margin:0 0 18px 0; color:{MUTED}; font-size:15px; line-height:1.6;">{lead}</p>'
    )


def email_status_row(steps: list[tuple[str, str]]) -> str:
    """steps: list of (label, state) where state is done|current|todo."""
    cells = []
    for i, (label, state) in enumerate(steps):
        if state == "done":
            badge_bg, badge_fg, mark = "#eaf5ee", GREEN, "✓"
        elif state == "current":
            badge_bg, badge_fg, mark = "#fef6e8", "#8a5a12", "●"
        else:
            badge_bg, badge_fg, mark = CREAM_SOFT, FAINT, "○"
        cells.append(
            f'<td style="padding:0 6px; text-align:center; vertical-align:top; width:{int(100/max(len(steps),1))}%;">'
            f'<div style="width:28px; height:28px; line-height:28px; margin:0 auto 8px; border-radius:50%; '
            f'background:{badge_bg}; color:{badge_fg}; font-size:14px; font-weight:700;">{mark}</div>'
            f'<p style="margin:0; font-size:12px; font-weight:700; color:{INK};">{e(label)}</p>'
            f'</td>'
        )
        if i < len(steps) - 1:
            cells.append(
                f'<td style="width:18px; padding-top:12px; color:{BORDER}; font-size:12px; text-align:center;">—</td>'
            )
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;">
      <tr>{''.join(cells)}</tr>
    </table>
    """


def email_section_title(text: str) -> str:
    return (
        f'<p style="margin:22px 0 10px 0; color:{INK}; font-size:15px; font-weight:700; '
        f'letter-spacing:0.02em;">{e(text)}</p>'
    )


def email_totals_block(
    rows: list[tuple[str, str]],
    *,
    total_label: str,
    total_value: str,
) -> str:
    lines = []
    for label, value in rows:
        if value is None or value == "":
            continue
        lines.append(
            f'<tr>'
            f'<td style="padding:6px 0; color:{MUTED}; font-size:13px;">{e(label)}</td>'
            f'<td style="padding:6px 0; color:{INK}; font-size:13px; text-align:right;">{e(value)}</td>'
            f'</tr>'
        )
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px; background:{CREAM_SOFT}; border-radius:12px; padding:0;">
      <tr>
        <td style="padding:16px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            {''.join(lines)}
            <tr>
              <td colspan="2" style="padding-top:10px; border-top:1px solid {BORDER};"></td>
            </tr>
            <tr>
              <td style="padding:8px 0 0 0; color:{INK}; font-size:15px; font-weight:700;">{e(total_label)}</td>
              <td style="padding:8px 0 0 0; color:{GREEN}; font-size:18px; font-weight:700; text-align:right;">{e(total_value)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    """


def email_info_grid(columns: list[tuple[str, str]]) -> str:
    """columns: list of (title, html_body). Renders up to 3 columns."""
    if not columns:
        return ""
    width = int(100 / len(columns))
    cells = []
    for title, body in columns:
        cells.append(
            f'<td style="width:{width}%; vertical-align:top; padding:14px 12px;">'
            f'<p style="margin:0 0 8px 0; font-size:11px; font-weight:700; letter-spacing:0.08em; '
            f'text-transform:uppercase; color:{GREEN};">{e(title)}</p>'
            f'<div style="font-size:13px; line-height:1.55; color:{MUTED};">{body}</div>'
            f'</td>'
        )
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0; background:{WHITE}; border:1px solid {BORDER}; border-radius:12px;">
      <tr>{''.join(cells)}</tr>
    </table>
    """


def email_item_rows(items: list, *, show_prices: bool = True) -> tuple[str, float]:
    """Build <tr> rows for email_items_table. Returns (rows_html, total)."""
    rows = []
    total = 0.0
    for item in items or []:
        name = item.get("product_name") or item.get("name") or "Item"
        qty = item.get("quantity", 1) or 1
        unit = (
            item.get("modified_price")
            if item.get("modified_price") is not None
            else item.get("unit_price", item.get("original_price", 0))
        ) or 0
        try:
            unit = float(unit)
        except (TypeError, ValueError):
            unit = 0.0
        try:
            qty_n = float(qty)
        except (TypeError, ValueError):
            qty_n = 1.0
        line = unit * qty_n
        total += line
        if show_prices:
            rows.append(
                f'<tr>'
                f'<td style="padding:12px; border-bottom:1px solid {BORDER}; color:{INK}; font-size:14px;">{e(name)}</td>'
                f'<td style="padding:12px; border-bottom:1px solid {BORDER}; text-align:center; color:{MUTED}; font-size:14px;">{e(qty)}</td>'
                f'<td style="padding:12px; border-bottom:1px solid {BORDER}; text-align:right; color:{MUTED}; font-size:14px;">KES {unit:,.0f}</td>'
                f'<td style="padding:12px; border-bottom:1px solid {BORDER}; text-align:right; font-weight:700; color:{INK}; font-size:14px;">KES {line:,.0f}</td>'
                f'</tr>'
            )
        else:
            rows.append(
                f'<tr>'
                f'<td style="padding:12px; border-bottom:1px solid {BORDER}; color:{INK}; font-size:14px;">{e(name)}</td>'
                f'<td style="padding:12px; border-bottom:1px solid {BORDER}; text-align:center; color:{MUTED}; font-size:14px;">{e(qty)}</td>'
                f'</tr>'
            )
    return "".join(rows), total


def email_detail_card(rows: list[tuple[str, str]], *, accent: str = GREEN) -> str:
    """rows: list of (label, html_value) — value may include safe markup like mailto links."""
    lines = []
    for label, value in rows:
        if value is None or value == "":
            continue
        lines.append(
            f'<p style="margin:0 0 12px 0; font-size:14px; line-height:1.5; color:{INK}; font-family:Arial, Helvetica, sans-serif;">'
            f'<span style="display:block; font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:{FAINT}; margin-bottom:3px;">{e(label)}</span>'
            f'{value}</p>'
        )
    body = "".join(lines)
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr>
        <td style="background:{CREAM_SOFT}; border-left:4px solid {accent}; border-radius:0 12px 12px 0; padding:20px 22px;">
          {body}
        </td>
      </tr>
    </table>
    """


def email_highlight(html: str, *, tone: str = "green") -> str:
    if tone == "amber":
        bg, border, color = "#fef6e8", "#f0d9a8", "#8a5a12"
    elif tone == "red":
        bg, border, color = "#fef2f2", "#fecaca", "#991b1b"
    else:
        bg, border, color = "#eaf5ee", "#c5e3d0", GREEN_DARK
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr>
        <td style="background:{bg}; border:1px solid {border}; border-radius:12px; padding:16px 18px; color:{color}; font-size:14px; line-height:1.55; font-family:Arial, Helvetica, sans-serif;">
          {html}
        </td>
      </tr>
    </table>
    """


def email_panel(html: str) -> str:
    # Keep content flush in the cell — white-space:pre-wrap would otherwise show
    # template indentation as a large first-line indent in email clients.
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="margin:16px 0 8px;"><tr>'
        f'<td style="background:{WHITE}; border:1px solid {BORDER}; border-radius:12px; '
        f'padding:16px 18px; color:{MUTED}; font-size:14px; line-height:1.6; '
        f'white-space:pre-wrap; font-family:Arial, Helvetica, sans-serif;">'
        f'{html}</td></tr></table>'
    )


def mailto(addr: str) -> str:
    addr = (addr or "").strip()
    if not addr:
        return ""
    return f'<a href="mailto:{e(addr)}" style="color:{GREEN}; text-decoration:none; font-weight:600;">{e(addr)}</a>'


def email_items_table(
    rows_html: str,
    *,
    footer_label: str = "",
    footer_value: str = "",
    columns: Optional[list[tuple[str, str]]] = None,
) -> str:
    """columns: list of (header, align) e.g. ('Product','left'). rows_html is raw <tr>…"""
    cols = columns or [
        ("Product", "left"),
        ("Qty", "center"),
        ("Unit Price", "right"),
        ("Subtotal", "right"),
    ]
    ths = "".join(
        f'<th style="padding:11px 12px; text-align:{align}; color:{WHITE}; font-size:12px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase;">{e(label)}</th>'
        for label, align in cols
    )
    footer = ""
    if footer_label or footer_value:
        span = max(1, len(cols) - 1)
        footer = f"""
        <tfoot>
          <tr style="background:{CREAM_SOFT};">
            <td colspan="{span}" style="padding:14px 12px; text-align:right; font-weight:700; color:{INK}; font-size:14px;">{e(footer_label)}</td>
            <td style="padding:14px 12px; text-align:right; font-weight:700; color:{GREEN}; font-size:16px;">{e(footer_value)}</td>
          </tr>
        </tfoot>
        """
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0; border-collapse:collapse; border:1px solid {BORDER}; border-radius:12px; overflow:hidden;">
      <thead>
        <tr style="background:{GREEN};">{ths}</tr>
      </thead>
      <tbody>{rows_html}</tbody>
      {footer}
    </table>
    """


def render_email(
    title: str,
    body_html: str,
    *,
    eyebrow: str = "",
    preheader: str = "",
    company_info: Optional[dict] = None,
) -> str:
    """Full HTML document: smooth card layout for all client/admin notifications."""
    ci = company_info or {}
    name = ci.get("company_name") or "Hampton Scientific Limited"
    phone = (ci.get("phone") or "").strip()
    email = (ci.get("email") or "info@hamptonscientific.com").strip()
    website = (ci.get("website") or "www.hamptonscientific.com").strip()
    address = (ci.get("address") or "").strip()
    po_box = (ci.get("po_box") or "").strip()
    location = address or po_box or "Nairobi, Kenya"
    tag = eyebrow or "Medical supplier & trainer"
    preview = preheader or title

    web_href = website if website.startswith("http") else f"https://{website}"
    web_label = website.replace("https://", "").replace("http://", "").rstrip("/")

    contact_bits = []
    if phone:
        contact_bits.append(e(phone))
    if email:
        contact_bits.append(mailto(email))
    contact_line = " · ".join(contact_bits)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>{e(title)}</title>
</head>
<body style="margin:0; padding:0; background:{CREAM};">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
    {e(preview)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{CREAM}; margin:0; padding:0;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%; max-width:600px; background:{WHITE}; border-radius:16px; overflow:hidden;">
          <tr>
            <td style="background:{GREEN}; padding:22px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Arial, Helvetica, sans-serif;">
                    <p style="margin:0; color:{WHITE}; font-size:18px; font-weight:700; letter-spacing:0.02em;">{e(name)}</p>
                    <p style="margin:6px 0 0 0; color:rgba(255,255,255,0.85); font-size:12px; letter-spacing:0.04em;">Medical supplier &amp; trainer</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:{GREEN_LIGHT}; padding:10px 28px;">
              <p style="margin:0; color:{WHITE}; font-size:12px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; font-family:Arial, Helvetica, sans-serif; text-align:center;">
                {e(tag)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px 28px; font-family:Arial, Helvetica, sans-serif; color:{INK};">
              <h1 style="margin:0 0 18px 0; color:{GREEN}; font-size:24px; line-height:1.25; font-weight:700;">
                {e(title)}
              </h1>
              <div style="font-size:15px; line-height:1.65; color:{MUTED};">
                {body_html}
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:{CREAM_SOFT}; border-top:1px solid {BORDER}; padding:22px 28px; text-align:center; font-family:Arial, Helvetica, sans-serif;">
              <p style="margin:0 0 6px 0; color:{INK}; font-size:13px; font-weight:700;">{e(name)}</p>
              <p style="margin:0 0 6px 0; color:{MUTED}; font-size:12px; line-height:1.5;">{e(location)}</p>
              {f'<p style="margin:0 0 6px 0; color:{MUTED}; font-size:12px;">{contact_line}</p>' if contact_line else ''}
              <p style="margin:10px 0 0 0; font-size:12px;">
                <a href="{e(web_href)}" style="color:{COPPER}; text-decoration:none; font-weight:600;">{e(web_label)}</a>
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0 0; color:{FAINT}; font-size:11px; font-family:Arial, Helvetica, sans-serif;">
          Connecting Africa with global healthcare innovation
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
"""
