# Invoice & Quotation Template Audit — ATS-QIS

> **Generated:** 2026-10-12
> **Project:** ATS-QIS (Quotation & Invoice System)
> **Purpose:** Audit of the two independent rendering pipelines, the field inventory, the company-detail wiring, the logo/styling rules, and the problems spotted before a redesign.
> **Reference:** `FORTIS HOSPITAL_page-0001.jpg` (the visual spec), `context_handover.md`, `work_to_be_done.md`, `QIS_USER_GUIDE.md`, `PDF_TEMPLATES.md`, `deploy/README.md`, `AGENTS.md`.

Stack: Flask (JSON API) + React 18/Vite SPA. **Two completely independent rendering pipelines render the same business data** — that is the single most important fact for a redesign.

- **Browser print sheet** ("Print / Save as PDF") — `frontend/`, Vite SSR-free, `react-to-print` → user's Chrome.
- **Server-rendered PDF** ("Download PDF") — `backend/templates/`, `xhtml2pdf`/`pisa`.

They do not share templates, macros, stylesheets, totals code, or colour tokens.

---

## 1. Files involved

### 1.1 Backend — models, routes, PDF engine

| Path | Purpose |
|---|---|
| `backend/models.py` | SQLAlchemy models: `CompanyProfile`, `Client`, `Service`, `Invoice`, `InvoiceItem`, `Quotation`, `QuotationItem`, `User`. |
| `backend/app.py` | App factory, blueprint registration (`/api/invoices`, `/api/quotations`, `/api/settings`), CSRF, inline ALTER TABLE migration list. |
| `backend/config.py` | Flask config per `FLASK_ENV`. |
| `backend/routes/invoices.py` | Invoice CRUD, `_calc_totals`, `_build_items`, number generation, UPI QR generator, CSV export, xhtml2pdf PDF route. |
| `backend/routes/quotations.py` | Quotation CRUD, duplicate/revision, convert-to-invoice, CSV export, xhtml2pdf PDF route. |
| `backend/routes/settings.py` | `GET/POST /api/settings` (company profile), `/api/settings/themes`, `/api/settings/themes/preview/<doc>/<key>/<page>`, image upload sniffing. |
| `backend/routes/pdf_assets.py` | `get_pdf_assets()` — base64-encodes `static/img/{logo,swoosh,footer,watermark}.png`, cached in `_ASSET_CACHE`. |
| `backend/routes/validation.py` | All field validation helpers (`validate_discount`, `validate_gst_percent`, `validate_due_days`, `validate_valid_days`, `validate_pdf_theme`, `parse_item_*`). |
| `backend/pdf_themes.py` | Theme registry: `INVOICE_THEMES`, `QUOTATION_THEMES`, `USER_THEMES` allowlist, `resolve_path`, `themes_json`, preview path resolution. |
| `backend/pdf_render.py` | `render_pdf(template_path, **ctx)` → PDF bytes via xhtml2pdf. **Used only by the two tools scripts, not by the routes.** |
| `backend/tools/render_assets.py` | Regenerates `swoosh.png` / `footer.png` / `watermark.png` from SVG. |
| `backend/tools/render_themes.py` | Renders every theme to PDF for visual QA. |
| `backend/tools/probe_determinism.py` | Renders the same theme N times to check byte-determinism. |
| `backend/_preview/*.png` | Pre-rendered page images served by `/api/settings/themes/preview/…`. |
| `backend/tests/test_calc_totals.py` | Pins backend totals arithmetic. |
| `backend/tests/test_pdf*.py`, `test_theme*.py`, `test_assets.py`, `test_render.py` | Theme/template/asset regression tests. |
| `backend/tests/test_csv_exports.py`, `test_settings.py`, `test_profile.py`, `test_deployment.py` | Export & settings tests. |

### 1.2 Backend — Jinja/PDF templates

| Path | Purpose |
|---|---|
| `backend/templates/_pdfmacros.html` | Macro library used by all 16 themed templates: `amt`, `amt2`, `num`, `qty`, `dt`, `dmy`, `nl`, `two_digit`, `three_digit`, `amount_in_words`, `amount_words_label`, `status_label`, `footer_bar`, `bank_block`, `upi_qr`. |
| `backend/templates/_pdf_base.html` | Macro library used only by the two original templates: `amount`, `pct`, `header`, `footer`, `bank_block`, `signature`, `grand_cell`. No `<style>` block (deliberate — see §10). |
| `backend/templates/_pdf_style.html` | The one stylesheet for the two original templates. `@page` + 3 `@frame` rules. |
| `backend/templates/invoices/pdf_template.html` | Invoice default theme (`classic_gst`). Uses `_pdf_base.html` + `_pdf_style.html`. |
| `backend/templates/quotations/pdf_template.html` | Quotation default theme (`classic`). Uses `_pdf_base.html` + `_pdf_style.html`. |
| `backend/templates/invoices/themes/t1_classic_gst.html` | Reference-only invoice theme (not user-selectable). |
| `backend/templates/invoices/themes/t2_letterhead.html` | Invoice theme "Letterhead" — Fortis-referenced. |
| `backend/templates/invoices/themes/t3_minimal.html` | Invoice theme "Minimal". |
| `backend/templates/invoices/themes/t4_corporate_slate.html` | Invoice theme "Corporate Slate". |
| `backend/templates/invoices/themes/t5_compact_dense.html` | Invoice theme "Compact Dense". |
| `backend/templates/invoices/themes/t6_amber_accent.html` | Reference-only. |
| `backend/templates/invoices/themes/t7_ledger.html` | Reference-only. |
| `backend/templates/invoices/themes/t8_mono_bw.html` | Reference-only. |
| `backend/templates/invoices/themes/t9_legal_compliance.html` | Reference-only. CGST/SGST split, UOM column, declaration. |
| `backend/templates/invoices/themes/t10_modern_saas.html` | Reference-only. |
| `backend/templates/invoices/themes/t11_retail_pos.html` | Reference-only. |
| `backend/templates/quotations/themes/q1_classic.html` | Quotation theme "Classic". |
| `backend/templates/quotations/themes/q2_proposal.html` | Quotation theme "Proposal". |
| `backend/templates/quotations/themes/q3_minimal.html` | Quotation theme "Minimal". |
| `backend/templates/quotations/themes/q4_compact.html` | Quotation theme "Compact". |

### 1.3 Backend — static assets

| Path | Purpose |
|---|---|
| `backend/static/img/logo.png` | ATS logo, base64-embedded into every PDF. |
| `backend/static/img/swoosh.png` | Header swoosh artwork (PDF only). |
| `backend/static/img/footer.png` | Footer artwork (PDF only). |
| `backend/static/img/watermark.png` | Watermark artwork (PDF only). |
| `backend/static/img/icon-{192,512}{,-maskable}.png` | PWA icons. Not document-related. |

### 1.4 Frontend — React / CSS

| Path | Purpose |
|---|---|
| `frontend/src/components/DocumentPrint.jsx` | Composes the browser print sheet: `Header`, `PartyDetails`, `ItemsTable`, `Totals`, `BankDetails`, `SignatureBlock`, `Footer`. Serves both invoices and quotations. |
| `frontend/src/components/print/Header.jsx` | SVG banner + logo card. |
| `frontend/src/components/print/PartyDetails.jsx` | Table A — "TO", doc no, date, voucher, payment term, delivery, K/A, GST NO. |
| `frontend/src/components/print/ItemsTable.jsx` | Table B — SR/Particular/HSN/QTY/RATE/AMOUNT. |
| `frontend/src/components/print/Totals.jsx` | Table C upper — SUBTOTAL / DISCOUNT / NET / GST. |
| `frontend/src/components/print/BankDetails.jsx` | Table C lower — company GSTIN, company + bank block, Grand Total. |
| `frontend/src/components/print/SignatureBlock.jsx` | Table D + signature lines. |
| `frontend/src/components/print/Footer.jsx` | Three-box footer strip. |
| `frontend/src/styles/print.css` | The entire print-sheet stylesheet. 720 lines, mm-based, measured off the Fortis reference. |
| `frontend/src/lib/geometry.js` | `PX_PER_MM`, `PAGE`, `ROWS`, `COLS`, `COL_PCT`, `rowMm`, `COLORS` — the print-sheet measurement spec. |
| `frontend/src/lib/quotation.js` | `computeTotals`, `formatAmount`, `formatSubtotal`, `formatDate`, `normaliseQuotation`, `stampDataUri`, `AMOUNT_SUFFIX`, `SUBTOTAL_SUFFIX`. |
| `frontend/src/lib/invoiceMapper.js` | `mapInvoiceForPrint(invoice, settings)` → sheet shape. |
| `frontend/src/lib/quotationMapper.js` | `mapQuotationForPrint(quotation, settings)` → sheet shape. |
| `frontend/src/lib/pdfHref.js` | `pdfHref`, `savedPdfHref`, `invoicePdfHref`, `quotationPdfHref`. |
| `frontend/src/lib/pdfThemes.js` | Frontend mirror of the theme catalogue (`groupThemes`, `defaultFor`, `findTheme`). |
| `frontend/src/pages/InvoicePrintPage.jsx` | Route `/invoices/:id/print`. `react-to-print` + theme picker. |
| `frontend/src/pages/QuotationPrintPage.jsx` | Route `/quotations/:id/print`. Same shell. |
| `frontend/src/pages/InvoiceForm.jsx` | Invoice create/edit form + its own totals arithmetic. |
| `frontend/src/pages/QuotationForm.jsx` | Quotation create/edit form. |
| `frontend/src/pages/InvoiceView.jsx` | Invoice detail screen (uses `logo_base64` from the API). |
| `frontend/src/pages/QuotationView.jsx` | Quotation detail screen. |
| `frontend/src/pages/TemplateSelect.jsx` | PDF-theme dropdown. |
| `frontend/src/components/PrintThemePicker.jsx` | One-time `?theme=` override picker on the print page. |
| `frontend/src/components/ThemePreview.jsx` | Renders pre-rendered preview PNGs. |
| `frontend/src/pages/Settings.jsx` | Company profile editor incl. logo & stamp upload. |
| `frontend/public/assets/logo.png` | Print-sheet logo (byte-identical copy of the backend one). |
| `frontend/public/assets/watermark.svg` | Print-sheet watermark, injected as `--qp-watermark`. |
| `frontend/public/assets/stamp.png` | **NOT FOUND in any import.** Dead asset. |

