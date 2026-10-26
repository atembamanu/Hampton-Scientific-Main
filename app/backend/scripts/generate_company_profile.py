#!/usr/bin/env python3
"""Generate a modern Hampton Scientific company profile (DOCX + PDF).

Usage:
  python -m scripts.generate_company_profile --out-dir /out
"""

from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Flowable,
    HRFlowable,
    Image,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

BRAND = colors.HexColor("#006332")
BRAND_DARK = colors.HexColor("#004d26")
BRAND_SOFT = colors.HexColor("#E8F5EF")
INK = colors.HexColor("#121212")
MUTED = colors.HexColor("#5A5A5A")
FAINT = colors.HexColor("#8A8A8A")
CREAM = colors.HexColor("#F7F6F4")
LINE = colors.HexColor("#E4E1DB")
WHITE = colors.white

PHONE = "0722 792 835"
CONTACT = {
    "address": "Ushuru Pension Plaza, Muthangari Drive, Block C, First Floor, Nairobi",
    "po_box": "P.O. Box 162 – 00517 Westlands, Nairobi",
    "phone": PHONE,
    "email": "info@hamptonscientific.com",
    "website": "www.hamptonscientific.com",
    "hours": "Mon – Fri, 8:00 AM – 5:00 PM EAT",
}

IMPACT = [
    ("50+", "Hospitals\nsupplied"),
    ("100+", "Healthcare\nfacilities"),
    ("10+", "Years\nexperience"),
    ("1,000+", "Staff\ntrained"),
    ("300+", "Youths\nempowered"),
]

PARTNERS = ["Mindray", "Omron", "Haier", "Sysmex", "Abbott", "Roche"]

# Live catalogue snapshot — category → sample products
CATALOGUE = [
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
        "Latest Arrivals — Equipment",
        ["Autoclaves (18–150L)", "Contec ECG", "Baby Incubator", "Yuwell Suction Machine", "and more"],
    ),
    (
        "Dental Equipment & Accessories",
        ["Dental Autoclave 23L", "Ultrasonic Scaler", "Portable Dental Chair", "Amalgamator", "and more"],
    ),
    (
        "Medical Consumables & Supplies",
        ["Abdominal Gauze", "Infusion Sets", "Nasal Oxygen Cannula", "Urine Bags", "and more"],
    ),
    (
        "Gloves & Protective Gear",
        ["Nitrile Gloves", "Latex Powder-Free", "Sterile Surgical Gloves", "Gynecology Gloves", "and more"],
    ),
    (
        "Sutures & Surgical Blades",
        ["Polyglactin 910 (Vicryl)", "Chromic Catgut", "Silk Braided", "Surgical Blades", "and more"],
    ),
    (
        "Malaria & Gram Stains",
        ["Field Stain A/B", "Giemsa Stain", "Crystal Violet", "Oil Immersion", "and more"],
    ),
    (
        "Blood Grouping & Latex Tests",
        ["Blood grouping kit A/B/D", "Anti-Human Globulin", "ASOT Kit", "Widal Kit", "and more"],
    ),
    (
        "General Medical & Lab Equipment",
        [
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
        ],
    ),
]

VALUES = [
    ("01", "Quality First", "Certified equipment from trusted global manufacturers."),
    ("02", "Customer Focus", "Facility-first support from quote to after-sales."),
    ("03", "Excellence", "High standards in delivery, installation, and training."),
    ("04", "Innovation", "Modern tools that improve care across African facilities."),
]


def find_file(*names: str) -> Path | None:
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
        # Fallback — still generate, but warn
        print("WARNING: Space Grotesk not found; using Helvetica")
        return "Helvetica", "Helvetica-Bold", "Helvetica-Bold"
    pdfmetrics.registerFont(TTFont("SpaceGrotesk", str(regular)))
    pdfmetrics.registerFont(TTFont("SpaceGrotesk-Bold", str(bold)))
    if medium:
        pdfmetrics.registerFont(TTFont("SpaceGrotesk-Medium", str(medium)))
        med = "SpaceGrotesk-Medium"
    else:
        med = "SpaceGrotesk-Bold"
    # Required so <b>…</b> in Paragraphs switches to the Bold face
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
    """Force bold via explicit face name (more reliable than <b> alone)."""
    return f'<font name="{font_bold}"><b>{text}</b></font>'


