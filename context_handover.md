# ATS Automation QIS — Context Handover Document

> **Purpose:** This document provides full context for continuing development of this project.  
> **Last Updated:** 2026-08-26  
> **Project Path:** `c:\Users\offic\Desktop\qis`

---

## 1. Project Overview

**ATS Automation QIS** (Quotation & Invoice System) is a self-hosted Flask web application for **ATS Automation**, a Gate Automation & Security Solutions company based in Mumbai. The app manages the full client billing lifecycle — quotations, invoices, PDF generation, and client management.

### Tech Stack
| Component | Technology |
|---|---|
| **Backend** | Python 3, Flask |
| **Database** | SQLite via SQLAlchemy |
| **Auth** | Flask-Login |
| **PDF Engine** | xhtml2pdf |
| **Frontend** | Jinja2 templates, Bootstrap 5, vanilla JS |
| **PWA** | Service Worker + manifest.json |
| **Styling** | Custom CSS design system (`static/css/style.css`) |

### Key Dependencies (`requirements.txt`)
```
Flask, Flask-SQLAlchemy, Flask-Login, Werkzeug, qrcode[pil], xhtml2pdf, python-dotenv
```

### Running the App
```bash
cd c:\Users\offic\Desktop\qis
python app.py
# Runs on http://127.0.0.1:5000
# Default login: admin / ats2024
```

---

## 2. Project Structure

```
c:\Users\offic\Desktop\qis\
├── app.py                    # App factory, migrations, blueprint registration
├── config.py                 # Config (DB: instance/ats.db)
├── models.py                 # SQLAlchemy models (all 7 models)
├── wsgi.py                   # WSGI entry point
├── requirements.txt
├── ats_logo.png              # Original ATS logo (high-res source)
├── FORTIS HOSPITAL_page-0001.jpg  # ⭐ REFERENCE INVOICE DESIGN (must match this)
├── QIS_USER_GUIDE.md
├── DB_OPERATIONS.md
│
├── routes/
│   ├── __init__.py
│   ├── auth.py               # Login/logout
│   ├── dashboard.py          # Dashboard with stats
│   ├── clients.py            # Client CRUD + CSV export
│   ├── services.py           # Service catalog CRUD
│   ├── invoices.py           # Invoice CRUD, PDF, CSV export
│   ├── quotations.py         # Quotation CRUD, PDF, convert-to-invoice, CSV
│   └── settings.py           # Company profile settings
│
├── templates/
│   ├── base.html             # Main layout (sidebar, topbar)
│   ├── dashboard.html
│   ├── settings.html
│   ├── auth/login.html
│   ├── clients/ (list, form, detail)
│   ├── services/ (list, form)
│   ├── invoices/ (list, create, edit, view, pdf_template)
│   ├── quotations/ (list, create, edit, view, pdf_template)
│   └── letterhead/           # (exists but empty - needs template)
│
├── static/
│   ├── css/style.css         # Full design system (1017 lines)
│   ├── js/app.js             # Theme toggle, toasts, utils
│   ├── js/sw.js              # Service worker
│   ├── img/
│   │   ├── logo.png          # Current app logo (used in sidebar, PDFs)
│   │   ├── icon-192x192.png  # PWA icon
│   │   └── icon-512x512.png  # PWA icon
│   ├── manifest.json
│   └── offline.html
│
└── instance/
    └── ats.db                # SQLite database (auto-created)
```

---

## 3. Database Models (models.py)

### CompanyProfile (Singleton)
Company settings for PDF generation and app branding.
```
name, tagline, email, phone, address,
upi_id, upi_name, bank_name, bank_account, bank_ifsc, bank_branch,
gst_number, msme_number, stamp_image (base64),
default_gst_percent (default 18.0),
default_terms, default_quotation_terms, default_due_days
```

### Client
```
name, company_name, email, phone, address, gst_number,
created_at, is_archived
```

### Service (Catalog)
```
name, description, hsn_code, base_price
```

### Invoice
```
invoice_number (ATS-INV-YYYY-NNN), client_id, date_created, due_date,
sub_total, discount, discount_type, discount_amount,
gst_percent, gst_amount, total_amount,
advance_amount, status, payment_mode, notes, is_archived,
ref_quotation_number,
subject, delivery_address, payment_terms, voucher_number
```