### 1.5 Docs

`PDF_TEMPLATES.md`, `context_handover.md`, `QIS_USER_GUIDE.md`, `README.md`, `work_to_be_done.md`, `deploy/README.md`, `FORTIS HOSPITAL_page-0001.jpg` (the visual spec).

---

## 2. Data fields

### 2a. Invoice

Endpoints: `GET /api/invoices/`, `GET /api/invoices/<id>`, `POST /api/invoices/`, `PUT /api/invoices/<id>`, `POST /api/invoices/<id>/status`, `/archive`, `/unarchive`, `/export`, `/pdf`, `/meta`.

| Label on document | Backend field / DB column | JSON key | Type | Req/Opt | Example |
|---|---|---|---|---|---|
| INVOICE NO :- (classic) / Invoice No. (themes) | `Invoice.invoice_number` | `invoice_number` | VARCHAR(50) unique | required, auto | `ATS-INV-2026-010` |
| Date :- / Invoice Date / Date | `Invoice.date_created` | `date_created` | DateTime | required, auto | `2026-10-10T16:20:02.095344` |
| Due Date :- / Payment Due Date | `Invoice.due_date` | `due_date` | DateTime | nullable | `2026-10-25T16:20:02.095344` |
| due days input | derived | `due_days` (request only) | int 1–3650, default profile.default_due_days or 15 | optional | 15 |
| Voucher no / Voucher No. | `Invoice.voucher_number` | `voucher_number` | VARCHAR(50) | nullable | `V-1042` |
| PaymentTerm: / Payment Term | `Invoice.payment_terms` | `payment_terms` | VARCHAR(100) | nullable | `100% Advance` |
| Delivery :- (yellow `<mark>`) | `Invoice.delivery_address` | `delivery_address` | TEXT | nullable | `Gate 4, Nallasopara East` |
| Ref. Quotation / Against Quotation | `Invoice.ref_quotation_number` | `ref_quotation_number` | VARCHAR(50) | nullable, set on convert | `ATS-QT-2026-009` |
| Status / Invoice Status | `Invoice.status` | `status` | VARCHAR(20) | required, auto | `Pending` \| `Partially Paid` \| `Paid` |
| payment mode | `Invoice.payment_mode` | `payment_mode` | VARCHAR(20) | nullable, never printed | `UPI` (form offers Cash/UPI/Bank/blank) |
| subject / doc title | `Invoice.subject` | `subject` | VARCHAR(200) | nullable | `GARAGE DOOR` |
| TO, party name | `Client.company_name` or `Client.name` | `client.company_name` / `client.name` | VARCHAR(150) | required (name) | `FORTIS HOSPITAL` |
| contact person K/A: | `Client.name` | `client.name` | VARCHAR(150) | required | `Preview Co` |
| party address | `Client.address` | `client.address` | TEXT | nullable | `Sector 62, Noida, Uttar Pradesh 201309` |
| party phone Ph: | `Client.phone` | `client.phone` | VARCHAR(20) | nullable | `+91 98765 43210` |
| party email | `Client.email` | `client.email` | VARCHAR(150) | nullable | `ap@fortis.in` |
| GST NO. / Client GSTIN / Recipient GSTIN | `Client.gst_number` | `client.gst_number` | VARCHAR(50) | nullable | `09AAFCF1234A1Z5` |
| SR. NO. | `loop.index` — (derived) | — | int | derived | 1. |
| Particular / PARTICULARS (name + desc) | `InvoiceItem.service_name` + `InvoiceItem.description` | `items[].service_name`, `items[].description` | VARCHAR(200) NN / TEXT | name required | `Automatic Boom Barrier` |
| HSN NO. / HSN/SAC | `InvoiceItem.hsn_code` | `items[].hsn_code` | VARCHAR(20) | nullable | `996311` |
| QTY. / QTY | `InvoiceItem.quantity` | `items[].quantity` | Float NN, default 1.0 | required | 2.0 |
| unit / UOM | **NOT FOUND** | — | — | — | — |
| RATE | `InvoiceItem.rate` | `items[].rate` | Float NN | required | 400.0 |
| AMOUNT / TAXABLE VALUE | `InvoiceItem.amount` | `items[].amount` | Float NN, stored = round(qty\*rate,2) | derived | 800.0 |
| per-line discount / tax | **NOT FOUND** | — | — | — | — |
| SUBTOTAL | `Invoice.sub_total` | `sub_total` | Float NN | derived | 800.0 |
| DISCOUNT (+ % if percent) | `Invoice.discount`, `Invoice.discount_type`, `Invoice.discount_amount` | `discount`, `discount_type`, `discount_amount` | Float, VARCHAR(10) (flat\|percent), Float | optional | 0.0 / flat / 0.0 |
| NET / Net Amount | derived (sub_total - discount_amount) | not a key | — | derived, printed by classic-q only | 800.0 |
| GST@18% / GST @ 18% | `Invoice.gst_percent`, `Invoice.gst_amount` | `gst_percent`, `gst_amount` | Float / Float | optional, 0–100 | 18.0 / 144.0 |
| CGST / SGST | derived `gst_amount/2` each | — | — | t9 only; not stored | 72.0 |
| IGST | **NOT FOUND** | — | — | — | — |
| VAT | **NOT FOUND** | — | — | — | — |
| round-off / round off | **NOT FOUND** | — | — | — | — |
| Grand Total | `Invoice.total_amount` | `total_amount` | Float NN | derived | 944.0 |
| Advance Received | `Invoice.advance_amount` | `advance_amount` | Float NN | optional | 0.0 |
| Balance Due / BALANCE PAYABLE | `Invoice.balance_due` (property) | `balance_due` | derived `max(0, total-advance)` | derived | 944.0 |
| Amount in words | derived from `total_amount` | — | Jinja macro | t1–t11 + q1–q4 only, **not** the classic templates | `Nine Hundred and Forty Four Rupees Only` |
| Amount chargeable in words label | hardcoded string per template | — | — | — | `Amount Chargeable (in words):` |
| Notes & Terms / TERMS & CONDITIONS | `Invoice.notes` | `notes` | TEXT, nullable, defaults to profile.default_terms | optional | `Payment is due within 15 days…` |
| Declaration / jurisdiction | **NOT FOUND in DB** — hardcoded prose in t9 | — | — | t9 only | `We declare that this invoice shows the actual price…` |
| Bank Details block | `CompanyProfile.bank_*` fields, `gst_number`, `msme_number` | via profile / settings | see §3 | optional | — |
| UPI QR | generated per-request | `qr_base64` | base64 PNG data | invoice only, when `balance_due > 0` | `upi://pay?pa=…&am=944.00&cu=INR` |
| UPI id text | `CompanyProfile.upi_id` | profile.upi_id | VARCHAR(100) | optional | `ats@okaxis` |
| For <COMPANY> + stamp + Authorized Signatory | `CompanyProfile.stamp_image` / `stamp_mime` | profile.stamp_image | base64 TEXT / VARCHAR(30) | optional, no fallback | None |
| Signature : ___ / Person Name : ___ | — | — | — | always printed | — |
| PDF template key | `Invoice.pdf_theme` | `pdf_theme` | VARCHAR(50) | nullable | null |
| archive flag | `Invoice.is_archived` | `is_archived` | Boolean, not printed | false |
| overdue flag | `Invoice.is_overdue` (property) | `is_overdue` | bool, not printed | false |
| WhatsApp / email share links | generated per-request | `whatsapp_url`, `email_url` | string, not printed | — |

