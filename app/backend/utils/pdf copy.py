"""
PDF generation utilities for quotes and invoices.
Handles professional PDF creation using ReportLab.
"""

import io
import base64
from typing import Optional
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
    HRFlowable,
    Image,
)
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_RIGHT, TA_CENTER

import logging
import base64 as _b64
from io import BytesIO
from pathlib import Path
logger = logging.getLogger(__name__)


# ============================================
# Style Definitions
# ============================================

def get_styles():
    """Return a set of predefined paragraph styles for PDF generation."""
    base_styles = getSampleStyleSheet()
    
    PRIMARY_COLOR = colors.HexColor('#006332')
    SECONDARY_COLOR = colors.HexColor('#7f8c8d')
    BG_LIGHT = colors.HexColor('#e8f5e9')
    
    styles = {
        'company_title': ParagraphStyle(
            'CompanyTitle',
            parent=base_styles['Title'],
            fontSize=22,
            textColor=PRIMARY_COLOR,
            spaceAfter=2,
            alignment=0
        ),
        'subtitle': ParagraphStyle(
            'Subtitle',
            parent=base_styles['Normal'],
            fontSize=11,
            textColor=SECONDARY_COLOR,
            spaceAfter=0
        ),
        'invoice_heading': ParagraphStyle(
            'InvHeading',
            parent=base_styles['Heading1'],
            fontSize=28,
            textColor=PRIMARY_COLOR,
            alignment=TA_RIGHT,
            fontName='Helvetica'
        ),
        'quote_heading': ParagraphStyle(
            'QuoteHeading',
            parent=base_styles['Heading1'],
            fontSize=16,
            textColor=PRIMARY_COLOR,
            spaceAfter=10,
            alignment=TA_RIGHT
        ),
        'section_title': ParagraphStyle(
            'SectionTitle',
            parent=base_styles['Normal'],
            fontSize=9,
            textColor=SECONDARY_COLOR,
            fontName='Helvetica-Bold',
            spaceAfter=6,
            spaceBefore=4
        ),
        'payment_title': ParagraphStyle(
            'PayTitle',
            parent=base_styles['Normal'],
            fontSize=9,
            textColor=PRIMARY_COLOR,
            fontName='Helvetica-Bold',
            spaceAfter=4
        ),
        'detail': ParagraphStyle(
            'Detail',
            parent=base_styles['Normal'],
            fontSize=11,
            leading=16
        ),
        'bold_detail': ParagraphStyle(
            'BoldDetail',
            parent=base_styles['Normal'],
            fontSize=11,
            fontName='Helvetica-Bold',
            leading=16
        ),
        'payment_detail': ParagraphStyle(
            'PayDetail',
            parent=base_styles['Normal'],
            fontSize=10,
            leading=15
        ),
        'footer': ParagraphStyle(
            'Footer',
            parent=base_styles['Normal'],
            fontSize=10,
            textColor=SECONDARY_COLOR,
            alignment=TA_CENTER,
            leading=16
        ),
        'normal': base_styles['Normal'],
        'right_text': ParagraphStyle(
            'RightText',
            parent=base_styles['Normal'],
            fontSize=10,
            alignment=TA_RIGHT
        ),
    }
    
    return styles, PRIMARY_COLOR, SECONDARY_COLOR, BG_LIGHT


# ============================================
# Quote PDF Generation
# ============================================

