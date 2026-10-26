"""Dynamic Hampton Scientific company-profile PDF (reportlab).

Builds a sales PDF from live site settings, partners, impact stats, and
product categories — used by GET /api/company-profile.pdf and the offline
generator script.
"""

from __future__ import annotations

from datetime import date
from io import BytesIO
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy.orm import Session

from db.models import Product, ProductCategory
from repositories import contact as contact_repo
from utils.site_content import normalize_impact_stats, normalize_partners

BRAND = colors.HexColor("#006332")
BRAND_DARK = colors.HexColor("#004d26")
BRAND_SOFT = colors.HexColor("#E8F5EF")
INK = colors.HexColor("#121212")
MUTED = colors.HexColor("#5A5A5A")
FAINT = colors.HexColor("#8A8A8A")
CREAM = colors.HexColor("#F7F6F4")
LINE = colors.HexColor("#E4E1DB")
WHITE = colors.white

DEFAULT_CONTACT = {
    "company_name": "Hampton Scientific Limited",
    "address": "Ushuru Pension Plaza, Muthangari Drive, Block C, First Floor, Nairobi",
    "po_box": "P.O. Box 162 – 00517 Westlands, Nairobi",
    "phone": "0722 792 835",
    "email": "info@hamptonscientific.com",
    "website": "www.hamptonscientific.com",
    "hours": "Mon – Fri, 8:00 AM – 5:00 PM EAT",
}

# Capability-style samples for the General Medical & Lab Equipment category
# (these are offerings, not always discrete catalogue SKUs).
GENERAL_MEDICAL_SAMPLES = [
    "Fully automated chemistry analyser",
    "Haematology",
    "Immunoassay",
    "CT scans",
    "X-rays",
    "Ultrasound",
    "Blood cultures",
    "Fully automated urine & faeces analysers",
    "Autoclave",
    "Blood gas analyser",
    "and more",
]

FALLBACK_CATALOGUE = [
    (
        "Biosystem Chemistry Reagents",
        ["ALT/GPT", "AST/GOT", "Biosystem Cholesterol", "Creatinine", "and more"],
    ),
    (
        "Rapid Test Kits",
        ["Malaria pf Ag", "Hepatitis B", "PDT/HCG Urine", "Dengue Combo", "and more"],
    ),
    (
        "Sample Collection & Lab Supplies",
        ["EDTA Vacutainers", "Micropipettes", "Frosted Slides", "Vacutainer Needles", "and more"],
    ),
    (
        "Oxygen Supplies",
        ["10L Oxygen Concentrator", "Portable O₂ Concentrator", "Oxygen Regulators", "2L Concentrator", "and more"],
    ),
    (
        "General Medical & Lab Equipment",
        list(GENERAL_MEDICAL_SAMPLES),
    ),
]

VALUES = [
    ("01", "Quality First", "Certified equipment from trusted global manufacturers."),
    ("02", "Customer Focus", "Facility-first support from quote to after-sales."),
    ("03", "Excellence", "High standards in delivery, installation, and training."),
    ("04", "Innovation", "Modern tools that improve care across African facilities."),
]

SAMPLE_LIMIT = 4
MAX_CATEGORIES = 14


def _website_label(url: str) -> str:
    return (
        str(url or "")
        .strip()
        .replace("https://", "")
        .replace("http://", "")
        .rstrip("/")
    )


def default_profile_data() -> dict[str, Any]:
    """Static fallback used when DB is unavailable (offline script)."""
    impact = normalize_impact_stats(None)
    partners = normalize_partners(None)
    return {
        "company_name": DEFAULT_CONTACT["company_name"],
        "contact": dict(DEFAULT_CONTACT),
        "impact": [(s["value"], s["label"]) for s in impact],
        "partners": partners,
        "catalogue": list(FALLBACK_CATALOGUE),
    }