### 2b. Quotation

Endpoints: `GET /api/quotations/`, `/<id>`, `POST /`, `PUT /<id>`, `/status`, `/duplicate`, `/convert`, `/archive`, `/unarchive`, `/export`, `/pdf`, `/meta`.

| Label on document | Backend field / DB column | JSON key | Type | Req/Opt | Example |
|---|---|---|---|---|---|
| QUOTATION NO :- / Quotation No. | `Quotation.quotation_number` | `quotation_number` | VARCHAR(50) unique | required, auto | `ATS-QT-2026-009` |
| Date :- / Date | `Quotation.date_created` | `date_created` | DateTime | required, auto | `2026-10-08T16:09:47.380682` |
| Valid Until :- / Valid Until | `Quotation.valid_until` | `valid_until` | DateTime | nullable | `2026-10-23T16:09:47.380682` |
| valid days input | derived | `valid_days` (request only) | int 1–3650, default 15 hardcoded | optional | 15 |
| Timeline / Est. Timeline | `Quotation.estimated_timeline` | `estimated_timeline` | VARCHAR(100) | nullable | `2 weeks` |
| PaymentTerm: / Payment Terms | `Quotation.payment_terms` | `payment_terms` | VARCHAR(100) | nullable | `50% Advance` |
| Delivery :- | `Quotation.delivery_address` | `delivery_address` | TEXT | nullable | `Site: Vasai East` |
| Voucher no | **NOT FOUND** — no column | always `''` from the mapper | — | — | — |
| Ref. Quotation | **NOT FOUND** | — | — | — | — |
| status chip | `Quotation.status` | `status` | VARCHAR(20) | required, auto | `Draft` \| `Sent` \| `Accepted` \| `Declined` \| `Invoiced` \| `Expired` |
| subject | `Quotation.subject` | `subject` | VARCHAR(200) | nullable | `BOOM BARRIER` |
| TO, / PROPOSED FOR name | `Client.company_name` or `Client.name` | `client.company_name` / `client.name` | VARCHAR(150) | required | `FORTIS HOSPITAL` |
| Attn: / K/A: | `Client.name` | `client.name` | VARCHAR(150) | required | `Preview Co` |
| party address / phone / email | `Client.address` / `phone` / `email` | same | — | optional | — |
| GST NO. / Client GSTIN | `Client.gst_number` | `client.gst_number` | VARCHAR(50) | nullable | `09AAFCF1234A1Z5` |
| Our GSTIN | `CompanyProfile.gst_number` | profile.gst_number | VARCHAR(50) | nullable (q1 only) | `27BTHPT0851K1Z9` |
| # / SR. NO. | `loop.index` | — | int | derived | 1 |
| Particular / PARTICULARS | `QuotationItem.service_name` + `.description` | `items[].service_name`, `items[].description` | VARCHAR(200) NN / TEXT | name required | `item 1` |
| HSN NO. / HSN/SAC | `QuotationItem.hsn_code` | `items[].hsn_code` | VARCHAR(20) | nullable | `996311` |
| QTY. | `QuotationItem.quantity` | `items[].quantity` | Float NN | required | 2.0 |
| RATE | `QuotationItem.rate` | `items[].rate` | Float NN | required | 400.0 |
| AMOUNT | `QuotationItem.amount` | `items[].amount` | Float NN | derived | 800.0 |
| SUBTOTAL | `Quotation.sub_total` | `sub_total` | Float NN | derived | 800.0 |
| DISCOUNT | `.discount`, `.discount_type`, `.discount_amount` | same | — | optional | 0.0 / flat / 0.0 |
| NET | derived, printed by classic-q only when `discount_amount > 0` | — | — | derived | 800.0 |
| GST@18% | `.gst_percent`, `.gst_amount` | same | Float | optional | 18.0 / 144.0 |
| Grand Total / QUOTATION VALUE | `Quotation.total_amount` | `total_amount` | Float NN | derived | 944.0 |
| amount in words | derived | — | Jinja macro | q1–q4 only | `Nine Hundred and Forty Four Rupees Only` |
| Scope of Work, Exclusions & Terms / SCOPE, EXCLUSIONS & TERMS | `Quotation.notes` | `notes` | TEXT, nullable, defaults to profile.default_quotation_terms | optional | — |
| company + bank block | `CompanyProfile.bank_*` fields, `gst_number`, `msme_number`, `address`, `phone` | via settings | — | optional | — |
| UPI / QR | **NOT FOUND** — quotations have no upi_id/QR path in templates | — | — | — | — |
| For <COMPANY> + stamp + Authorized Signatory | `CompanyProfile.stamp_image` | profile.stamp_image | base64 TEXT | optional | — |
| Client Acceptance : ___ / Name & Date : ___ | — | — | — | classic-q + q1 only | — |
| Signature : ___ / Person Name : ___ | — | — | — | classic-q only | — |
| advance / balance | **NOT FOUND** — quotation has no `advance_amount` | — | — | — | — |
| PDF template key | `Quotation.pdf_theme` | `pdf_theme` | VARCHAR(50) | nullable | null |
| expiry flag | `Quotation.is_expired` (property) | `is_expired` | bool, not printed | false |

---

## 3. Company details

Source: `CompanyProfile` DB singleton, read only via `CompanyProfile.get_profile()`. Default row is seeded in `models.py`:106-117; editable via `GET/POST /api/settings`. Nothing comes from env or config. Exception: the profile is a DB row, but the values in the two SQLite files diverge (below).

| Field | DB column | Seeded default (models.py) | Current value in `backend/instance/ats.db` | Current value in `instance/ats.db` |
|---|---|---|---|---|
| name | `CompanyProfile.name` | `'ATS Automation'` | ATS Automation | ATS Automation |
| tagline | `.tagline` | `'Security & Systems'` | `''` | Security & Systems |
| address | `.address` | `'Main St, Nallasopara East, Virar East, Vasai-Virar, Mumbai, Maharashtra 401209'` | `''` | (same as seed) |
| phone | `.phone` | `'+91-9967399864'` | `''` | `+91-9967399864` |
| email | `.email` | `'info@atsautomation.in'` | `''` | `info@atsautomation.in` |
| website | `.website` | `'www.atsautomation.in'` | `''` | `www.atsautomation.in` |
| GSTIN | `.gst_number` | no default | `27BTHPT0851K1Z9` | NULL |
| PAN | **NOT FOUND** — no column anywhere | — | — | — |
| MSME | `.msme_number` | no default | `''` | NULL |
| bank name | `.bank_name` | no default | `''` | NULL |
| A/C no | `.bank_account` | no default | `''` | NULL |
| IFSC | `.bank_ifsc` | no default | `''` | NULL |
| branch | `.bank_branch` | no default | `''` | NULL |
| UPI id | `.upi_id` | no default | `''` | NULL |
| UPI name | `.upi_name` | no default | `''` | NULL |
| default GST % | `.default_gst_percent` | `18.0` | `18.0` | `18.0` |
| default invoice terms | `.default_terms` | `'Payment is due within 15 days of the invoice date.'` | `''` | (seed value) |
| default quotation terms | `.default_quotation_terms` | `'This quotation is valid for 15 days from the date of issue. 50% advance payment is required to commence work.'` | `''` | (seed value) |
| default due days | `.default_due_days` | `15` | `15` | `15` |
| company invoice theme | `.invoice_pdf_theme` | NULL | `classic_gst` | NULL |
| company quotation theme | `.quotation_pdf_theme` | NULL | `classic` | NULL |
| logo (uploaded) | `.logo_image` / `.logo_mime` | no default | NULL | NULL |
| stamp | `.stamp_image` / `.stamp_mime` | no default | NULL | NULL |

**Which endpoints expose what**

- `GET /api/settings/` → `_profile_json()` returns all of the above.
- `GET /api/invoices/<id>` → inline profile block: `name`, `tagline`, `email`, `phone`, `address`, `bank_name`, `bank_account`, `bank_ifsc`, `bank_branch`, `upi_id`, `gst_number` — no `msme_number`, no stamp.
- `GET /api/quotations/<id>` → inline profile block: `name`, `tagline`, `email`, `phone`, `address` only — no bank, no GSTIN.
- The PDF routes pass the whole profile model object, so templates can read anything.