async def generate_quote_pdf(
    quote_data: dict,
    company_info: dict,
    is_modified: bool = False
) -> str:
    """
    Generate a professional quote PDF.
    
    Args:
        quote_data: Quote document from database
        company_info: Company information dict with address, contact, etc.
        is_modified: Whether this is a modified quote or original request
        
    Returns:
        Base64 encoded PDF content
    """
    styles, PRIMARY, SECONDARY, BG_LIGHT = get_styles()
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        topMargin=0.5*inch,
        bottomMargin=0.5*inch,
        leftMargin=0.75*inch,
        rightMargin=0.75*inch
    )
    
    elements = []
    
    # Header with company info
    # Try to load PNG logo from frontend public assets
    logo_img = None
    try:
        # pdf.py -> utils -> backend -> app root
        project_root = Path(__file__).resolve().parents[3]
        logo_path = project_root / "frontend" / "public" / "hampton-logo.png"
        if logo_path.exists():
            logo_img = Image(str(logo_path), width=2.4 * inch, height=0.7 * inch)
    except Exception:
        logo_img = None

    title_text = Paragraph(
        f"<b>{company_info.get('company_name', 'Hampton Scientific Limited')}</b>",
        styles['company_title'],
    )

    header_left = logo_img if logo_img is not None else title_text

    header_data = [
        [
            header_left,
            Paragraph(
                f"<b>{'QUOTATION' if is_modified else 'QUOTE REQUEST'}</b>",
                styles['quote_heading'],
            ),
        ],
        [
            Paragraph("Medical Supplier &amp; Trainer", styles['subtitle']),
            "",
        ],
    ]
    header_table = Table(header_data, colWidths=[3.5*inch, 3.5*inch])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
    ]))
    elements.append(header_table)
    
    # Divider line
    elements.append(Spacer(1, 0.1*inch))
    divider = Table([[''] * 1], colWidths=[7*inch])
    divider.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (-1, 0), 2, PRIMARY),
    ]))
    elements.append(divider)
    elements.append(Spacer(1, 0.2*inch))
    
    # Quote details and customer info side by side
    quote_date = datetime.utcnow().strftime('%B %d, %Y')
    validity = quote_data.get('validity_days', 30) if is_modified else 30
    quote_id = quote_data.get('id', '')[:8].upper()
    
    info_left = f"""
    <b>Quote Reference:</b> {quote_id}<br/>
    <b>Date:</b> {quote_date}<br/>
    <b>Valid For:</b> {validity} days
    """
    
    info_right = f"""
    <b>Bill To:</b><br/>
    {quote_data.get('facility_name', '')}<br/>
    Attn: {quote_data.get('contact_person', '')}<br/>
    {quote_data.get('email', '')}<br/>
    {quote_data.get('phone', '')}
    """
    
    info_data = [[Paragraph(info_left, styles['detail']), Paragraph(info_right, styles['detail'])]]
    info_table = Table(info_data, colWidths=[3.5*inch, 3.5*inch])
    info_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
        ('PADDING', (0, 0), (-1, -1), 12),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#e0e0e0')),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.25*inch))
    
    # Items table
    elements.append(Paragraph("ORDER ITEMS", styles['section_title']))
    table_data = [['#', 'Product Description', 'Qty', 'Unit Price', 'Total']]
    subtotal = 0
    
    for idx, item in enumerate(quote_data.get('items', []), 1):
        if is_modified:
            price = item.get('modified_price') or item.get('original_price', 0) or 0
        else:
            price = item.get('unit_price', 0) or 0
        qty = item.get('quantity', 1)
        line_total = price * qty
        subtotal += line_total
        
        table_data.append([
            str(idx),
            item.get('product_name', ''),
            str(qty),
            f"KES {price:,.0f}",
            f"KES {line_total:,.0f}"
        ])
    
    item_table = Table(table_data, colWidths=[0.4*inch, 3.6*inch, 0.6*inch, 1.1*inch, 1.1*inch])
    item_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('TOPPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('TOPPADDING', (0, 1), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 10),
    ]))
    elements.append(item_table)
    elements.append(Spacer(1, 0.15*inch))
    
    # Totals box
    if is_modified:
        discount = quote_data.get('discount_amount', 0) or 0
        tax_rate = quote_data.get('tax_rate', 0) or 0
        include_vat = quote_data.get('include_vat', True)
        stored_tax = quote_data.get('tax_amount', 0) or 0
        stored_total = quote_data.get('total', subtotal) or subtotal

        tax = stored_tax if include_vat and tax_rate > 0 else 0
        total = stored_total if include_vat else stored_total - stored_tax

        totals_data = [['Subtotal:', f"KES {subtotal:,.0f}"]]
        if discount > 0:
            totals_data.append(['Discount:', f"-KES {discount:,.0f}"])

        # Use clean percentage (no .0) for display
        display_rate = int(tax_rate) if float(tax_rate or 0).is_integer() else tax_rate or 16
        if include_vat and tax_rate > 0:
            vat_label = f"VAT ({display_rate}%):"
        else:
            vat_label = f"Exclusive of {display_rate}% VAT:"
        totals_data.append([vat_label, f"KES {tax:,.0f}"])

        totals_data.append(['TOTAL DUE:', f"KES {total:,.0f}"])
    else:
        totals_data = [['Estimated Total:', f"KES {subtotal:,.0f}"]]
    
    totals_table = Table(totals_data, colWidths=[5*inch, 1.8*inch])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, -1), (-1, -1), 12),
        ('TEXTCOLOR', (0, -1), (-1, -1), PRIMARY),
        ('BACKGROUND', (1, -1), (1, -1), BG_LIGHT),
        ('BOX', (1, -1), (1, -1), 1, PRIMARY),
    ]))
    elements.append(totals_table)
    
    # Terms if modified quote
    if is_modified and quote_data.get('terms_and_conditions'):
        elements.append(Spacer(1, 0.3*inch))
        elements.append(Paragraph("TERMS & CONDITIONS", styles['section_title']))
        elements.append(Paragraph(quote_data.get('terms_and_conditions', ''), styles['detail']))
    
    # Notes
    if quote_data.get('additional_notes') or quote_data.get('notes'):
        elements.append(Spacer(1, 0.2*inch))
        elements.append(Paragraph("NOTES", styles['section_title']))
        elements.append(Paragraph(quote_data.get('additional_notes') or quote_data.get('notes', ''), styles['detail']))
    
    # Footer with company info
    elements.append(Spacer(1, 0.4*inch))
    footer_divider = Table([[''] * 1], colWidths=[7*inch])
    footer_divider.setStyle(TableStyle([('LINEABOVE', (0, 0), (-1, 0), 1, colors.HexColor('#e0e0e0'))]))
    elements.append(footer_divider)
    elements.append(Spacer(1, 0.1*inch))
    elements.append(Paragraph(f"<b>{company_info.get('company_name', 'Hampton Scientific Limited')}</b>", styles['footer']))
    
    footer_parts = []
    if company_info.get('address'): footer_parts.append(company_info['address'])
    if company_info.get('po_box'): footer_parts.append(company_info['po_box'])
    if footer_parts:
        elements.append(Paragraph(" | ".join(footer_parts), styles['footer']))
    
    contact_parts = []
    if company_info.get('phone'): contact_parts.append(f"Phone: {company_info['phone']}")
    if company_info.get('email'): contact_parts.append(f"Email: {company_info['email']}")
    if contact_parts:
        elements.append(Paragraph(" | ".join(contact_parts), styles['footer']))
    
    doc.build(elements)
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode('utf-8')


