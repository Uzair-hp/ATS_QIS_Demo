# ATS Automation QIS — Context Handover Document

> **Purpose:** This document provides full context for continuing development of this project.  
> **Last Updated:** 2026-10-08  
> **Project Path:** `D:\Brightlant-Work\ATS-QIS`

---

## 1. Project Overview

**ATS Automation QIS** (Quotation & Invoice System) is a self-hosted Flask + React web application for **ATS Automation**, a Gate Automation & Security Solutions company based in Mumbai. The app manages the full client billing lifecycle — quotations, invoices, PDF generation, and client management.

### Tech Stack
| Component | Technology |
|---|---|
| **Backend** | Python 3, Flask (REST API, JSON only) |
| **Database** | SQLite via SQLAlchemy |
| **Auth** | Flask-Login + CSRF token on unsafe methods |
| **Server PDF Engine** | xhtml2pdf (limited CSS subset) |
| **Frontend** | React 18, Vite 5, react-router, Axios, Bootstrap 5 |
| **Browser Print** | react-to-print, driving `print.css` |
| **PWA** | Service Worker + manifest.json |
| **Styling** | `frontend/src/styles/style.css` (app) + `print.css` (A4 sheet) |
| **Tests** | pytest (backend), vitest (frontend libs) |

### Key Dependencies
```
backend/requirements.txt  Flask, Flask-SQLAlchemy, Flask-Login, Werkzeug,
                          qrcode[pil], xhtml2pdf, python-dotenv, flask-cors, pytest
frontend/package.json     react, react-dom, react-router-dom, axios,
                          react-to-print, vite, vitest
```

### Running the App
```powershell
# Terminal 1 - API on :5000
cd backend; python app.py

# Terminal 2 - Vite dev server on :3000, proxies /api to :5000
cd frontend; npm run dev
# Open http://localhost:3000/app/
# Default login: admin / ats@2026

# Tests
cd backend  && pytest
cd frontend && npm test
```

### Two independent print pipelines
This is the single most important thing to know before changing print code.

| | Browser print sheet | Server-rendered PDF |
|---|---|---|
| Trigger | "Print / Save as PDF" on a quotation or invoice | "Download PDF" |
| Layout | `frontend/src/styles/print.css` + `components/print/*` | `templates/_pdf_base.html` + `_pdf_style.html` |
| Renderer | Chrome, via `react-to-print` | `xhtml2pdf` |
| Fidelity | Matches FORTIS HOSPITAL reference closely | Same palette and layout; Helvetica/Georgia fonts |

Both render the same artwork: the browser sheet's SVG swoosh and CSS gradients
are pre-rendered to PNG by `backend/tools/render_assets.py` for the server path,
because xhtml2pdf drops both.

They are **not** kept in sync automatically. If you change one, check the other.

---

## 2. Project Structure

```
D:\Brightlant-Work\ATS-QIS\
├── backend/                        Flask REST API (JSON responses only)
│   ├── app.py                      App factory, migrations, SPA serving under /app
│   ├── config.py                   Config (dev / production), DB path
│   ├── models.py                   SQLAlchemy models
│   ├── wsgi.py                     WSGI entry point
│   ├── requirements.txt
│   ├── routes/
│   │   ├── auth.py                 Login/logout/me, CSRF token issue
│   │   ├── dashboard.py            Dashboard stats
│   │   ├── clients.py              Client CRUD + CSV export
│   │   ├── services.py             Service catalog CRUD
│   │   ├── invoices.py             Invoice CRUD, PDF, UPI QR, CSV, convert
│   │   ├── quotations.py           Quotation CRUD, PDF, CSV, duplicate, convert
│   │   ├── settings.py             Company profile + stamp upload validation
│   │   ├── letterhead.py           Blank letterhead PDF download
│   │   ├── pdf_assets.py           Cached base64 for logo/swoosh/footer
│   │   └── validation.py           Shared input validation
│   ├── templates/                  PDF templates ONLY — no page templates
│   │   ├── _pdf_base.html          Shared macros (header, footer, bank, sig)
│   │   ├── _pdf_style.html         Shared stylesheet (must be included, not
│   │   │                           imported — see §7.1)
│   │   ├── invoices/pdf_template.html
│   │   ├── quotations/pdf_template.html
│   │   └── letterhead/pdf_template.html
│   ├── tools/
│   │   └── render_assets.py        Renders the decorative PNGs
│   ├── static/img/                 logo.png, swoosh.png, footer.png,
│   │                               watermark.png, PWA icons
│   ├── tests/                      pytest suite (60 tests)
│   │   ├── conftest.py             app/client/login/sample fixtures
│   │   ├── test_calc_totals.py     totals maths
│   │   ├── test_pdf.py             PDF endpoint smoke tests
│   │   ├── test_pdf_templates.py   styling, escaping, artwork
│   │   ├── test_pdf_assets.py      decorative PNGs exist and are valid
│   │   ├── test_letterhead.py      blank letterhead PDF
│   │   ├── test_csv_exports.py     export headers and values
│   │   └── test_settings.py        stamp upload validation
│   └── instance/ats.db             SQLite database (auto-created)
│
├── frontend/                       React SPA (Vite)
│   ├── vite.config.js              base '/app/', dev proxy, vitest config
│   ├── public/assets/              logo.png, watermark.svg
│   ├── tools/                      PIL measurement scripts (dev only)
│   └── src/
│       ├── api/client.js           Axios instance (baseURL /api, 401 interceptor)
│       ├── components/
│       │   ├── Layout.jsx          Sidebar + topbar
│       │   ├── ProtectedRoute.jsx
│       │   ├── DocumentPrint.jsx   Composes the A4 sheet (quotation or invoice)
│       │   └── print/              Header, PartyDetails, ItemsTable, Totals,
│       │                          BankDetails, SignatureBlock, Footer
│       ├── context/                AuthContext, ToastContext
│       ├── lib/
│       │   ├── quotation.js        Totals maths + normaliser + formatters
│       │   ├── quotationMapper.js  Quotation payload -> sheet shape
│       │   ├── invoiceMapper.js    Invoice payload -> sheet shape
│       │   ├── geometry.js         Measured column positions from FORTIS
│       │   └── __tests__/          vitest suite (53 tests)
│       ├── pages/                  One file per screen, incl.
│       │                          QuotationPrintPage / InvoicePrintPage
│       └── styles/
│           ├── style.css           App design system
│           └── print.css           A4 quotation sheet (mm-positioned)
│
├── ats_logo.png                     Original ATS logo (high-res source)
├── FORTIS HOSPITAL_page-0001.jpg   ⭐ REFERENCE DESIGN for the print sheet
├── QIS_USER_GUIDE.md
└── work_to_be_done.md              Audit + remaining work list
```