**PAN:** NOT FOUND. There is no `pan` column, no API key, no template label.

---

## 4. Logo

| Property | Server-rendered PDF | Browser print sheet |
|---|---|---|
| File | `backend/static/img/logo.png` | `frontend/public/assets/logo.png` (byte-identical copy) |
| Format | PNG, RGBA | PNG, RGBA |
| Natural dimensions | 2177 × 1090 px | 2177 × 1090 px |
| Rendered width | 145px (`_pdf_style.html .logo-card img`) in the classic templates; `style="width:150px;"` in all 16 themed templates | 56.1mm × 20.48mm (`print.css .qp-logo-card img`) |
| Rendered height | auto (intrinsic aspect) | 20.48mm — explicitly set, distorts the PNG's aspect on purpose (see the comment at `print.css:117`) |
| Position | left, inside a white "logo card" (`.logo-card`, `border:1px solid #d7dde3`) — classic. In themes, left cell of a header table (t1/t2/q1 left, t4/t6/t10 centre-ish hero) | left — `.qp-logo-card` at `left:5.73mm`; `top:9.87mm`; `w:58.9mm`; `h:23.4mm` |
| How loaded | base64 data URI, `data:image/png;base64,{{ logo_base64 }}`, from `get_pdf_assets()` (read from disk + cached per process) | Vite asset import in `Header.jsx` (`import logoUrl from '../../../public/assets/logo.png'`) so the URL respects `base: '/app/'` |
| Fallback | `<span class="logo-fallback">{{ profile.name }}</span>` — text only, 14pt bold `#15578F` | `<img>` always renders; alt falls back to `'ATS Automation'` |
| Uploaded logo | **NOT FOUND** — `CompanyProfile.logo_image` is stored, uploaded and returned by `/api/settings` but no PDF template and no print component ever reads it. It appears only as the Settings-page avatar preview. | same |

Other assets: `swoosh.png` 2480×406 (PDF header, `width:21cm`), `footer.png` 2480×206 (PDF footer, `width:21cm`), `watermark.png` 2480×1795 (PDF only — not referenced by any template), `watermark.svg` (print sheet, injected as `--qp-watermark` from `frontend/public/assets/`).

Stamp: uploaded base64 in `CompanyProfile.stamp_image`, rendered at 105px (classic), 108px (q1), 110px (t2), 40.3mm × 32.4mm (print sheet, `opacity: 0.85`). No bundled fallback — the slot renders empty.

---

## 5. Styling

There is no CSS variables or theme config for the PDF side. Every colour is a literal hex inside each template's own `<style>`. The print sheet has a `:root` block (`print.css:23-43`) but it only defines fonts and rules — no colour variables; the sampled colours live in `frontend/src/lib/geometry.js` as the exported `COLORS` object.

### 5a. Colours

**Shared / classic PDF** (`_pdf_style.html` + `_pdf_base.html`):

| Hex | Where |
|---|---|
| `#15578F` | table header fill, `.grand_cell()` grand-total fill (inline), `.bank-head`/`.section-head` text, `.logo-fallback` |
| `#00ACEC` | `.doc-title` (the serif "INVOICE"/subject heading) |
| `#FFFFFF` | header/table text on navy, logo card, footer text |
| `#000000` | body text, all table borders |
| `#333333` | `.part-desc` (item description) |
| `#5F1F1F` | `.sig-maroon` — the word "For" in the signature block |
| `#D7DDE3` | `.logo-card` border |
| `#0f172a` | UPI QR fill colour (`generate_upi_qr_base64`, `routes/invoices.py:71`) |

Classic quotation (`quotations/pdf_template.html`) additionally references `#4F46E5` (old indigo brand) — wait, **corrected:** the indigo `#4F46E5` lives in `q1_classic.html`'s CSS comment only (line 4, describing the bug it fixed). `quotations/pdf_template.html` includes `_pdf_style.html`, so its accent is also `#00ACEC`/`#15578F`. **The registry description for the classic quotation theme that says it "still uses the old indigo brand colour" is stale.**

**Print sheet** (`print.css` + `geometry.js`):

| Hex | Where |
|---|---|
| `#5b6470` | `.qp-sheet-wrap` preview backdrop (screen only) |
| `#fff` / `#000` | sheet background / body text |
| `#ffff00` | `.qp-mark` — the yellow highlight behind `Delivery :-` |
| `#1b7cbb` → `#15588f` | `.qp-footer-band` gradient |
| `#2aa6dc` | `.qp-footer-a`, `.qp-footer-b` |
| `#1e7bb5` → `#165e90` | `.qp-footer-c` gradient |
| `#3f9bda` | `.qp-footer-rule` |
| `#5f1f1f` | `.qp-maroon` — "For" |
| `COLORS.bannerNavy #15578F` → `bannerNavy2 #1D6EA6` | header SVG navy gradient (`Header.jsx`) |
| `COLORS.bannerLight #3699D0` | header SVG light diagonal band |
| `COLORS.title #00ACEC` | `.qp-title` |
| `COLORS.mark #FFFF00` | declared in `geometry.js`, **unused in CSS** |
| `COLORS.footerA/B/C/C2/footerRule` `#228AC1 #1D6EA6 #155687 #0F467E #3F9BDA` | declared in `geometry.js` but not used; `Footer.jsx` only uses `COLORS.footerRule`, the rest are hardcoded in `print.css` |

`geometry.js` also samples `COLORS.footerC2 #0F467E` and `COLORS.bannerLight #3699D0` — unused duplicates of values that exist in `print.css`.

Per-theme colour sets (all 16 templates):
t1 `#000 #007ACC #222 #333 #FFF #FFFFFF`;
t2 `#000 #007ACC #333 #555 #C9D6E2 #E3EBF2 #EAF4FB #F4F8FB #F7FAFC #FFF #FFFFFF`;
t3 `#111 #1A1A1A #555 #666 #888 #E6E6E6 #FFF #FFFFFF`;
t4 `#166534 #1E3A5F #1F2937 #2563EB #374151 #4B5563 #6B7280 #92400E #991B1B #BFDBFE #CBD5E1 #D1D5DB #DBEAFE #DCFCE7 #E5E7EB #EFF6FF #F9FAFB #FEF2F2 #FEF3C7 #FFF #FFFFFF`;
t5 `#000 #007ACC #333 #444 #BBB #FFF #FFFFFF`;
t6 `#292524 #57534E #78350F #78716C #92400E #B45309 #BEF264 #D6D3D1 #ECFCCB #F59E0B #FCD34D #FDE68A #FEF3C7 #FFF #FFFBEB #FFFFFF`;
t7 `#000 #F0F0F0 #FFF #FFFFFF`;
t8 `#000 #E8E8E8 #FFFFFF`;
t9 `#000 #007ACC #1F2D3D #333 #444 #555 #C5D0DA #CBD5E1 #E9EEF3 #F7F9FB #FDECEC #FFF #FFFFFF`;
t10 `#0F766E #166534 #1E293B #64748B #92400E #94A3B8 #99F6E4 #9A3412 #CCFBF1 #DCFCE7 #E2E8F0 #F0FDFA #F1F5F9 #F8FAFC #FEF3C7 #FFF #FFF7ED #FFFFFF`;
t11 `#007ACC #111 #166534 #555 #666 #92400E #BAE6FD #DDD #E3F9E5 #E6F4FF #EEE #F7FAFC #FFF #FFF4E5 #FFFFFF`;
q1 `#007ACC #111 #166534 #333 #4F46E5 #555 #666 #991B1B #C9D6E2 #D8E2EA #E3F9E5 #E6F4FF #E9EFF4 #EAF4FB #F7FAFC #FDECEC #FFF #FFFFFF`;
q2 `#1E293B #1E3A8A #475569 #64748B #BFDBFE #CBD5E1 #DBE4EE #E2E8F0 #EFF6FF #F1F5F9 #F8FAFC #FFF #FFFFFF`;
q3 `#007ACC #111 #555 #666 #888 #EEE #FFF #FFFFFF`;
q4 `#000 #007ACC #333 #444 #BBB #FFF #FFFFFF`.

Note the branding split: the classic pair and the print sheet use ATS navy/cyan `#15578F` / `#00ACEC`; eight of the sixteen themes use `#007ACC`; the rest use teal, amber, indigo or mono. There is no single brand token.

### 5b. Fonts

**PDF** (xhtml2pdf → ReportLab built-ins; the CSS stacks are largely aspirational):