# ============================================
# Invoice PDF Generation
# ============================================

async def generate_invoice_pdf(
    invoice_data: dict,
    company_info: dict,
    is_paid: bool = False
) -> str:
    """
    Generate a professional invoice PDF.
    
    Args:
        invoice_data: Invoice document from database
        company_info: Company information dict
        is_paid: Whether to add PAID watermark
        
    Returns:
        Base64 encoded PDF content
    """
    styles, PRIMARY, SECONDARY, BG_LIGHT = get_styles()
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        topMargin=0.5*inch,
        bottomMargin=0.5*inch,
        leftMargin=0.6*inch,
        rightMargin=0.6*inch
    )
    
    elements = []
    
    # Header: Company Name + INVOICE side by side
    # Try to load PNG logo from the same location as quotes
    logo_img = None
    try:
        project_root = Path(__file__).resolve().parents[3]
        logo_path = project_root / "frontend" / "public" / "hampton-logo.png"
        if logo_path.exists():
            logo_img = Image(str(logo_path), width=2.4 * inch, height=0.7 * inch)
    except Exception:
        logo_img = None

    title_text = Paragraph(
        company_info.get("company_name", "Hampton Scientific Limited"),
        styles["company_title"],
    )
    header_left = logo_img if logo_img is not None else title_text

    header_data = [
        [
            header_left,
            Paragraph("INVOICE", styles["invoice_heading"]),
        ],
        [
            Paragraph("Medical Equipment Supplier", styles["subtitle"]),
            Paragraph(
                f"<b>#{invoice_data['invoice_number']}</b>",
                ParagraphStyle(
                    "InvNum",
                    parent=styles["normal"],
                    fontSize=12,
                    alignment=TA_RIGHT,
                    fontName="Helvetica-Bold",
                ),
            ),
        ],
    ]
    header_table = Table(header_data, colWidths=[3.5*inch, 3.5*inch])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 0.1*inch))
    elements.append(HRFlowable(width="100%", thickness=2, color=BG_LIGHT, spaceAfter=20))
    
    # PAID watermark
    if is_paid:
        watermark_style = ParagraphStyle(
            'Watermark',
            parent=styles['normal'],
            fontSize=60,
            textColor=colors.Color(0, 0.55, 0.2, alpha=0.15),
            fontName='Helvetica-Bold',
            alignment=TA_CENTER,
            spaceAfter=-50
        )
        elements.append(Spacer(1, 0.1*inch))
        elements.append(Paragraph("PAID", watermark_style))
    
    # Invoice details grid
    created_at = invoice_data.get("created_at", datetime.utcnow())
    due_date = invoice_data.get("due_date")
    issue_date_str = created_at.strftime("%B %d, %Y") if created_at else datetime.utcnow().strftime("%B %d, %Y")
    due_date_str = due_date.strftime("%B %d, %Y") if due_date else "N/A"
    
    bill_to_content = [
        Paragraph("BILL TO", styles['section_title']),
        Paragraph(f"<b>{invoice_data.get('facility_name', '')}</b>", styles['bold_detail']),
        Paragraph(f"Attn: {invoice_data.get('contact_person', '')}", styles['detail']),
        Paragraph(f"{invoice_data.get('email', '')}", styles['detail']),
    ]
    if invoice_data.get('phone'):
        bill_to_content.append(Paragraph(f"Phone: {invoice_data['phone']}", styles['detail']))
    
    inv_details_content = [
        Paragraph("INVOICE DETAILS", styles['section_title']),
        Paragraph(f"<b>Issue Date:</b> {issue_date_str}", styles['detail']),
        Paragraph(f"<b>Due Date:</b> {due_date_str}", styles['detail']),
        Paragraph(f"<b>Terms:</b> {invoice_data.get('payment_terms', 'Net 30')}", styles['detail']),
    ]
    
    details_data = [[bill_to_content, inv_details_content]]
    details_table = Table(details_data, colWidths=[3.5*inch, 3.5*inch])
    details_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(details_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Items table
    table_data = [['Description', 'Qty', 'Unit Price (KES)', 'Total (KES)']]
    for item in invoice_data.get("items", []):
        price = item.get('modified_price') or item.get('original_price', 0) or 0
        qty = item.get('quantity', 1)
        line_total = price * qty
        table_data.append([
            item.get('product_name', ''),
            str(qty),
            f"{price:,.0f}",
            f"{line_total:,.0f}"
        ])
    
    item_table = Table(table_data, colWidths=[3.2*inch, 0.7*inch, 1.4*inch, 1.4*inch])
    item_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('LINEBELOW', (0, 0), (-1, -2), 0.5, colors.HexColor('#eeeeee')),
        ('LINEBELOW', (0, -1), (-1, -1), 1, colors.HexColor('#dddddd')),
    ]))
    elements.append(item_table)
    elements.append(Spacer(1, 0.2*inch))
    
    # Totals
    subtotal = float(invoice_data.get("subtotal", 0)) or 0
    discount_amount = float(invoice_data.get("discount_amount", 0)) or 0
    tax_rate = float(invoice_data.get("tax_rate", 0)) or 0
    tax_amount_stored = float(invoice_data.get("tax_amount", 0)) or 0
    include_vat = invoice_data.get("include_vat", True)
    total_stored = float(invoice_data.get("total", 0)) or 0

    tax_amount = tax_amount_stored if include_vat and tax_rate > 0 else 0
    total = total_stored if include_vat else total_stored - tax_amount_stored
    
    totals_data = [['Subtotal', f"KES {subtotal:,.0f}"]]
    display_rate = int(tax_rate) if float(tax_rate or 0).is_integer() else tax_rate or 16
    if include_vat and tax_rate > 0:
        vat_label = f"VAT ({display_rate}%)"
    else:
        vat_label = f"Exclusive of {display_rate}% VAT"
    totals_data.append([vat_label, f"KES {tax_amount:,.0f}"])
    if discount_amount > 0:
        totals_data.append(['Discount', f"-KES {discount_amount:,.0f}"])
    else:
        totals_data.append(['Discount', '0'])
    totals_data.append(['Total Amount', f"KES {total:,.0f}"])
    
    totals_table = Table(totals_data, colWidths=[4.5*inch, 2.2*inch])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, -1), (-1, -1), 14),
        ('TEXTCOLOR', (0, -1), (-1, -1), PRIMARY),
        ('LINEABOVE', (0, -1), (-1, -1), 2, PRIMARY),
        ('TOPPADDING', (0, -1), (-1, -1), 10),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Payment information – payment terms summary (above bank & M-PESA)
    elements.append(HRFlowable(width="100%", thickness=0, color=colors.white, spaceAfter=0))
    
    # Derive friendly payment terms text from invoice data
    raw_terms = invoice_data.get("payment_terms", "Net 30")
    terms_str = str(raw_terms)
    days_text = None
    try:
        # If numeric (e.g. 30), describe as days from invoice date
        days_val = int(terms_str)
        days_text = f"Payment is due within {days_val} days from the invoice date."
    except (TypeError, ValueError):
        pass
    if not days_text:
        days_text = f"Payment Terms: {terms_str}"
    
    elements.append(Paragraph("PAYMENT TERMS", styles['section_title']))
    elements.append(Paragraph(days_text, styles['payment_detail']))
    elements.append(Spacer(1, 0.15*inch))

    # Bank & M-PESA details from company settings
    elements.append(Paragraph("PAYMENT INFORMATION", styles['section_title']))
    bank_content = [
        Paragraph("BANK", styles['payment_title']),
        Paragraph(f"<b>Bank:</b> {company_info.get('bank_name', '')}", styles['payment_detail']),
        Paragraph(f"<b>Account Name:</b> {company_info.get('bank_account_name', '')}", styles['payment_detail']),
        Paragraph(f"<b>Account Number:</b> {company_info.get('bank_account_number', '')}", styles['payment_detail']),
    ]
    mpesa_content = [
        Paragraph("LIPA NA MPESA", styles['payment_title']),
        Paragraph(f"<b>Paybill Number:</b> {company_info.get('mpesa_paybill', '')}", styles['payment_detail']),
        Paragraph(f"<b>Account Number:</b> {company_info.get('mpesa_account_number', '')}", styles['payment_detail']),
        Paragraph(f"<b>Account Name:</b> {company_info.get('mpesa_account_name', '')}", styles['payment_detail']),
    ]
    
    payment_data = [[bank_content, mpesa_content]]
    payment_table = Table(payment_data, colWidths=[3.5*inch, 3.5*inch])
    payment_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ('RIGHTPADDING', (0, 0), (-1, -1), 15),
    ]))
    elements.append(payment_table)
    elements.append(Spacer(1, 0.2*inch))
    
    # Thank you
    elements.append(Paragraph(f"Thank you for choosing {company_info.get('company_name', 'Hampton Scientific Limited')}.", styles['detail']))
    elements.append(Spacer(1, 0.3*inch))
    
    # Footer
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#eeeeee'), spaceAfter=12))
    elements.append(Paragraph(f"<b>{company_info.get('company_name', 'Hampton Scientific Limited')}</b>", styles['footer']))
    
    footer_parts = []
    if company_info.get('address'): footer_parts.append(company_info['address'])
    if company_info.get('po_box'): footer_parts.append(company_info['po_box'])
    if footer_parts:
        elements.append(Paragraph(" | ".join(footer_parts), styles['footer']))
    
    contact_parts = []
    if company_info.get('phone'): contact_parts.append(f"Phone: {company_info['phone']}")
    if company_info.get('email'): contact_parts.append(f"Email: {company_info['email']}")
    if contact_parts:
        elements.append(Paragraph(" | ".join(contact_parts), styles['footer']))
    
    doc.build(elements)
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode('utf-8')