class RoundedBanner(Flowable):
    """Full-width brand banner with optional title text."""

    def __init__(self, width, height, fill=BRAND):
        super().__init__()
        self.width = width
        self.height = height
        self.fill = fill

    def draw(self):
        self.canv.setFillColor(self.fill)
        self.canv.roundRect(0, 0, self.width, self.height, 8, fill=1, stroke=0)


def _styles(font, font_med, font_bold):
    """Balanced type scale: body 10 / headings 11 / lead 11.5 / labels 9."""
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
        "bullet": ParagraphStyle(
            "bullet",
            fontName=font,
            fontSize=10,
            leading=14.5,
            textColor=INK,
            spaceAfter=3,
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
        "card_accent": ParagraphStyle(
            "card_accent",
            fontName=font_med,
            fontSize=9.5,
            leading=13,
            textColor=BRAND,
            spaceAfter=3,
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


def _default_out_dir() -> Path:
    candidates = [
        Path("/out"),
        Path("/app/routes/uploads/company-profile"),
        Path("/tmp/hampton-company-profile"),
    ]
    for path in candidates:
        try:
            path.mkdir(parents=True, exist_ok=True)
            return path
        except OSError:
            continue
    path = Path("/tmp/hampton-company-profile")
    path.mkdir(parents=True, exist_ok=True)
    return path


def build_pdf(out_path: Path) -> None:
    """Write PDF via shared util (static defaults when DB is not available)."""
    try:
        from utils.company_profile_pdf import build_company_profile_pdf, default_profile_data

        out_path.write_bytes(build_company_profile_pdf(default_profile_data()))
        return
    except Exception as exc:
        print(f"WARNING: shared PDF util unavailable ({exc}); using legacy builder")

    font, font_med, font_bold = register_fonts()
    styles = _styles(font, font_med, font_bold)
    b = lambda t: bold_span(t, font_bold)
    page_w = A4[0] - 32 * mm
    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=16 * mm,
        title="Hampton Scientific Limited — Company Profile",
        author="Hampton Scientific Limited",
    )
    story = []

    # --- Header with logo ---
    logo_path = find_file("hampton-logo.png")
    header_left = []
    if logo_path:
        img = Image(str(logo_path), width=68 * mm, height=13 * mm, kind="proportional")
        header_left.append(img)
    else:
        header_left.append(Paragraph("HAMPTON SCIENTIFIC", styles["hero"]))

    header_right = Paragraph(
        f"Sales company profile<br/>{date.today().strftime('%B %Y')}<br/>"
        f"<font color='#006332'><b>{PHONE}</b></font>",
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
            "Hampton Scientific Limited connects hospitals, laboratories, and clinics with certified "
            "global equipment, diagnostics, and consumables — with installation, training, and "
            "responsive delivery across Kenya.",
            styles["hero_sub"],
        )
    )

    # Value chips — fixed equal height so the row stays balanced
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

    # Impact strip
    impact_cells = []
    for val, label in IMPACT:
        cell = Table(
            [
                [Paragraph(val, styles["white_b"])],
                [Paragraph(label.replace("\n", "<br/>").upper(), styles["white_s"])],
            ],
            colWidths=[32 * mm],
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
    impact = Table([impact_cells], colWidths=[page_w / 5.0] * 5)
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
    story.append(
        Paragraph(
            f"Trusted partners include {' · '.join(PARTNERS)} — and more leading manufacturers "
            f"across diagnostics, equipment, and consumables.",
            styles["note"],
        )
    )

    # Snapshot
    story.append(Paragraph("At a glance", styles["h1"]))
    snap_rows = [
        [Paragraph("Headquarters", styles["meta_b"]), Paragraph(CONTACT["address"], styles["meta"])],
        [Paragraph("Postal", styles["meta_b"]), Paragraph(CONTACT["po_box"], styles["meta"])],
        [Paragraph("Phone", styles["meta_b"]), Paragraph(CONTACT["phone"], styles["meta"])],
        [Paragraph("Email / Web", styles["meta_b"]), Paragraph(f"{CONTACT['email']}  ·  {CONTACT['website']}", styles["meta"])],
        [Paragraph("Hours", styles["meta_b"]), Paragraph(CONTACT["hours"], styles["meta"])],
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

    # Delivery highlight card
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
    for cat, products in CATALOGUE:
        cat_rows.append(
            [
                Paragraph(cat, styles["card_t"]),
                Paragraph(" · ".join(products), styles["card_b"]),
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
        ("5. Train &amp; support:", "Install, commission, and upskill your team."),
        ("6. Reorder:", "Orders, invoices, and branch reporting in one modern portal."),
    ]
    for label, detail in steps:
        story.append(Paragraph(f"{b(label)} {detail}", styles["body"]))

    story.append(Paragraph("Why Hampton", styles["h1"]))
    why_bits = [
        ("Competitive costs", "Pricing kept accessible for real facility budgets — quality without inflated mark-ups."),
        ("Built for facilities", "Quotes, invoices, and delivery notes that match hospital procurement."),
        ("Certified sources", "Mindray, Omron, Haier, Sysmex, Abbott, Roche, and many more leading brands."),
        ("Modern portal", "Multi-branch quoting, tracking, and reporting — built for today’s teams."),
    ]
    why_cells = []
    for title, body in why_bits:
        why_cells.append(
            [
                Paragraph(b(title), styles["card_b"]),
                Paragraph(body, styles["card_b"]),
            ]
        )
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
            [Paragraph("Phone", styles["meta_b"]), Paragraph(CONTACT["phone"], styles["meta"])],
            [Paragraph("Email", styles["meta_b"]), Paragraph(CONTACT["email"], styles["meta"])],
            [Paragraph("Web", styles["meta_b"]), Paragraph(CONTACT["website"], styles["meta"])],
            [Paragraph("Visit", styles["meta_b"]), Paragraph(CONTACT["address"], styles["meta"])],
            [Paragraph("Post", styles["meta_b"]), Paragraph(CONTACT["po_box"], styles["meta"])],
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
            "Hampton Scientific Limited — Medical Supplier &amp; Trainer<br/>"
            "Modern supply. Competitive costs. Delivery you can plan around.<br/>"
            "Confidential — for client and partner use. © Hampton Scientific Limited",
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
        canvas.drawString(16 * mm, 5.5 * mm, "Hampton Scientific Limited")
        canvas.drawCentredString(A4[0] / 2, 5.5 * mm, PHONE)
        canvas.drawRightString(A4[0] - 16 * mm, 5.5 * mm, f"{doc_.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=_on_page, onLaterPages=_on_page)


def build_docx(out_path: Path) -> None:
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Cm, Pt, RGBColor

    font_regular = find_file("SpaceGrotesk-Regular.ttf")
    font_name = "Space Grotesk"

    doc = Document()
    section = doc.sections[0]
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)
    section.left_margin = Cm(1.8)
    section.right_margin = Cm(1.8)
    section.top_margin = Cm(1.6)
    section.bottom_margin = Cm(1.6)

    # Embed font if available (Word will use installed font when present on client)
    def set_run(run, *, size=10, bold=False, color=(18, 18, 18)):
        run.font.name = font_name
        run._element.rPr.rFonts.set(qn("w:eastAsia"), font_name)
        run.font.size = Pt(size)
        run.bold = bold
        run.font.color.rgb = RGBColor(*color)

    def shade(cell, hex_color: str):
        tcPr = cell._tc.get_or_add_tcPr()
        shd = OxmlElement("w:shd")
        shd.set(qn("w:fill"), hex_color)
        shd.set(qn("w:val"), "clear")
        tcPr.append(shd)

    def heading(text):
        p = doc.add_paragraph()
        r = p.add_run(text)
        set_run(r, size=11, bold=True, color=(0, 99, 50))
        p.paragraph_format.space_before = Pt(16)
        p.paragraph_format.space_after = Pt(8)
        p.paragraph_format.line_spacing = 1.25

    def body(text):
        p = doc.add_paragraph()
        r = p.add_run(text)
        set_run(r, size=10, color=(18, 18, 18))
        p.paragraph_format.space_after = Pt(8)
        p.paragraph_format.line_spacing = 1.35

    def page_break():
        p = doc.add_paragraph()
        run = p.add_run()
        run.add_break(WD_BREAK.PAGE)

    logo = find_file("hampton-logo.png")
    if logo:
        doc.add_picture(str(logo), width=Cm(7.2))

    title = doc.add_paragraph()
    r = title.add_run("Company Profile")
    set_run(r, size=22, bold=True, color=(18, 18, 18))

    sub = doc.add_paragraph()
    r = sub.add_run(
        f"Medical Supplier & Trainer  ·  Est. 2009  ·  Nairobi\n"
        f"Prepared for healthcare partners  ·  {date.today().strftime('%B %Y')}  ·  {PHONE}"
    )
    set_run(r, size=10, color=(90, 90, 90))

    heading(
        "We empower healthcare providers with reliable access to premium medical essentials. "
        "Through guaranteed, timely delivery, we help you maintain uninterrupted operations "
        "and exceptional patient care."
    )
    body(
        "Hampton Scientific Limited connects hospitals, laboratories, and clinics with certified "
        "global equipment, diagnostics, and consumables — with installation, training, and responsive "
        "delivery across Kenya."
    )
    body(
        "Pricing you can work with. Our costs are competitive and deliberately not high — "
        "we price for real hospital and clinic budgets while keeping certified quality and support."
    )

    page_break()
    heading("Mission & vision")

    def bold_lead(label, text):
        p = doc.add_paragraph()
        r0 = p.add_run(label)
        set_run(r0, size=10, bold=True, color=(18, 18, 18))
        r1 = p.add_run(text)
        set_run(r1, size=10, color=(18, 18, 18))
        p.paragraph_format.space_after = Pt(8)
        p.paragraph_format.line_spacing = 1.35

    bold_lead(
        "Mission: ",
        "Deliver reliable, cutting-edge healthcare tools and technologies to medical "
        "facilities across Africa, with the knowledge teams need for high-quality patient care.",
    )
    bold_lead(
        "Vision: ",
        "Be Africa’s leading healthcare solutions provider — recognised for excellence "
        "in supply, training, and support that transforms care delivery.",
    )

    heading("Delivery promise")
    body("Nairobi: same-day delivery when ordered within the working cut-off.")
    body("Outside Nairobi: 24–72 hours, depending on the destination county.")
    body("Installation and commissioning available where equipment requires it.")

    heading("Impact")
    t = doc.add_table(rows=2, cols=5)
    t.style = "Table Grid"
    for i, (val, label) in enumerate(IMPACT):
        t.rows[0].cells[i].text = ""
        t.rows[1].cells[i].text = ""
        rv = t.rows[0].cells[i].paragraphs[0].add_run(val)
        set_run(rv, size=14, bold=True, color=(255, 255, 255))
        t.rows[0].cells[i].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        rl = t.rows[1].cells[i].paragraphs[0].add_run(label.replace("\n", " ").upper())
        set_run(rl, size=7, color=(255, 255, 255))
        t.rows[1].cells[i].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        shade(t.rows[0].cells[i], "006332")
        shade(t.rows[1].cells[i], "006332")

    p = doc.add_paragraph()
    r = p.add_run(
        "Trusted partners include "
        + " · ".join(PARTNERS)
        + " — and more leading manufacturers across diagnostics, equipment, and consumables."
    )
    set_run(r, size=9, color=(90, 90, 90))
    p.paragraph_format.space_after = Pt(8)
    p.paragraph_format.line_spacing = 1.35

    heading("At a glance")
    for label, value in [
        ("Headquarters", CONTACT["address"]),
        ("Postal", CONTACT["po_box"]),
        ("Phone", CONTACT["phone"]),
        ("Email", CONTACT["email"]),
        ("Website", CONTACT["website"]),
        ("Hours", CONTACT["hours"]),
    ]:
        body(f"{label}: {value}")

    heading("What we supply")
    body(
        "A broad, ready-to-quote catalogue. Examples from our live categories:"
    )
    for cat, products in CATALOGUE:
        bp = doc.add_paragraph(style="List Bullet")
        bp.clear()
        r = bp.add_run(f"{cat}: {', '.join(products)}")
        set_run(r, size=9.5, color=(18, 18, 18))
    body(
        "Plus training & service: installation, commissioning, hands-on staff training, "
        "and after-sales application support."
    )

    page_break()
    heading("How facilities work with us")
    for label, detail in [
        ("1. Discover: ", "Browse the catalogue or speak with a Hampton specialist."),
        ("2. Quote: ", "Facility-specific pricing; no public retail cart."),
        ("3. Approve: ", "Review and approve through the facility portal."),
        ("4. Deliver: ", "Same-day in Nairobi; 24–72 hrs outside Nairobi by county."),
        ("5. Train & support: ", "Install, commission, and upskill your team."),
        ("6. Reorder: ", "Orders, invoices, and branch reporting in one modern portal."),
    ]:
        bold_lead(label, detail)

    heading("Why Hampton")
    body("Competitive costs — accessible pricing for real facility budgets.")
    body("Built for facilities — quotes and invoices that match hospital procurement.")
    body("Certified sources — Mindray, Omron, Haier, Sysmex, Abbott, Roche, and many more leading brands.")
    body("Modern portal — multi-branch quoting, tracking, and reporting.")

    heading("Core values")
    for n, t, d in VALUES:
        bold_lead(f"{n}. {t} — ", d)

    heading("Let’s talk")
    body(f"Phone: {CONTACT['phone']}")
    body(f"Email: {CONTACT['email']}")
    body(f"Web: {CONTACT['website']}")
    body(f"Visit: {CONTACT['address']}")
    body(
        "Next step: Share your facility name, departments of interest, and preferred contact. "
        "We will send a tailored quotation and shortlist from our live catalogue."
    )

    foot = doc.add_paragraph()
    foot.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = foot.add_run(
        "Hampton Scientific Limited — Medical Supplier & Trainer\n"
        "Modern supply. Competitive costs. Delivery you can plan around.\n"
        "Confidential — for client and partner use. © Hampton Scientific Limited"
    )
    set_run(r, size=8, color=(138, 138, 138))

    # Note for Word: Space Grotesk should be installed on the viewing PC for exact match.
    # PDF embeds the font files directly.
    _ = font_regular
    doc.save(str(out_path))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", type=Path, default=None)
    args = parser.parse_args()
    out_dir = args.out_dir or _default_out_dir()
    out_dir.mkdir(parents=True, exist_ok=True)

    pdf_path = out_dir / "Hampton_Scientific_Company_Profile.pdf"
    docx_path = out_dir / "Hampton_Scientific_Company_Profile.docx"
    print(f"Writing PDF → {pdf_path}")
    build_pdf(pdf_path)
    print(f"Writing DOCX → {docx_path}")
    build_docx(docx_path)
    print("Done.")
    print(f"PDF:  {pdf_path} ({pdf_path.stat().st_size} bytes)")
    print(f"DOCX: {docx_path} ({docx_path.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