| Role | Declared | Size | Weight |
|---|---|---|---|
| body (classic) | `Helvetica, Arial, sans-serif` | 9.5pt | normal, line-height:1.35 |
| body (themes) | `Helvetica, Arial, sans-serif` (t7/t8: `"Courier New", Courier, monospace`) | 9.5pt (t3 10pt, t5 8.4pt, t7/t8 9pt, t9 9pt, t10 9.5pt, t11 9.5pt, q1 9.5pt, q2 9.5pt, q3 10pt, q4 8.5pt) | normal |
| doc title (classic) | `Georgia, 'Times New Roman', serif` | 17.5pt | bold, letter-spacing: normal |
| doc title (themes) | inherits body serif/sans | 13pt (t5/q4) … 24pt (t3) / 23pt (q3) | bold, letter-spacing:2px–5px |
| items table th | inherits body | 8.5pt (classic) / 7.5pt (t3,q3) … 9pt (t1) | bold |
| items table td | inherits body | 9.5pt (classic) / 7.6pt–9.5pt | normal |
| numeric cells | `Georgia, 'Times New Roman', serif` | same as row | normal / bold for the amount column |
| grand total | `Georgia` for the value | 11.5pt (classic `grand_cell`) / 9.5pt–13pt | bold, white on navy |
| section heads (`.bank-head`, `.section-head`) | body | 8pt | normal, text-transform:uppercase, letter-spacing:1px |
| notes body | body | 8.5pt | normal |
| signature | body | 10pt `.sig-for`, 9pt `.sig-role` | bold / normal |

**Print sheet** (`print.css :root`):

| Token | Value |
|---|---|
| `--font-sans` | `Calibri, Carlito, 'Segoe UI', Arial, sans-serif;` |
| `--font-serif` | `Cambria, Constantia, Georgia, 'Times New Roman', serif;` |
| `--font-num` | `'Times New Roman', Cambria, Georgia, serif;` |
| `--font-heavy` | `'Arial Narrow', 'Tw Cen MT Cond', Arial, sans-serif;` |
| `--font-cond` | `'Arial Narrow', 'Roboto Condensed', Calibri, sans-serif;` |

| Role | Family | Size | Weight |
|---|---|---|---|
| `.qp-sheet` root | `--font-sans` | — | 700 (everything bold by default) |
| `.qp-title` | `--font-serif` | 17.5pt | 700 |
| `.qp-invoice-label` | `--font-serif` | 13pt | 700 |
| items `thead th` | `--font-sans` | 12.2pt / 12.7pt lh | 700 |
| items `tbody td` | `--font-sans` | 13.6pt / 16.9pt lh | 700 |
| `.qp-num` (HSN/QTY/RATE/AMOUNT) | `--font-num` | 10.5pt | 700 |
| `.qp-sr` (serial) | `--font-sans` | 11pt | 700 |
| `.qp-tot-label` | `--font-sans` | 11.6pt; subtotal row 12.5pt | 700 |
| `.qp-tot-value` | `--font-heavy` | 13.8pt | 700 |
| `.qp-company-gstin` | `--font-cond` | 12.3pt | — |
| `.qp-company` | `--font-sans` | 12.87pt | — |
| `.qp-grand-label` / `.qp-grand-value` | `--font-sans` / `--font-heavy` | 13.8pt | 700 |
| `.qp-for` / `.qp-signatory` | `--font-sans` | 12.2pt | 700 |
| `.qp-siglines` | `--font-cond` | 9.2pt | — |
| `.qp-footer-box` | `--font-sans` | 8pt | 700 |

There is no font embedding anywhere — no `@font-face`, no `pdfmetrics.registerFont`, no bundled TTF/OTF. Both pipelines silently fall back when Calibri/Cambria/Arial Narrow are absent (which is always, on a Linux host).

### 5c. Table style

- **Classic PDF** (`.items`): full `1px solid #000000` borders on every `th` and `td`. `th` = navy `#15578F` fill, white text, centred, `padding:5px 4px`. `td` = `padding:4px`, `vertical-align:top`. Column widths `10% / 42% / 14% / 10% / 12% / 12%`. No striping, no zebra. `border-collapse` is not used (xhtml2pdf ignores it). `repeat="1"` is absent from the classic tables.
- **Themed PDFs**: `th` fill `background-color:#007ACC` (or per-theme), `td` borders `1px solid #C9D6E2 / #D8E2EA / #BBB / #1F2D3D`. Padding `2.6px–7px`. `repeat="1"` is present on every themed items table. No striping anywhere.
- **Print sheet**: `border-collapse: collapse`, `table-layout: fixed`, `border: 1px solid #000` on the table and on every `td/th`, `padding: 0 1.2mm`, `vertical-align: top`. No striping. The "double rule" between table A and table B is faked: a 1px pseudo-element 3px above/below via `--rule-gap: 3px`, because Chrome renders `border-style: double` as solid at that width.

---

## 6. Layout & PDF output

Two pipelines.

**(A) Browser print sheet** — "Print / Save as PDF"

- Routes `/invoices/:id/print`, `/quotations/:id/print`.
- Renderer: `react-to-print` (`useReactToPrint({ contentRef, documentTitle })`) → opens a hidden iframe and calls the browser's own print dialog. It is not `window.print()` on the page, and not `react-pdf`, and not a headless Chrome server-side step — the user's Chrome does the rendering.
- CSS applied: `frontend/src/styles/print.css`, imported inside `InvoicePrintPage.jsx` / `QuotationPrintPage.jsx` (not `main.jsx`) so it is code-split to those routes. `print.css` also contains `@page { size: A4; margin: 0 }` and a large `@media print` block.
- Page: A4, portrait, margin 0. `.qp-sheet` is `width:210mm`; `min-height:297mm` with the wrap `padding:8mm 0`.
- Header: absolutely-positioned `.qp-banner` (210mm × 17.139mm) + `.qp-banner-art` SVG (210mm × 34.4mm) + `.qp-logo-card`. Watermark `.qp-watermark` at `top:76mm`; 210mm × 152mm; `opacity:0.038`. Title `.qp-title-area` at `top:17.139mm`.
- Content: `margin-left: 8.696mm`; `width: 195.443mm` (`--content-left`, `--content-w`). Signature block is wider: `margin-left:7.092mm`; `width:197.047mm`.
- Footer: `.qp-footer` 210mm × 14.16mm, `margin-top:5.12mm`, three absolute boxes plus a gradient band and a bottom rule.
- Page-break handling: `.qp-sec-info`, `.qp-sec-totals`, `.qp-sec-sig`, `.qp-footer` all carry `break-inside: avoid`; `page-break-inside: avoid`. `.qp-items tbody tr` carries `break-inside: avoid`. Only the items section may break; its `<thead>` repeats by default. The banner, banner-art, watermark and title-area switch to `position: fixed` inside `@media print` so Chrome repeats them on every page. `print-color-adjust: exact` is set on `.qp-sheet` and every descendant.
- Vertical budget for the standard case is documented at ~295.7mm against A4's 297mm — roughly 1mm of slack.

**(B) Server-rendered PDF** — "Download PDF"

- Endpoints `GET /api/invoices/<id>/pdf`, `GET /api/quotations/<id>/pdf`, optional `?theme=<key>`.
- Renderer: xhtml2pdf (`from xhtml2pdf import pisa` → `pisa.CreatePDF(io.StringIO(html), dest=buf)`). Not WeasyPrint, not wkhtmltopdf, not reportlab directly. Output `Content-Type: application/pdf`, `Content-Disposition: attachment; filename=<number>.pdf`.
- Template chosen by `pdf_themes.resolve_path(doc_type, request.args.get('theme'), doc.pdf_theme, profile.<type>_pdf_theme)` → first valid wins, else defaults.
- Page: A4 portrait in every case. **Two different margin regimes:**
  - Classic pair (`_pdf_style.html`): `size: a4 portrait; margin: 0` plus three `@frame` rules — `header_frame` (0,0,21cm × 6.3cm), `content_frame` (left 0.87cm, top 6.4cm, 19.54cm × 20.9cm), `footer_frame` (top 27.4cm, 21cm × 2.3cm). The frames are wired via `-pdf-frame-content: headerContent / footerContent`, but `pdf_render.py`'s docstring explains the frames were abandoned for the theme set because xhtml2pdf frames do not paginate. The classic templates still use inline `#headerContent` / `#footerContent` divs.
  - All 16 themed templates: `@page { size: a4 portrait; margin: 0.6cm 0.8cm 0.4cm 0.8cm; }` — no frames. Header/footer flow inline at the top and bottom of the body. Consequence: the letterhead does not repeat on page 2 in any themed template.