### InvoiceItem
```
invoice_id, service_name, hsn_code, description, quantity, rate, amount
```

### Quotation
```
quotation_number (ATS-QT-YYYY-NNN), client_id, date_created,
valid_until, estimated_timeline,
sub_total, discount, discount_type, discount_amount,
gst_percent, gst_amount, total_amount,
status (Draft/Sent/Accepted/Declined/Invoiced/Expired),
notes, is_archived,
subject, delivery_address, payment_terms
```

### QuotationItem
```
quotation_id, service_name, hsn_code, description, quantity, rate, amount
```

---

## 4. Key Business Logic

### GST Calculation Flow
```
Subtotal - Discount = Net Amount → Net × GST% = GST Amount → Net + GST = Grand Total
```
For invoices: `Grand Total - Advance = Balance Due`

### _calc_totals() (in both invoices.py and quotations.py)
```python
def _calc_totals(sub_total, discount_val, discount_type, gst_percent=0.0):
    # Returns: (disc_amt, gst_amt, total)
```

### _build_invoice_items() / _build_quotation_items()
Processes form lists into item objects. Accepts `item_hsns` parameter for HSN codes.

### Auto-fill Chain (JS in create/edit forms)
```
Service Selected → Name + Rate + HSN Code auto-populated from catalog
```

### Quotation → Invoice Conversion
`quotations.py: convert_to_invoice()` carries over all fields including subject, delivery_address, payment_terms, gst_percent, gst_amount, and per-item hsn_code.

### DB Migrations
Done via `try-except` blocks with `ALTER TABLE` in `app.py` `run_migrations()` function. No Alembic — raw SQL with `text()` from sqlalchemy.

---

## 5. Branding & Design

| Element | Value |
|---|---|
| **Company** | ATS Automation |
| **Tagline** | Security & Systems |
| **Theme Color** | `#007acc` (ATS Blue) |
| **Dark Mode** | Full support, logo gets white bg in dark mode |
| **Font** | Lexend (Google Fonts) |
| **Invoice Prefix** | `ATS-INV-YYYY-NNN` |
| **Quotation Prefix** | `ATS-QT-YYYY-NNN` |
| **Old Branding** | "Brightlant" — fully replaced with "ATS Automation" everywhere |

### CSS Design System (`static/css/style.css`)
Uses CSS variables (`--inf-*` prefix) for theming. Key variables:
- `--inf-primary: #007acc` (light), `#33a3d9` (dark)
- Full light/dark theme via `[data-theme="dark"]`
- Glassmorphism cards with `.inf-card`

---

## 6. Work Completed (Phases 1-3 + Pre-Phase 4 Cleanup)

### Phase 1: Database & Model Updates ✅
- All new columns added to CompanyProfile, Client, Service, Invoice, InvoiceItem, Quotation, QuotationItem
- Safe migrations in app.py
- CompanyProfile defaults set to ATS Automation info

### Phase 2: Branding & Identity Swap ✅
- config.py: DB renamed to `ats.db`, new secret key
- base.html: Meta, PWA title, sidebar → ATS Automation
- manifest.json: App name → ATS QIS
- Invoice/Quotation number prefixes → ATS-INV / ATS-QT
- Logo replaced with ATS logo (+ PWA icons)
- style.css: All colors → `#007acc` ATS blue
- Dark mode logo fix (white background)

### Phase 3: Forms & Routes Update ✅
- **3.1 Settings:** GST No, MSME No, Stamp upload, Default GST%
- **3.2 Clients:** GST Number field in add/edit/detail
- **3.3 Invoice Create/Edit:** Subject, Delivery Address, Payment Terms, Voucher No, GST%, HSN per item, live JS GST calculation
- **3.4 Quotation Create/Edit:** Same fields as invoice (minus voucher_number), HSN, GST
- **3.5 GST Calculation Logic:** Done in both invoices.py and quotations.py `_calc_totals()`
- **3.6 Quotation → Invoice Conversion:** All new fields carry over