### Frontend print data flow
```
GET /api/quotations/:id   ─┐                    ┌─ mapQuotationForPrint()
GET /api/invoices/:id     ─┼─> normaliseQuotation() ┤  (quotationMapper.js)
GET /api/settings/        ─┘  (quotation.js)      └─ mapInvoiceForPrint()
                                                     (invoiceMapper.js)
          └─> <DocumentPrint document={...} />
                 └─> computeTotals() -> sub-components
```
`DocumentPrint` serves both document types; the only real differences are
`docLabel` ("QUOTATION NO:-" vs "INVOICE NO:-"), `voucherNo` (invoices only) and
the title. `view_quotation` returns only five `profile` fields, so bank details,
GSTIN, MSME and the stamp come from `/api/settings/` in both cases.

`computeTotals` prefers the API's stored totals (`sub_total`, `gst_amount`,
`total_amount`) over recomputing them, so the printed sheet always agrees with
the record and with the server-rendered PDF. `backend/tests/test_calc_totals.py`
and `frontend/src/lib/__tests__/quotation.test.js` pin both sides.

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

### CSS Design System (`frontend/src/styles/style.css`)
Uses CSS variables (`--inf-*` prefix) for theming. Key variables:
- `--inf-primary: #007acc` (light), `#33a3d9` (dark)
- Full light/dark theme via `[data-theme="dark"]`
- Glassmorphism cards with `.inf-card`

### Print sheet palette (`frontend/src/styles/print.css`)
Separate from the app theme. Sampled from the FORTIS reference:
`#15588f` navy, `#2aa6dc` light blue, `#00acec` title, `#5f1f1f` maroon
("For" line), `#3f9bda` footer rule.

---

## 6. Work Completed

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
- Documentation files (QIS_USER_GUIDE.md, context_handover.md) updated

### Phase 4: Decoupled Flask API + React SPA ✅
- `backend/` returns JSON only; all page templates removed
- `frontend/` React 18 + Vite SPA with a design system, router and Axios client
- Flask serves `frontend/dist` under `/app`, so one process serves everything
- Centralised 401 interceptor; CSRF token issued by `GET /api/auth/me`

### Phase 5: FORTIS-aligned quotation print sheet ✅
- `styles/print.css` + `components/print/*`, every offset measured from the
  reference at 300 dpi
- Live data wired through `quotationMapper.js` → `normaliseQuotation`
- Company stamp plumbed as base64 from `/api/settings/`, MIME sniffed
- Flow-based pagination with a repeating `<thead>` and fixed page chrome

### Phase 6: Correctness, tests and exports ✅
- Backend PDF templates rebuilt on shared macros; decorative PNG artwork
- Blank letterhead PDF (`GET /api/letterhead/download`)
- Invoice print page added; `DocumentPrint.jsx` backs both document types
- Backend totals now authoritative for the print sheet (no rounding divergence)
- Discount rows use explicit classes, not `:nth-child`
- Stamp upload validated (magic bytes sniffed, 2 MB cap) and no bundled
  fallback stamp, so one company's seal cannot print on another's quote
- 60 pytest + 53 vitest tests
- CSV exports extended to the full column set

---

## 7. PDF Engine Constraints — Why The Templates Look Like This

Recorded here because every one of these fails **silently**. xhtml2pdf returns
success and renders a document that is quietly missing something.

Verified against this venv: xhtml2pdf 0.2.21, reportlab 5.0.1, svglib 2.2.0,
`renderPM` **not installed**.