- Page-break handling: `repeat="1"` on `<table class="items">` in all 16 themes repeats the column headings across pages. `repeat="1"` is **missing** from `invoices/pdf_template.html` and `quotations/pdf_template.html`.
- Margins inside the body: no page margin in the classic templates beyond the frames (content is `left:0.87cm`, `width:19.54cm`). Themed templates rely entirely on the `@page` margin.
- Engine constraints the templates already work around: no flexbox, no CSS grid, no inline `<svg>`, no `data:image/svg+xml`, no `linear-gradient`, `border-collapse` ignored, a class on a `<tr>` is ignored, a second class on a `<td>` is not reliably applied.

---

## 7. Calculation logic

Computed in four places. Three are authoritative-ish; one is display-only.

### 7a. Backend — the stored truth

`_calc_totals` is duplicated verbatim in `backend/routes/invoices.py:79-87` and `backend/routes/quotations.py:51-59`:

```python
def _calc_totals(sub_total, discount_val, discount_type, gst_percent=0.0):
    if discount_type == 'percent':
        disc_amt = round(sub_total * discount_val / 100, 2)
    else:
        disc_amt = round(discount_val, 2)
    net = max(round(sub_total - disc_amt, 2), 0)
    gst_amt = round(net * gst_percent / 100, 2) if gst_percent else 0.0
    total = round(net + gst_amt, 2)
    return disc_amt, gst_amt, total
```

Line items (`_build_items`, identical in both routes):

```python
def _build_items(parent, item_names, item_descs, item_qtys, item_rates, item_hsns, item_cls):
    sub_total = 0.0
    for name, desc, qty, rate, hsn in zip(item_names, item_descs, item_qtys, item_rates, item_hsns):
        name = name.strip()
        if not name:
            continue
        # Values are pre-validated; no silent fallbacks
        amount = round(qty * rate, 2)
        sub_total += amount
        parent.items.append(item_cls(
            service_name=name, description=desc.strip() or None,
            hsn_code=hsn.strip() or None,
            quantity=qty, rate=rate, amount=amount
        ))
    return sub_total
```

`sub_total` is then re-rounded once more: `invoice.sub_total = round(sub_total, 2)`.

Balance and status (`models.py:206-208`, `routes/invoices.py:379-384` / `539-544` / `573-578`):

```python
@property
def balance_due(self):
    return max(0.0, self.total_amount - self.advance_amount)

if invoice.total_amount <= 0 or invoice.advance_amount >= invoice.total_amount:
    invoice.status = 'Paid'
elif invoice.advance_amount > 0:
    invoice.status = 'Partially Paid'
else:
    invoice.status = 'Pending'
```

Round-off: **NOT FOUND.** No rounding to whole rupees anywhere. `_calc_totals` returns exact 2dp figures. The only rounding to whole rupees is display-only: `amount()` in `_pdf_base.html` and `m.amt()` in `_pdfmacros.html` use `{:,.0f}`, and `formatAmount()` in `quotation.js` uses `Math.round(n)`. So a stored `944.50` prints as `945/-` on the PDF and `945/-` on the print sheet, while the DB and the API say `944.5`.

Paise are silently dropped by the PDF. `_pdf_base.amount()` does `{:,.2f} ` then strips a trailing `.00`, but `m.amt()` in `_pdfmacros.html` is unconditionally `{:,.0f}`.

Tax is single-headed. `gst_percent` is one rate and `gst_amount` one figure. There is no CGST/SGST/IGST storage; t9 derives `gst_amount / 2` per side at render time, and t4 mislabels the whole amount CGST/SGST @ x%.

### 7b. Frontend print sheet — `computeTotals`

`frontend/src/lib/quotation.js:28-73`. Mirrors the backend but prefers the API's stored totals via `serverFigure()`:

```js
const computedSubtotal = round2(lines.reduce((sum, l) => sum + l.amount, 0))
const subtotal = serverFigure(quotation.subTotal) ?? computedSubtotal
...
const discount = serverFigure(quotation.discountAmount) ?? computedDiscount
const net = Math.max(round2(subtotal - discount), 0)
const gst = serverFigure(quotation.gstAmount) ?? computedGst
const grandTotal = serverFigure(quotation.totalAmount) ?? computedTotal
```
hasDiscount is driven by the entered value, not the computed one: `hasDiscount: rawDiscount > 0`.

Display formatting (`quotation.js:80-89`):

```js
export const AMOUNT_SUFFIX = '/-'
export const SUBTOTAL_SUFFIX = '/-/-'

export function formatAmount(value) {
  return `${roundRupee(value)}${AMOUNT_SUFFIX}`
}

export function formatSubtotal(value) {
  return `${roundRupee(value)}${SUBTOTAL_SUFFIX}`
}
```

So the print sheet shows `945/-` for a subtotal and `945/-/-` for the subtotal — the doubled slash is an intentional quirk copied from the Fortis scan.

### 7c. Frontend forms — a third, unrounded implementation

`frontend/src/pages/InvoiceForm.jsx:79-87`:

```jsx
const subTotal = useMemo(
  () => items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0), 0),
  [items]
)
const discountAmount = discountType === 'percent' ? subTotal * (parseFloat(discount) || 0) / 100 : parseFloat(discount) || 0
const net = Math.max(subTotal - discountAmount, 0)
const gstAmount = net * (parseFloat(gstPercent) || 0) / 100
const total = net + gstAmount
const balance = Math.max(total - (parseFloat(advanceAmount) || 0), 0)
```

No per-line `round(qty*rate, 2)`, no 2dp rounding at any step, and it uses the unrounded line products. The value shown in the sticky "Invoice Summary" panel can therefore disagree with what the backend stores. `QuotationForm.jsx` does not compute totals at all — it only renders them.

### 7d. Tests

`backend/tests/test_calc_totals.py` pins `_calc_totals`. `frontend/src/lib/__tests__/quotation.test.js` pins `computeTotals`. `frontend/src/lib/__tests__/invoiceMapper.test.js` and `quotationMapper.test.js` pin the mappers. No test pins `InvoiceForm`'s arithmetic.

---

## 8. Differences — Invoice vs Quotation

| Aspect | Invoice | Quotation |
|---|---|---|
| Number format | `ATS-INV-{YYYY}-{NNN}` | `ATS-QT-{YYYY}-{NNN}` |
| Legacy prefix fallback | Yes — falls back to `BL-INV-{YYYY}-%` and continues that sequence | No |
| Revisions | **NOT FOUND** | Yes — `duplicate_quotation`, appends `-R{n}` (`ATS-QT-2026-009-R1`) |
| Secondary date | `due_date` (Due Date :-) | `valid_until` (Valid Until :-) |
| Date basis | `due_date = date_created + due_days`, `due_days` default = `profile.default_due_days` (15) | `valid_until = date_created + valid_days`, `valid_days` default = hardcoded 15, profile has no quotation-validity setting |
| Extra date field | `voucher_number` | `estimated_timeline` (Timeline) |
| Currency/collection fields | `advance_amount`, `balance_due`, `payment_mode`, `status ∈ {Pending, Partially Paid, Paid}` | none of these; `status ∈ {Draft, Sent, Accepted, Declined, Invoiced, Expired}` |
| Default status | Pending | Draft |
| Default notes text | `profile.default_terms` (`Payment is due within 15 days of the invoice date.`) | `profile.default_quotation_terms` (`This quotation is valid for 15 days… 50% advance…`) |
| UPI / QR | Yes — `generate_upi_qr_base64(balance_due, invoice_number)`, shown when `balance_due > 0` | None — "nothing to pay yet" per `pdf_themes.py` docstring |
| /meta company block | name, default_due_days, default_gst_percent, default_terms | name, default_gst_percent, default_quotation_terms |
| view_<id> profile block | 11 keys incl. bank + upi + gst_number | 5 keys: name, tagline, email, phone, address |
| Shared link message | WhatsApp/email with Total, Balance Due, Due Date | WhatsApp/email with Total, Estimated Timeline, Valid Until |
| Convert to | — | `POST /convert` → invoice, copies amounts/items, sets `ref_quotation_number`, sets `status='Invoiced'`, deliberately drops `pdf_theme` |
| Edit lock | only when `status` not in `('Pending','Partially Paid')` | only when `status` in `('Accepted','Invoiced')` |
| Theme sets | 12 keys, 5 user-selectable | 5 keys, 5 user-selectable — disjoint by design (`validate_pdf_theme` rejects cross-type keys) |
| Notes section heading | Notes & Terms | Scope of Work, Exclusions & Terms |
| Total-row label | Grand Total | Grand Total (classic-q) / QUOTATION VALUE (q1) |
| Acceptance block | Signature : ___ + Person Name : ___ | Client Acceptance : ___ + Name & Date : ___ (classic-q, q1) |
| NET row | never printed | printed by classic-q only inside the `if discount_amount > 0` block — i.e. the NET row vanishes on a discountless quotation even though subtotal == net |
| Amount in words | t1–t11 only | q1–q4 only |
| CGST/SGST, UOM, declaration, jurisdiction | t9 only | NOT FOUND |
| CSS colours | ATS navy/cyan `#15578F/#00ACEC` | ATS navy/cyan `#15578F/#00ACEC` (the "old indigo" note in `pdf_themes.py` is stale) |
| Quotation.client relationship | defined implicitly via `Client.invoices` backref only | explicitly `client = db.relationship('Client', backref=db.backref('quotations'))` |

