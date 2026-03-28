# Hampton Scientific Limited - Website PRD

## Product Overview
A modern informational website for Hampton Scientific Limited, a supplier and trainer of medical and laboratory equipment.

## Color Scheme
- Primary: #006332 (Scientific Green)
- Complementary: Black and White theme
- Font: Space Grotesk

## Core Pages
- Home, Products, Training, About, Get In Touch

## Key Features

### 1. Product Catalog
- Dynamic, database-driven catalog with toggle select behavior
- "Select to request quote" — click to select (active state), click again to deselect
- Prices hidden from customers (admin adds during quoting)
- Admin product management with bulk CSV import (with Data Requirements legend) & image uploads
- Fuzzy search, category filtering

### 2. Quote Negotiation Workflow
- **Status Flow**: Pending → Quoted → Approved → Invoiced
- **Stakeholder (Ball-in-Court) System**:
  - `ADMIN_REVIEW`: Admin's turn to review/set prices
  - `CUSTOMER_REVIEW`: Customer's turn to accept/negotiate
  - `LOCKED_APPROVED`: Quote is approved, no editing
- **Quote Revisions**: Every price change is saved as a snapshot in `quote_revisions`
- **Discount Persistence**: Discount amounts persist through negotiation rounds
- **Customer Proposed Prices**: Shown in amber in Admin's Quote Detail panel
- **Real-time Calculations**: Subtotal, discount, tax, grand total update live in Modify Quote panel
- **Locking**: Non-current stakeholder cannot edit
- Customer accepts → status = "approved", handler = LOCKED_APPROVED
- Customer negotiates → handler = ADMIN_REVIEW (back to admin)
- Admin modifies → handler = CUSTOMER_REVIEW (back to customer)

### 3. User Authentication
- Role-based: customers + admin
- Admin login at `/sysadmin` with 15-min inactivity timeout
- JWT-based auth

### 4. Admin Dashboard
- **Left vertical sidebar navigation** (always expanded, 240px)
- 8 Tabs: Overview, Analytics, Quotes, Invoices, Users, Products, Categories, Settings
- **All modals are right-side slide-out panels** (100vh height, 40vw width)
- Settings sub-tabs: Site Info, Payment Info, Email Follow-Ups
- Category Management: full CRUD (Create, Read, Update, Delete)
- **Empty States**: All tabs show "No [Entity] Yet" + "Create New" button, or "No matching records" + "Clear Filters"
- Data cleanup endpoint for admin

### 5. User Profile Page
- **Left vertical sidebar navigation**: My Profile, Company Info, Quote History, Invoices
- Quote response: Accept or Negotiate only (Reject removed)
- Slide-out panel for quote response with real-time calculations
- **Invoices tab**: View and download invoices as PDF
- Stakeholder-based locking (can only respond when it's your turn)

### 6. AI Chatbot
- Powered by Emergent LLM (OpenAI)

### 7. Email System
- Automated emails via Resend for all major events
- Initial "Request Received" email: NO pricing shown
- Larger email body font sizes (16px)
- "View Your Account" profile link in email footer
- Automated follow-ups for pending quotes and invoices (configurable)
- PDF quotes/invoices attached to emails

### 8. PDF Generation
- Professional HTML-based templates with company branding
- "PAID" watermark on paid invoices
- Dynamic payment information from admin settings

## Technical Stack
- **Frontend**: React, Tailwind CSS, Shadcn/UI, Axios
- **Backend**: FastAPI, Pydantic, Motor, JWT, RBAC, apscheduler
- **Database**: MongoDB
- **Integrations**: emergentintegrations (chatbot), Resend (email), reportlab (PDF)

## DB Schema
- **users**: `{..., role: 'admin' | 'customer'}`
- **products**: `{product_id, name, category_id, price, ...}`
- **product_categories**: `{category_id, name, description, ...}`
- **quotes**: `{..., status, current_handler: 'ADMIN_REVIEW' | 'CUSTOMER_REVIEW' | 'LOCKED_APPROVED', discount_amount, tax_rate, subtotal, total}`
- **quote_revisions**: `{quote_id, revised_by, item_prices, discount_amount, total, timestamp}`
- **invoices**: `{id, quote_id, invoice_number, status: 'unpaid' | 'paid', ...}`
- **settings**: `{contact_info, social_media, payment_info, ...}`
- **email_logs**: `{type, recipient, status, timestamp}`
- **follow_up_settings**: `{quote_follow_up_enabled, ...}`

## Credentials
- Admin: admin@hamptonscientific.com / Admin123! (at /sysadmin)
- Test Customer: john@hospital.com / TestPass123

---

## Implementation History

### Phase 1 - Core Application (Jan 2026)
- Home, Products, Training, About, Contact pages
- Product catalog with categories and search
- User registration and login
- Admin dashboard with all management features
- Quote request and management workflow
- AI Chatbot integration
- Custom 404 page

### Phase 2 - Quote/Invoice Workflow (Feb 2026)
- Full quote-to-invoice workflow
- PDF generation for quotes and invoices
- Email notifications for all events
- Admin pricing and quote modification
- Mark as Paid functionality
- Dynamic payment settings

### Phase 3 - UI Overhaul (Feb 23, 2026)
- Admin Dashboard: horizontal tabs → left vertical sidebar
- Profile Page: left vertical sidebar navigation
- All modals → right-side slide-out panels
- "Approved" status added to workflow
- Category Management: full CRUD
- Removed "Reject" button from profile

### Phase 4 - Negotiation Workflow & Catalog (Feb 24, 2026)
- **Quote Negotiation**: current_handler (ball-in-court) system
- **Quote Revisions**: Version history stored in quote_revisions
- **Discount Persistence**: Discount amounts persist through rounds
- **Admin View**: Customer proposed prices shown in amber
- **Real-time Calculations**: Subtotal/discount/tax/total update live
- **Product Catalog**: "Select to request quote" toggle behavior
- **CSV Upload**: Data Requirements legend with field specs
- **Empty States**: Unified across Products, Users, Quotes, Invoices, Categories
- **Profile Invoices Tab**: Customers can view/download their invoices
- **Email Improvements**: Removed pricing from initial email, larger fonts, profile link in footer
- **Header Cleanup**: Removed "Admin Dashboard" overlay text

## Backlog (Priority Order)
- P1: Company Information centralized settings (DB-driven for emails/PDFs)
- P1: Category identifier change from ID to Name
- P2: Export Analytics Reports to PDF
- P3: Multi-language support (i18n)
- P3: Further refactoring of server.py into separate routers

---
*Last Updated: February 24, 2026*