def _load_catalogue(db: Session) -> list[tuple[str, list[str]]]:
    cats = (
        db.query(ProductCategory)
        .order_by(ProductCategory.display_order.asc(), ProductCategory.name.asc())
        .all()
    )
    out: list[tuple[str, list[str]]] = []
    for cat in cats:
        name = (cat.name or "").strip()
        if not name:
            continue
        if "general medical" in name.lower():
            samples = list(GENERAL_MEDICAL_SAMPLES)
        else:
            products = (
                db.query(Product)
                .filter(Product.category_id == cat.category_id)
                .order_by(Product.is_featured.desc(), Product.name.asc())
                .limit(SAMPLE_LIMIT)
                .all()
            )
            samples = [p.name.strip() for p in products if (p.name or "").strip()]
            if not samples:
                continue
            samples.append("and more")
        out.append((name, samples))
        if len(out) >= MAX_CATEGORIES:
            break
    return out or list(FALLBACK_CATALOGUE)


def load_company_profile_data(db: Session) -> dict[str, Any]:
    """Assemble profile fields from site settings and live catalogue."""
    settings = contact_repo.get_site_settings(db)
    base = default_profile_data()
    if not settings:
        base["catalogue"] = _load_catalogue(db)
        return base

    contact = {
        "company_name": (settings.company_name or "").strip() or DEFAULT_CONTACT["company_name"],
        "address": (settings.address or "").strip() or DEFAULT_CONTACT["address"],
        "po_box": (settings.po_box or "").strip() or DEFAULT_CONTACT["po_box"],
        "phone": (settings.phone or "").strip() or DEFAULT_CONTACT["phone"],
        "email": (settings.email or "").strip() or DEFAULT_CONTACT["email"],
        "website": _website_label(getattr(settings, "website", None) or "") or DEFAULT_CONTACT["website"],
        "hours": (settings.working_hours or "").strip() or DEFAULT_CONTACT["hours"],
    }
    impact_raw = normalize_impact_stats(
        getattr(settings, "impact_stats", None),
        fallback=getattr(settings, "impact_stats", None) is None,
    )
    partners = normalize_partners(
        getattr(settings, "partners", None),
        fallback=getattr(settings, "partners", None) is None,
    )
    return {
        "company_name": contact["company_name"],
        "contact": contact,
        "impact": [(s["value"], s["label"]) for s in impact_raw],
        "partners": partners,
        "catalogue": _load_catalogue(db),
    }


def find_file(*names: str) -> Path | None:
    # Runtime: docker mounts frontend/public → /app/assets (logo + fonts/).
    # Image also ships copies under /app/assets when the mount is absent.
    backend_assets = Path(__file__).resolve().parent.parent / "assets"
    search_roots = [
        Path("/app/assets"),
        Path("/app/assets/fonts"),
        backend_assets,
        backend_assets / "fonts",
        Path("/fonts"),
        Path("/out/assets"),
        Path("/app/routes/uploads/company-profile"),
    ]
    for root in search_roots:
        for name in names:
            path = root / name
            if path.exists():
                return path
    return None


def register_fonts() -> tuple[str, str, str]:
    regular = find_file("SpaceGrotesk-Regular.ttf")
    medium = find_file("SpaceGrotesk-Medium.ttf")
    bold = find_file("SpaceGrotesk-Bold.ttf")
    if not (regular and bold):
        return "Helvetica", "Helvetica-Bold", "Helvetica-Bold"
    pdfmetrics.registerFont(TTFont("SpaceGrotesk", str(regular)))
    pdfmetrics.registerFont(TTFont("SpaceGrotesk-Bold", str(bold)))
    if medium:
        pdfmetrics.registerFont(TTFont("SpaceGrotesk-Medium", str(medium)))
        med = "SpaceGrotesk-Medium"
    else:
        med = "SpaceGrotesk-Bold"
    pdfmetrics.registerFontFamily(
        "SpaceGrotesk",
        normal="SpaceGrotesk",
        bold="SpaceGrotesk-Bold",
        italic="SpaceGrotesk",
        boldItalic="SpaceGrotesk-Bold",
    )
    if medium:
        pdfmetrics.registerFontFamily(
            "SpaceGrotesk-Medium",
            normal="SpaceGrotesk-Medium",
            bold="SpaceGrotesk-Bold",
            italic="SpaceGrotesk-Medium",
            boldItalic="SpaceGrotesk-Bold",
        )
    return "SpaceGrotesk", med, "SpaceGrotesk-Bold"


def bold_span(text: str, font_bold: str = "SpaceGrotesk-Bold") -> str:
    return f'<font name="{font_bold}"><b>{escape(text)}</b></font>'