| Input | Result |
|---|---|
| `<img src="data:image/png;base64,…">` | renders |
| `<img src="data:image/svg+xml;base64,…">` | **dropped, no error** |
| inline `<svg>` element | **dropped, no error** |
| CSS `linear-gradient` | ignored |
| `<style>` inside an `{% import %}`ed template | **dropped, no error** |
| a class on a `<tr>` | **ignored, no error** |
| a second class on a `<td>` | **ignored, no error** |
| a zero-height `<div>` carrying only `border-bottom` | collapses to nothing |

Consequences, each of which looks like an arbitrary choice otherwise:

- The swoosh, the three-box footer and the watermark are **pre-rendered PNGs**
  from `tools/render_assets.py`. Regenerate with
  `python -m tools.render_assets` after changing any of them.
- The stylesheet lives in `_pdf_style.html` and is `{% include %}`d, never
  imported. `{% import %}` exposes macros but does not render the imported body.
- The grand-total fill is stated inline via `grand_cell()`, not via a class.
- Letterhead writing lines are table rows, not divs.
- Anything that must not vanish is asserted in `tests/test_pdf_templates.py`.

The browser print sheet is unaffected — Chrome renders SVG and gradients.

---

## 8. Print Feature Status

### 8.1 Backend PDF redesign ✅ Done

Both templates `{% import %}` shared macros from `_pdf_base.html` and
`{% include %}` `_pdf_style.html`. The quotation PDF had no GST line, bank
block, stamp or signature block; all four are now present.

### 8.2 Frontend invoice print page ✅ Done

`InvoicePrintPage.jsx` + `invoiceMapper.js` are in place, and `InvoiceView.jsx`
carries a "Print / Save as PDF" link. `DocumentPrint.jsx` now backs both routes,
so the layout has one implementation rather than two.

### 8.3 Blank letterhead PDF ✅ Done

`GET /api/letterhead/download` — `routes/letterhead.py` plus
`templates/letterhead/pdf_template.html`, sharing the header/footer from 7.1.
Linked from the sidebar under System.

### 8.4 Manual QA sweep — still open

The checklist in `work_to_be_done.md` §3.7. The automated tests cover totals,
PDF validity, CSV headers and stamp validation; visual alignment to FORTIS and
dark mode / responsive behaviour still need a human.

Two things worth a look first:

- **Fonts in the server PDFs.** They use Helvetica/Georgia, not Calibri/Cambria.
  xhtml2pdf registers fonts by name and the originals were not reliably
  available. The browser sheet is unaffected.
- **A JPEG stamp, end-to-end.** It is the only asset both print pipelines read
  differently, so it is the most likely place for them to disagree.

---

## 9. Reference Design Description

`FORTIS HOSPITAL_page-0001.jpg` in the project root is the reference the
quotation print sheet is measured against. Key elements:

- **Header:** white card holding the logo, navy/light-blue swoosh across the top
- **Title:** the subject, centred, `#00acec`
- **Party details:** columns at 103 | 1170 | 1677 | 2053 | 2418 px
- **Items table:** SR.NO. | Particular | HSN NO. | QTY. | RATE | AMOUNT
- **Totals:** SUBTOTAL, optional DISCOUNT + NET, GST@18%
- **Bank block:** GST IN NO, CompanyName, Bank, Branch, A/C, IFSC, MSME
- **Signature:** "For ATS AUTOMATION", stamp slot, Authorized Signatory
- **Customer lines:** "Signature: ____" and "Person Name: ____"
- **Footer:** three overlapping rounded boxes on a gradient
- **Watermark:** large ATS mark at ~3.8% opacity

---

## 10. Key ATS Company Details (reference values)

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

> These live in `CompanyProfile` (Settings page) and are pulled dynamically.
> The table above is reference data only — the app renders whatever the profile
> holds, and prints no stamp until one is uploaded.

---

## 11. Conventions & Rules

1. **One task at a time** — complete one task before moving to the next
2. **Decorative assets are raster, not SVG, in server PDFs** — see §7
3. **Hinglish communication** — user communicates in Hindi-English mix
4. **Do what is best** — user trusts developer judgment for technical decisions
5. **Database name** — `ats.db`, at `backend/instance/ats.db`
6. **App theme** `#007acc`; **print sheet** its own FORTIS-sampled palette
7. **Run the tests** — `pytest` and `npm test` before calling work done
8. **Both print pipelines exist** — change one, check the other
9. **Never bundle a fallback stamp or logo for company-specific fields**
10. **Render the PDF and look at it** — xhtml2pdf fails silently, so a passing
    test is not proof the output is right

---

## 12. How to Verify Changes

```powershell
# Terminal 1
cd backend; python app.py

# Terminal 2
cd frontend; npm run dev

# Open http://localhost:3000/app/  — login: admin / ats@2026
```

Quotation print sheet: open a quotation → **Print / Save as PDF**, or go
straight to `/app/quotations/<id>/print`.

Run the suites:

```powershell
cd backend  && pytest -q
cd frontend && npm test
```

---

*This handover document was last updated 2026-10-08.*