### Pre-Phase 4 Cleanup ✅
- All "Brightlant" references replaced with "ATS Automation" across entire project (zero remaining)
- Documentation files (QIS_USER_GUIDE.md, DB_OPERATIONS.md) updated

---

## 7. REMAINING WORK — Phase 4, 5, 6

### Phase 4: PDF Redesign — Invoice ← START HERE

> **CRITICAL:** The reference invoice design is at `FORTIS HOSPITAL_page-0001.jpg` in project root. The PDF must match this design.

#### Task 4.1: Blue Swoosh Header Decoration — SKIPPED
**Decision made:** Use inline SVG/CSS code in the PDF template instead of a PNG image. Better approach (no file dependency, scales perfectly).

#### Task 4.2: Invoice PDF Template Redesign ← NEXT TASK
**File:** `templates/invoices/pdf_template.html`
**PDF engine:** xhtml2pdf (limited CSS support — no flexbox/grid, uses `<table>` layouts)
**Logo base64:** Passed as `logo_base64` variable to template
**Company profile:** Passed as `profile` variable

The current template exists but needs COMPLETE redesign to match the reference:

```
┌──────────────────────────────────────────────────────┐
│ [ATS Logo]                     [Blue swoosh SVG]      │  ← LETTERHEAD HEADER
│                                                      │
│                    GARAGE DOOR                       │  ← Subject title (bold, blue, centered)
│                                                      │
│ TO,                    INVOICE NO:-        Date:-     │
│ Client name            Voucher no                    │
│ Client address         PaymentTerm: xxx              │
│                        Delivery:- address            │
│ K/A: Contact person    GST NO. client gst            │
│                                                      │
│ ┌──────┬───────────┬───────┬──────┬──────┬─────────┐ │
│ │SR.NO.│ Particular│HSN NO.│ QTY. │ RATE │ AMOUN T │ │  ← Items table
│ ├──────┼───────────┼───────┼──────┼──────┼─────────┤ │
│ │ 1.   │ Item desc │998719 │  1   │53223 │ 53223/- │ │
│ └──────┴───────────┴───────┴──────┴──────┴─────────┘ │
│                              SUBTOTAL │  79557/-/-   │
│                              GST@18%  │  14320/-     │
│ GST IN NO: 27BTHPT0851K1Z9           │              │
│ CompanyName: ATS AUTOMATION           │              │
│ Bank Details: HDFC BANK      Grand    │  93877/-     │
│ Branch: KANDIVALI (E)        Total    │              │
│ A/C No: 50200097301710                │              │
│ IFSC Code: HDFC0000182   For ATS AUTOMATION          │
│ MSME: UDYAM-MH-170148612    [STAMP IMAGE]           │
│                           Authorized Signatory       │
│                                                      │
│ Signature: ___________                               │
│ Person Name: _________                               │
│                                                      │
│ ┌──────────────────────────────────────────────────┐ │
│ │ email    │  website   │ phone │ address          │ │  ← Blue footer bar
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

**Important xhtml2pdf notes:**
- Use `<table>` based layouts (no flexbox/grid)
- `@page` directive for page size and margins
- Images must be base64 embedded
- Limited CSS — stick to basic properties
- Use `font-family: Helvetica, Arial, sans-serif`

#### Task 4.3: Update Invoice View Page
**File:** `templates/invoices/view.html`
Show new fields (subject, delivery, GST breakdown, HSN, voucher) in the web view page.

---

### Phase 5: PDF Redesign — Quotation + Letterhead

#### Task 5.1: Quotation PDF Template
**File:** `templates/quotations/pdf_template.html`
Same letterhead header/footer as invoice, quotation-specific fields (validity, timeline), GST + HSN columns.

#### Task 5.2: Quotation View Page
**File:** `templates/quotations/view.html`
Show new fields in web view.

#### Task 5.3: Blank Letterhead PDF (NEW)
- **NEW** `routes/letterhead.py` — Blueprint with `/letterhead/download` route
- **NEW** `templates/letterhead/pdf_template.html` — Same header/footer, blank body
- Register blueprint in `app.py`
- Add "Download Letterhead" button somewhere accessible

---

### Phase 6: Polish, Test & Handover

#### 6.1: Dashboard — Any remaining hardcoded text fixes
#### 6.2: Verify `#007acc` theme consistency + dark mode
#### 6.3: CSV Export Updates
- Add GST, HSN, subject columns to invoice/quotation CSV exports
- Add GST to client CSV export
#### 6.4: WhatsApp/Email sharing message updates
#### 6.5: Full testing checklist (see implementation plan)
#### 6.6: Cleanup — delete old DB, update docs, final sweep