def _impact_label_html(label: str) -> str:
    words = str(label or "").strip().split()
    if len(words) >= 2:
        mid = max(1, len(words) // 2)
        left = escape(" ".join(words[:mid]).upper())
        right = escape(" ".join(words[mid:]).upper())
        return f"{left}<br/>{right}"
    return escape(str(label or "").upper())


def _styles(font, font_med, font_bold):
    return {
        "kicker": ParagraphStyle(
            "kicker",
            fontName=font_med,
            fontSize=8,
            textColor=BRAND,
            alignment=TA_LEFT,
            spaceBefore=2,
            spaceAfter=8,
            leading=11,
            tracking=0.6,
        ),
        "hero": ParagraphStyle(
            "hero",
            fontName=font_bold,
            fontSize=11.5,
            leading=16.5,
            textColor=INK,
            alignment=TA_JUSTIFY,
            spaceAfter=10,
        ),
        "hero_sub": ParagraphStyle(
            "hero_sub",
            fontName=font,
            fontSize=10,
            leading=14.5,
            textColor=MUTED,
            alignment=TA_JUSTIFY,
            spaceAfter=12,
        ),
        "h1": ParagraphStyle(
            "h1",
            fontName=font_bold,
            fontSize=11,
            textColor=BRAND,
            spaceBefore=16,
            spaceAfter=8,
            leading=14,
        ),
        "body": ParagraphStyle(
            "body",
            fontName=font,
            fontSize=10,
            leading=14.5,
            textColor=INK,
            alignment=TA_JUSTIFY,
            spaceAfter=8,
        ),
        "meta": ParagraphStyle(
            "meta",
            fontName=font,
            fontSize=9,
            leading=13,
            textColor=MUTED,
        ),
        "meta_b": ParagraphStyle(
            "meta_b",
            fontName=font_med,
            fontSize=9,
            leading=13,
            textColor=INK,
        ),
        "white_b": ParagraphStyle(
            "white_b",
            fontName=font_bold,
            fontSize=12,
            leading=14,
            textColor=WHITE,
            alignment=TA_CENTER,
            spaceAfter=2,
        ),
        "white_s": ParagraphStyle(
            "white_s",
            fontName=font,
            fontSize=7.5,
            leading=9.5,
            textColor=colors.Color(1, 1, 1, alpha=0.88),
            alignment=TA_CENTER,
        ),
        "card_t": ParagraphStyle(
            "card_t",
            fontName=font_med,
            fontSize=9,
            leading=12.5,
            textColor=INK,
            spaceAfter=2,
        ),
        "card_b": ParagraphStyle(
            "card_b",
            fontName=font,
            fontSize=9,
            leading=12.5,
            textColor=MUTED,
        ),
        "chip": ParagraphStyle(
            "chip",
            fontName=font_med,
            fontSize=8.5,
            leading=11,
            textColor=BRAND_DARK,
            alignment=TA_CENTER,
        ),
        "footer": ParagraphStyle(
            "footer",
            fontName=font,
            fontSize=8,
            textColor=FAINT,
            alignment=TA_CENTER,
            leading=11,
            spaceBefore=4,
        ),
        "right_meta": ParagraphStyle(
            "right_meta",
            fontName=font,
            fontSize=9,
            textColor=MUTED,
            alignment=TA_RIGHT,
            leading=13,
        ),
        "note": ParagraphStyle(
            "note",
            fontName=font,
            fontSize=9,
            leading=13,
            textColor=MUTED,
            spaceBefore=8,
            spaceAfter=4,
        ),
    }


def build_company_profile_pdf(profile: dict[str, Any] | None = None) -> bytes:
    """Render the company profile PDF and return raw bytes."""
    data = profile or default_profile_data()
    contact = {**DEFAULT_CONTACT, **(data.get("contact") or {})}
    company_name = data.get("company_name") or contact.get("company_name") or DEFAULT_CONTACT["company_name"]
    phone = contact.get("phone") or DEFAULT_CONTACT["phone"]
    impact_rows = data.get("impact") or []
    if not impact_rows:
        impact_rows = [(s["value"], s["label"]) for s in normalize_impact_stats(None)]
    partners = data.get("partners") or normalize_partners(None)
    catalogue = data.get("catalogue") or list(FALLBACK_CATALOGUE)

    font, font_med, font_bold = register_fonts()
    styles = _styles(font, font_med, font_bold)
    b = lambda t: bold_span(t, font_bold)
    page_w = A4[0] - 32 * mm

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=16 * mm,
        title=f"{company_name} — Company Profile",
        author=company_name,
    )
    story = []

    logo_path = find_file("hampton-logo.png")
    header_left = []
    if logo_path:
        header_left.append(Image(str(logo_path), width=68 * mm, height=13 * mm, kind="proportional"))
    else:
        header_left.append(Paragraph(escape(company_name.upper()), styles["hero"]))

    header_right = Paragraph(
        f"Sales company profile<br/>{date.today().strftime('%B %Y')}<br/>"
        f"<font color='#006332'><b>{escape(phone)}</b></font>",
        styles["right_meta"],
    )
    header = Table([[header_left, header_right]], colWidths=[108 * mm, page_w - 108 * mm])
    header.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(header)
    story.append(Spacer(1, 4 * mm))
    story.append(HRFlowable(width="100%", thickness=2, color=BRAND, spaceBefore=0, spaceAfter=10))

    story.append(Paragraph("COMPANY PROFILE  ·  MEDICAL SUPPLIER &amp; TRAINER", styles["kicker"]))
    story.append(
        Paragraph(
            "We empower healthcare providers with reliable access to premium medical essentials. "
            "Through guaranteed, timely delivery, we help you maintain uninterrupted operations "
            "and exceptional patient care.",
            styles["hero"],
        )
    )
    story.append(
        Paragraph(
            f"{escape(company_name)} connects hospitals, laboratories, and clinics with certified "
            "global equipment, diagnostics, and consumables — with installation, training, and "
            "responsive delivery across Kenya.",
            styles["hero_sub"],
        )
    )

    chips = [
        "Competitive<br/>pricing",
        "Same-day<br/>Nairobi",
        "24–72 hrs<br/>upcountry",
        "Facility<br/>quoting",
    ]
    chip_w = page_w / 4.0 - 2 * mm
    chip_cells = []
    for label in chips:
        inner = Table(
            [[Paragraph(label, styles["chip"])]],
            colWidths=[chip_w],
            rowHeights=[14 * mm],
        )
        inner.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), BRAND_SOFT),
                    ("BOX", (0, 0), (-1, -1), 0, BRAND_SOFT),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        chip_cells.append(inner)
    chip_row = Table([chip_cells], colWidths=[page_w / 4.0] * 4, rowHeights=[14 * mm])
    chip_row.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 1.5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 1.5),
            ]
        )
    )
    story.append(chip_row)
    story.append(Spacer(1, 7 * mm))

    impact_n = max(1, min(len(impact_rows), 8))
    impact_slice = impact_rows[:impact_n]
    col_w = page_w / float(impact_n)
    impact_cells = []
    for val, label in impact_slice:
        cell = Table(
            [
                [Paragraph(escape(str(val)), styles["white_b"])],
                [Paragraph(_impact_label_html(str(label)), styles["white_s"])],
            ],
            colWidths=[col_w - 2 * mm],
        )
        cell.setStyle(
            TableStyle(
                [
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 1),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                ]
            )
        )
        impact_cells.append(cell)
    impact = Table([impact_cells], colWidths=[col_w] * impact_n)
    impact.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), BRAND),
                ("TOPPADDING", (0, 0), (-1, -1), 11),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
                ("LEFTPADDING", (0, 0), (-1, -1), 2),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    story.append(impact)
    story.append(Spacer(1, 4 * mm))
    partner_line = " · ".join(escape(p) for p in partners[:12])
    story.append(
        Paragraph(
            f"Trusted partners include {partner_line} — and more leading manufacturers "
            f"across diagnostics, equipment, and consumables.",
            styles["note"],
        )
    )

    story.append(Paragraph("At a glance", styles["h1"]))
    snap_rows = [
        [Paragraph("Headquarters", styles["meta_b"]), Paragraph(escape(contact["address"]), styles["meta"])],
        [Paragraph("Postal", styles["meta_b"]), Paragraph(escape(contact["po_box"]), styles["meta"])],
        [Paragraph("Phone", styles["meta_b"]), Paragraph(escape(contact["phone"]), styles["meta"])],
        [
            Paragraph("Email / Web", styles["meta_b"]),
            Paragraph(f"{escape(contact['email'])}  ·  {escape(contact['website'])}", styles["meta"]),
        ],
        [Paragraph("Hours", styles["meta_b"]), Paragraph(escape(contact["hours"]), styles["meta"])],
        [Paragraph("Established", styles["meta_b"]), Paragraph("2009 · Nairobi, Kenya", styles["meta"])],
    ]
    snap = Table(snap_rows, colWidths=[34 * mm, page_w - 34 * mm])
    snap.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), CREAM),
                ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(snap)

    story.append(Paragraph("Who we are", styles["h1"]))
    story.append(
        Paragraph(
            "We are a modern medical supplier and trainer. Facilities work with us through quote-based "
            "procurement, a digital facility portal, and specialists who understand laboratory and clinical "
            "workflows — not a consumer checkout.",
            styles["body"],
        )
    )
    story.append(
        Paragraph(
            f"{b('Pricing you can work with.')} Our costs are competitive and deliberately not high — "
            "we price for real hospital and clinic budgets while keeping certified quality, documentation, "
            "and after-sales support intact.",
            styles["body"],
        )
    )

    story.append(PageBreak())
    story.append(Paragraph("Mission &amp; vision", styles["h1"]))
    story.append(
        Paragraph(
            f"{b('Mission:')} Deliver reliable, cutting-edge healthcare tools and technologies to medical "
            "facilities across Africa, with the knowledge teams need for high-quality patient care.",
            styles["body"],
        )
    )
    story.append(
        Paragraph(
            f"{b('Vision:')} Be Africa’s leading healthcare solutions provider — recognised for excellence "
            "in supply, training, and support that transforms care delivery.",
            styles["body"],
        )
    )

    story.append(Paragraph("Delivery promise", styles["h1"]))
    delivery = Table(
        [
            [
                [
                    Paragraph(b("Nairobi"), styles["card_b"]),
                    Paragraph(f"{b('Same-day delivery')}<br/>when ordered within working cut-off", styles["card_b"]),
                ],
                [
                    Paragraph(b("Outside Nairobi"), styles["card_b"]),
                    Paragraph(f"{b('24–72 hours')}<br/>depending on the destination county", styles["card_b"]),
                ],
                [
                    Paragraph(b("Support"), styles["card_b"]),
                    Paragraph("Installation &amp; commissioning<br/>where equipment requires it", styles["card_b"]),
                ],
            ]
        ],
        colWidths=[page_w / 3.0] * 3,
    )
    delivery.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), BRAND_SOFT),
                ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#D0EADF")),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D0EADF")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.append(delivery)

    story.append(Paragraph("What we supply", styles["h1"]))
    story.append(
        Paragraph(
            "A broad, ready-to-quote catalogue across diagnostics, equipment, oxygen, dental, "
            "consumables, and theatre supplies. Examples from our live categories:",
            styles["body"],
        )
    )

    cat_rows = []
    for cat, products in catalogue:
        cat_rows.append(
            [
                Paragraph(escape(cat), styles["card_t"]),
                Paragraph(" · ".join(escape(p) for p in products), styles["card_b"]),
            ]
        )
    cat_table = Table(cat_rows, colWidths=[56 * mm, page_w - 56 * mm])
    cat_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), CREAM),
                ("BOX", (0, 0), (-1, -1), 0.45, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ("ROWBACKGROUNDS", (1, 0), (1, -1), [WHITE, colors.HexColor("#FBFAF8")]),
            ]
        )
    )
    story.append(cat_table)
    story.append(
        Paragraph(
            "Plus training &amp; service: installation, commissioning, hands-on staff training, "
            "and after-sales application support.",
            styles["note"],
        )
    )

    story.append(Paragraph("How facilities work with us", styles["h1"]))
    steps = [
        ("1. Discover:", "Browse the catalogue or speak with a Hampton specialist."),
        ("2. Quote:", "Facility-specific pricing; no public retail cart."),
        ("3. Approve:", "Review and approve through the facility portal."),
        ("4. Deliver:", "Same-day in Nairobi; 24–72 hrs outside Nairobi by county."),
        ("5. Train & support:", "Install, commission, and upskill your team."),
        ("6. Reorder:", "Orders, invoices, and branch reporting in one modern portal."),
    ]
    for label, detail in steps:
        story.append(Paragraph(f"{b(label)} {detail}", styles["body"]))

    story.append(Paragraph("Why Hampton", styles["h1"]))
    partner_names = ", ".join(partners[:6]) if partners else "leading manufacturers"
    why_bits = [
        ("Competitive costs", "Pricing kept accessible for real facility budgets — quality without inflated mark-ups."),
        ("Built for facilities", "Quotes, invoices, and delivery notes that match hospital procurement."),
        ("Certified sources", f"{partner_names}, and many more leading brands."),
        ("Modern portal", "Multi-branch quoting, tracking, and reporting — built for today’s teams."),
    ]
    why_cells = []
    for title, body in why_bits:
        why_cells.append(
            [
                Paragraph(b(title), styles["card_b"]),
                Paragraph(escape(body) if title == "Certified sources" else body, styles["card_b"]),
            ]
        )
    # Certified sources body may contain ampersands from partners — already escaped above.
    # Other bodies are static HTML-safe.
    why_table = Table(
        [why_cells[:2], why_cells[2:]],
        colWidths=[page_w / 2.0] * 2,
    )
    why_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), CREAM),
                ("BOX", (0, 0), (-1, -1), 0.45, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ]
        )
    )
    story.append(why_table)

    story.append(Paragraph("Core values", styles["h1"]))
    val_cells = [
        [
            Paragraph(b(f"{n}. {t}"), styles["card_b"]),
            Paragraph(d, styles["card_b"]),
        ]
        for n, t, d in VALUES
    ]
    val_table = Table([val_cells[:2], val_cells[2:]], colWidths=[page_w / 2.0] * 2)
    val_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), WHITE),
                ("BOX", (0, 0), (-1, -1), 0.45, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(val_table)

    story.append(Paragraph("Let’s talk", styles["h1"]))
    contact_block = Table(
        [
            [Paragraph("Phone", styles["meta_b"]), Paragraph(escape(contact["phone"]), styles["meta"])],
            [Paragraph("Email", styles["meta_b"]), Paragraph(escape(contact["email"]), styles["meta"])],
            [Paragraph("Web", styles["meta_b"]), Paragraph(escape(contact["website"]), styles["meta"])],
            [Paragraph("Visit", styles["meta_b"]), Paragraph(escape(contact["address"]), styles["meta"])],
            [Paragraph("Post", styles["meta_b"]), Paragraph(escape(contact["po_box"]), styles["meta"])],
        ],
        colWidths=[28 * mm, page_w - 28 * mm],
    )
    contact_block.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), CREAM),
                ("BOX", (0, 0), (-1, -1), 0.45, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(contact_block)
    story.append(Spacer(1, 4 * mm))
    story.append(
        Paragraph(
            f"{b('Next step:')} Share your facility name, departments of interest, and preferred contact. "
            "We will send a tailored quotation and shortlist from our live catalogue.",
            styles["body"],
        )
    )

    story.append(Spacer(1, 7 * mm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=BRAND, spaceBefore=2, spaceAfter=8))
    story.append(
        Paragraph(
            f"{escape(company_name)} — Medical Supplier &amp; Trainer<br/>"
            "Modern supply. Competitive costs. Delivery you can plan around.<br/>"
            f"Confidential — for client and partner use. © {escape(company_name)}",
            styles["footer"],
        )
    )

    def _on_page(canvas, doc_):
        canvas.saveState()
        canvas.setFillColor(BRAND)
        canvas.rect(0, A4[1] - 2.8 * mm, A4[0], 2.8 * mm, fill=1, stroke=0)
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.8)
        canvas.line(16 * mm, 10 * mm, A4[0] - 16 * mm, 10 * mm)
        canvas.setFillColor(FAINT)
        canvas.setFont(font, 7.5)
        canvas.drawString(16 * mm, 5.5 * mm, company_name[:48])
        canvas.drawCentredString(A4[0] / 2, 5.5 * mm, phone)
        canvas.drawRightString(A4[0] - 16 * mm, 5.5 * mm, f"{doc_.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=_on_page, onLaterPages=_on_page)
    return buffer.getvalue()