Browser print sheet: the two documents are the same component tree. The only differences are `docLabel` ('INVOICE NO:-' vs 'QUOTATION NO:-'), the fallback title ('INVOICE' vs 'QUOTATION'), and `voucherNo` (`''` for quotations). `valid_until`, `estimated_timeline`, `status`, `ref_quotation_number`, `advance_amount`, `balance_due`, `payment_mode` are all dropped — `normaliseQuotation` has no keys for them. A quotation's validity date and a paid invoice's balance therefore never appear on the print sheet.

---

## 9. Sample payloads

### 9a. `GET /api/invoices/12` — real row from `backend/instance/ats.db`, rebuilt to exactly what `_invoice_json(inv, detailed=True)` returns plus the view_invoice extras

```json
{
  "id": 12,
  "invoice_number": "ATS-INV-2026-010",
  "client_id": 10,
  "client_name": "Preview Co",
  "date_created": "2026-10-10T16:20:02.095344",
  "due_date": "2026-10-25T16:20:02.095344",
  "sub_total": 0.0,
  "discount": 0.0,
  "discount_type": "flat",
  "discount_amount": 0.0,
  "total_amount": 0.0,
  "advance_amount": 0.0,
  "balance_due": 0.0,
  "status": "Paid",
  "payment_mode": null,
  "notes": "",
  "is_archived": false,
  "ref_quotation_number": null,
  "subject": null,
  "delivery_address": null,
  "payment_terms": null,
  "voucher_number": null,
  "gst_percent": 18.0,
  "gst_amount": 0.0,
  "pdf_theme": null,
  "is_overdue": false,
  "items": [
    {
      "id": 14,
      "service_name": "1",
      "hsn_code": null,
      "description": null,
      "quantity": 1.0,
      "rate": 0.0,
      "amount": 0.0
    }
  ],
  "client": {
    "id": 10,
    "name": "Preview Co",
    "company_name": "FORTIS HOSPITAL",
    "email": null,
    "phone": null,
    "address": "Sector 62, Noida, Uttar Pradesh 201309",
    "gst_number": "09AAFCF1234A1Z5"
  },
  "qr_base64": "iVBORw0KGgoAAAANSUhEUgAAAQaAAADICAYAAADS09at…",
  "logo_base64": "iVBORw0KGgoAAAANSUhEUgAAAb…",
  "whatsapp_url": "",
  "email_url": "",
  "profile": {
    "name": "ATS Automation",
    "tagline": "",
    "email": "",
    "phone": "",
    "address": "",
    "bank_name": "",
    "bank_account": "",
    "bank_ifsc": "",
    "bank_branch": "",
    "upi_id": "",
    "gst_number": "27BTHPT0851K1Z9"
  }
}
```

A realistic, populated variant (this is what a redesign will actually have to render):

```json
{
  "id": 41,
  "invoice_number": "ATS-INV-2026-011",
  "client_id": 10,
  "client_name": "Preview Co",
  "date_created": "2026-10-12T09:15:00.000000",
  "due_date": "2026-10-27T09:15:00.000000",
  "sub_total": 800.0,
  "discount": 5.0,
  "discount_type": "percent",
  "discount_amount": 40.0,
  "total_amount": 897.6,
  "advance_amount": 400.0,
  "balance_due": 497.6,
  "status": "Partially Paid",
  "payment_mode": "UPI",
  "notes": "Payment is due within 15 days of the invoice date.",
  "is_archived": false,
  "ref_quotation_number": "ATS-QT-2026-009",
  "subject": "GARAGE DOOR",
  "delivery_address": "Gate 4, Nallasopara East, Vasai-Virar",
  "payment_terms": "50% Advance",
  "voucher_number": "V-1042",
  "gst_percent": 18.0,
  "gst_amount": 137.6,
  "pdf_theme": "t2_letterhead",
  "is_overdue": false,
  "items": [
    {
      "id": 90,
      "service_name": "Automatic Boom Barrier",
      "hsn_code": "996311",
      "description": "600mm heavy duty, 1-phase",
      "quantity": 2.0,
      "rate": 400.0,
      "amount": 800.0
    }
  ],
  "client": {
    "id": 10,
    "name": "Preview Co",
    "company_name": "FORTIS HOSPITAL",
    "email": "ap@fortis.in",
    "phone": "+91 98765 43210",
    "address": "Sector 62, Noida, Uttar Pradesh 201309",
    "gst_number": "09AAFCF1234A1Z5"
  },
  "qr_base64": "iVBORw0KGgoAAAANSUhEUgAAAQaAAADICAYAAADS09at…",
  "logo_base64": "iVBORw0KGgoAAAANSUhEUgAAAb…",
  "whatsapp_url": "https://wa.me/919876543210?text=Dear%20Preview%20Co%2C%0A%0A…",
  "email_url": "https://mail.google.com/mail/?view=cm&fs=1&to=ap%40fortis.in&su=Invoice%20ATS-INV-2026-011%20from%20ATS%20Automation&body=…",
  "profile": {
    "name": "ATS Automation",
    "tagline": "",
    "email": "",
    "phone": "",
    "address": "",
    "bank_name": "",
    "bank_account": "",
    "bank_ifsc": "",
    "bank_branch": "",
    "upi_id": "",
    "gst_number": "27BTHPT0851K1Z9"
  }
}
```

### 9b. `GET /api/quotations/13` — real row, rebuilt to `_quotation_json(q, detailed=True)` plus the view_quotation extras

```json
{
  "id": 13,
  "quotation_number": "ATS-QT-2026-009",
  "client_id": 10,
  "client_name": "Preview Co",
  "date_created": "2026-10-08T16:09:47.380622",
  "valid_until": "2026-10-23T16:09:47.380622",
  "estimated_timeline": "",
  "sub_total": 800.0,
  "discount": 0.0,
  "discount_type": "flat",
  "discount_amount": 0.0,
  "total_amount": 944.0,
  "status": "Invoiced",
  "notes": "This quotation is valid for 15 days from the date of issue. 50% advance payment is required to commence work.",
  "is_archived": false,
  "subject": "anlcs",
  "delivery_address": "nsncvj;w; swc",
  "payment_terms": "sc kj.sNkvn",
  "gst_percent": 18.0,
  "gst_amount": 144.0,
  "pdf_theme": null,
  "is_expired": false,
  "items": [
    {
      "id": 15,
      "service_name": "item 1",
      "hsn_code": "naslc",
      "description": null,
      "quantity": 2.0,
      "rate": 400.0,
      "amount": 800.0
    }
  ],
  "client": {
    "id": 10,
    "name": "Preview Co",
    "company_name": "FORTIS HOSPITAL",
    "email": null,
    "phone": null,
    "address": "Sector 62, Noida, Uttar Pradesh 201309",
    "gst_number": "09AAFCF1234A1Z5"
  },
  "logo_base64": "iVBORw0KGgoAAAANSUhEUgAAAb…",
  "whatsapp_url": "",
  "email_url": "",
  "profile": {
    "name": "ATS Automation",
    "tagline": "",
    "email": "",
    "phone": "",
    "address": ""
  }
}
```

Note: no `qr_base64`, and the profile block has no bank details and no GSTIN — which is why both mappers must make a second call to `/api/settings/`.

---

## 10. Problems spotted

### Duplicate code — the biggest redesign cost