---

## 8. Reference Invoice Design Description

The file `FORTIS HOSPITAL_page-0001.jpg` in the project root is the **reference design** that the invoice PDF must match. Key design elements:
- **Header:** ATS logo (left) + blue swoosh curves (top-right corner)
- **Subject:** Large bold blue text centered (e.g., "GARAGE DOOR")
- **Client info (left):** TO, client name, address, K/A contact person
- **Invoice meta (right):** Invoice No, Date, Voucher no, Payment Term, Delivery, GST No
- **Items table:** SR.NO. | Particular | HSN NO. | QTY. | RATE | AMOUNT
- **Totals (right-aligned):** SUBTOTAL, GST@18%, Grand Total
- **Bank details (bottom-left):** GST IN NO, CompanyName, Bank, Branch, A/C, IFSC, MSME
- **Signature area (bottom-right):** "For ATS AUTOMATION", stamp image, "Authorized Signatory"
- **Customer signature:** "Signature: ____" and "Person Name: ____"
- **Footer bar:** Blue background with email, website, phone, address

---

## 9. Key ATS Company Details (from reference)

| Field | Value |
|---|---|
| **Company Name** | ATS AUTOMATION |
| **GST IN NO** | 27BTHPT0851K1Z9 |
| **Bank** | HDFC BANK |
| **Branch** | KANDIVALI (E) |
| **A/C No** | 50200097301710 |
| **IFSC** | HDFC0000182 |
| **MSME** | UDYAM-MH-170148612 |
| **Email** | info@atsautomation.in |
| **Website** | www.atsautomation.in |
| **Phone** | +91-9967399864, +91-8454068378 |
| **Address** | Main St, Nallasopara East, Vasai Virar, Maharashtra 401209 |

> Note: These details are stored in CompanyProfile (settings page) and pulled dynamically for PDFs. The above are reference values.

---

## 10. User Preferences & Rules

1. **One task at a time** — User prefers completing one task before moving to next
2. **Code-only design** — User agreed to use inline SVG/CSS for decorative elements instead of PNG images
3. **Hinglish communication** — User communicates in Hindi-English mix
4. **Do what is best** — User trusts developer judgment for technical decisions
5. **Database name** — `ats.db` (not `ats_automation.db`)
6. **Theme color** — `#007acc` (ATS blue)
7. **No test suite** — Project has no automated tests; manual verification only

---

## 11. Files Most Likely to be Modified Next

| Priority | File | What Needs Doing |
|---|---|---|
| **1** | `templates/invoices/pdf_template.html` | Complete redesign to match reference |
| **2** | `templates/invoices/view.html` | Show new fields in web view |
| **3** | `templates/quotations/pdf_template.html` | Same redesign as invoice |
| **4** | `templates/quotations/view.html` | Show new fields |
| **5** | `routes/letterhead.py` (NEW) | New blueprint for blank letterhead |
| **6** | `templates/letterhead/pdf_template.html` (NEW) | Letterhead PDF template |
| **7** | `app.py` | Register letterhead blueprint |
| **8** | `routes/invoices.py` | CSV export update |
| **9** | `routes/quotations.py` | CSV export update |
| **10** | `routes/clients.py` | CSV export update |

---

## 12. How to Verify Changes

```bash
# Start the app
cd c:\Users\offic\Desktop\qis
python app.py

# Open in browser
# http://127.0.0.1:5000
# Login: admin / ats2024

# Test PDF generation
# Create/view an invoice → click "Download PDF"
# The PDF should match FORTIS HOSPITAL_page-0001.jpg design
```

---

*This handover document was created on 2026-08-26 to enable seamless project continuation.*