1. `_calc_totals` is duplicated verbatim in `routes/invoices.py:79` and `routes/quotations.py:51`. `_build_items`, `_get_items_payload`, `_invoice_json`/`_quotation_json`, `_query_invoices`/`_query_quotations`, the JSON-vs-form item-payload branch, and the entire `download_pdf` body are all near-identical pairs. Roughly 200 lines of copy-paste.
2. Four independent totals implementations (backend × 2, `computeTotals`, `InvoiceForm`'s inline arithmetic), with the form's being the only one that skips per-line rounding. Change one and the form's sticky summary can silently disagree with the stored record.
3. Two macro libraries for the same job. `_pdf_base.html` (`amount`, `pct`, `header`, `footer`, `bank_block`, `signature`, `grand_cell`) and `_pdfmacros.html` (`amt`, `num`, `qty`, `nl`, `bank_block`, `footer_bar`, `upi_qr`, `amount_words_label`). There are two `bank_block` macros with different labels — `_pdf_base` prints `GSTIN : / CompanyName : / Bank Details : / Branch : / A/C No. : / IFSC Code : / MSME :`; `_pdfmacros` prints `GST IN NO : / Company : / Bank : / Branch : / A/C No : / IFSC :` and omits MSME. The print sheet prints a third set: `GSTNO-{}/CompanyName-{}/Bank Details: {}/Branch: {}/A/C No.:{}/IFSC Code: {}/MSME:{}`. **Three label sets for the same data.**
4. 18 templates (2 classic + 16 themed), each with its own inline `<style>` block. No shared stylesheet, no variables, no build step. Changing the grand-total bar means 18 edits.
5. `generate_upi_qr_base64` is 18 lines of route-local logic in `routes/invoices.py` that arguably belongs in a shared module.
6. Two numbering generators with different algorithms: `generate_invoice_number` takes the latest row and +1 (race-prone, breaks if a number is deleted or if `-R` suffixes exist); `generate_quotation_number` scans every row for a max. Neither uses a transaction or a unique constraint beyond the column's `unique=True`.

### Hardcoded values

7. `"your-upi-id@upi"` in `generate_upi_qr_base64` (`routes/invoices.py:62`) — a literal placeholder address baked into the QR payload when `upi_id` is empty. (The `upi_qr` macro does gate on `profile.upi_id`, so it never renders — but the QR is still generated on every invoice PDF request, including ones that discard it.)
8. `valid_days` default 15 is hardcoded in `validate_valid_days` (`validation.py:108`), and `duplicate_quotation` hardcodes `timedelta(days=15)` (`routes/quotations.py:513`). There is no `default_valid_days` on `CompanyProfile`, so the quotation-validity rule is not user-configurable while the invoice due-days rule is.
9. `admin / ats@2026` seeded in `app.py:294-299`.
10. The whole design is pinned to a single reference scan (`FORTIS HOSPITAL_page-0001.jpg`) at 300 dpi. `print.css` is 720 lines of 11.845 px/mm arithmetic with ~1mm of vertical slack. Any new row in the totals block, or any tax split, immediately pushes to page 2.
11. `'NA/A'`-style fallbacks: `invoice.due_date.strftime(...)` `if invoice.due_date else 'N/A'` inside `view_invoice`'s share message, `'—'` in `m.dt()`/`m.dmy()`, `{{ inv.status|upper }}` in `status_label`.
12. `pdf_themes.py`'s description for the classic quotation theme still says "note it still uses the old indigo brand colour." It does not — `quotations/pdf_template.html` includes `_pdf_style.html` and uses `#00ACEC/#15578F`. Stale, and actively misleading for a redesign.

### Inconsistencies between the two pipelines

13. Amount in words exists in all 16 themed PDF templates and in neither of the two default templates. Since the two defaults are what a fresh install renders, a new customer gets no amount-in-words.
14. Round-off does not exist in either pipeline. `m.amt()` (`'{:,.0f}'`) and `formatAmount()` (`Math.round`) silently round for display while the API stores exact paise. A `944.50` invoice shows `945/-` on paper and `944.5` in the JSON and in the invoice list UI.
15. `repeat="1"` is present on every themed items table and absent on both default templates — so the default invoice loses its column headings on page 2.
16. `@page` margins differ between the two families (margin: 0 + frames vs `0.6cm 0.8cm 0.4cm 0.8cm`), and the themed set has no frames at all, so no letterhead repeats on page 2 in any of the 16 themes.
17. The print sheet shows `945/-/-` for the subtotal (doubled slash, `SUBTOTAL_SUFFIX`) and `945/-` everywhere else. Faithful to the scan, but it reads as a typo.
18. `COLORS` in `geometry.js` declares 11 sampled values of which only 3 (`bannerNavy`, `bannerNavy2`, `bannerLight`, `footerRule`) are actually consumed; the rest are duplicated as literals in `print.css` and can drift.
19. `CompanyProfile.logo_image` is uploaded through Settings, returned by `/api/settings`, and displayed in the Settings avatar — but no document renders it. A company that uploads its own logo still gets the checked-in ATS logo on every PDF and print sheet. This is the same class of bug as the bundled-stamp bug that was fixed, but for the logo.
20. `backend/static/img/watermark.png` (2480×1795) is loaded and base64-encoded on every PDF request via `get_pdf_assets()` and never referenced by any template. Same for `frontend/public/assets/stamp.png` (600×600) — imported nowhere.
21. The two SQLite files (`backend/instance/ats.db` and `instance/ats.db`) hold different company profiles, including a GSTIN in one and NULL in the other. `config.py` decides which one is live; a designer reading the wrong one will design against the wrong company.

### Missing fields that a redesign will immediately want

22. No unit / UOM column anywhere in the schema (only t9 prints a UOM header with no data behind it).
23. No `pan` column, no PAN on any template.
24. No per-line discount or per-line tax rate. GST is a single document-level rate applied to the post-discount net. A redesigned invoice with per-item tax treatment would need a migration.
25. No `place_of_supply` — t9 hardcodes the heading `PLACE OF SUPPLY / DELIVERY` over `delivery_address`, which is a different thing.
26. No `po_number`, no `e_invoice`/IRN/ACK fields, despite t9's docstring claiming "e-way style reference fields."
27. No separate Terms and Notes. One `notes` TEXT column has to carry T&Cs, scope, exclusions and the acceptance declaration. Invoice defaults to `default_terms`, quotation to `default_quotation_terms`, and `create_*` silently substitutes the company default when the field is blank (`notes=notes or profile.default_terms`) — but `edit_*` does not (`invoice.notes = (data.get('notes') or '').strip()`). **Editing an invoice and clearing the notes box wipes the terms; editing a quotation does the same.**
28. No payment/ledger history — one `advance_amount` and one `payment_mode` on the invoice. No payment date, no transaction reference, no instalment schedule.
29. No `created`/`updated` audit columns on `Invoice` or `Quotation`; no `updated_at` at all.
30. No bank details on the quotation's `view_quotation` profile payload, so a client-side-only render of a quotation cannot show the bank block without a second call — which is exactly why both mappers do the second call.

### Robustness / correctness

31. `pdf_render.py` (with the whole "why there are no `@frame` rules here" rationale and the "overflow guard … falls back to a paged layout" comment referenced from `_pdfmacros.html:6`) is **dead code in production**: both `download_pdf` routes inline their own `pisa.CreatePDF` and neither has an overflow guard. The comment in `_pdfmacros.html` describes behaviour that does not exist.
32. Both `download_pdf` routes report success on partially-broken output. `pisa_status.err` is checked, but xhtml2pdf's known silent-drop list (inline `<svg>`, `data:image/svg+xml`, `linear-gradient`, a class on a `<tr>`, a second class on a `<td>`, a zero-height `<div>` with only `border-bottom`) sets no error bit. `AGENTS.md` §6 documents this; nothing in the code guards against it.
33. `templates/invoices/pdf_template.html` and `templates/quotations/pdf_template.html` use `{{ ... |replace('\n','<br>')|safe }}` on notes, description and delivery_address. `_pdfmacros.nl()` was written specifically to close this ("an HTML-injection hole", `_pdfmacros.html:19-21`) — the two default templates still have it open. User-controlled notes reaches the PDF parser unescaped on the two documents that ship as defaults.
34. `Invoice.is_overdue` and `Quotation.is_expired` both do `self.due_date.replace(tzinfo=IST)` on a naive datetime, unconditionally treating it as IST. Correct only because everything is written in IST.
35. `create_invoice` sets `status='Pending'` in the constructor and then immediately overwrites it from `advance_amount` — dead assignment. It also treats `total_amount <= 0` as Paid, so a zero-value invoice is silently marked paid (row 12 in the sample DB is exactly this: `total_amount: 0.0, status: "Paid"`).
36. `edit_invoice` deletes all `InvoiceItem` rows then rebuilds, so item ids churn on every edit; `advance_amount` is reset against the new total, which can silently demote a Paid invoice to Partially Paid.
37. `pdf_themes.themes_json()` groups by category with `out[-1]['items'].append(...)`, relying on `USER_THEMES` being pre-sorted so identical categories are adjacent. It works by convention only.
38. `PDF_TEMPLATES.md`, `context_handover.md` and `work_to_be_done.md` all describe this system; there is no single authoritative field inventory, which is presumably why this audit was needed.
