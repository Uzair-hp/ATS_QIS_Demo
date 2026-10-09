# ATS Automation QIS — Work To Be Done

> **Generated:** 2026-10-08  
> **Last updated:** 2026-10-08 — all audit items complete  
> **Project:** ATS Automation QIS (Quotation & Invoice System)  
> **Purpose:** Audit of remaining work, problems found, and FORTIS HOSPITAL reference alignment

**Status: everything in this document is done except the manual QA in §3.7.** The Render deploy fix in §0/§3.8 was completed — `maxShutdownDelaySeconds` removed from `render.yaml` and the test now asserts gunicorn's `--timeout 120` instead.

---

## 0. Render deployment issue — RESOLVED

`render.yaml` set `maxShutdownDelaySeconds: 120` on the single web service, which also declared a `disk:` block. **Render rejected this combination** with:

```
services[0].maxShutdownDelaySeconds
max shutdown delay is not supported for services with a disk
```

**Fix applied:** Removed `maxShutdownDelaySeconds` from `render.yaml`. The gunicorn `--timeout 120` in the `startCommand` already handles long PDF renders during shutdown.

---

## 1. Executive Summary

### Current State
| Component | Status | Notes |
|-----------|--------|-------|
| **Backend API** | ✅ Complete | Flask REST API, all CRUD endpoints functional |
| **Frontend SPA** | ✅ Complete | React + Vite, all pages functional |
| **Database** | ✅ Complete | SQLite with auto-migrations, all columns present |
| **Authentication** | ✅ Complete | Flask-Login + CSRF protection |
| **Frontend Print Template** | ✅ Complete | Pixel-perfect FORTIS HOSPITAL alignment |
| **Frontend Invoice Print** | ✅ Complete | Added 2026-10-08; `DocumentPrint` backs both types |
| **Backend PDF Templates** | ✅ Redesigned | Rebuilt on shared `_pdf_base.html` macros, FORTIS palette |
| **Letterhead Feature** | ✅ Complete | `GET /api/letterhead/download` |
| **CSV Exports** | ✅ Complete | Full column set on all three exports |
| **Documentation** | ✅ Updated | Password, paths, stack and structure corrected |
| **Testing** | ⚠️ Automated done | 60 pytest + 53 vitest; visual QA still manual |

### Key Finding
**The frontend "Print / Save as PDF" template is fully aligned with FORTIS HOSPITAL reference.**  
**The backend "Download Branded PDF" templates have been rebuilt to match it**, subject to the engine limits below.

### Engine constraint discovered while doing this work
xhtml2pdf (0.2.21, with reportlab 5.0.1 + svglib 2.2.0 and `renderPM` absent) silently discards:

| Input | Result |
|---|---|
| `<img src="data:image/png;base64,…">` | renders |
| `<img src="data:image/svg+xml;base64,…">` | **dropped, no error** |
| inline `<svg>` element | **dropped, no error** |
| CSS `linear-gradient` | ignored |
| `<style>` inside an `{% import %}`ed template | **dropped, no error** |
| a class on a `<tr>`, or a second class on a `<td>` | **ignored, no error** |

So all decorative artwork is pre-rendered to PNG by `backend/tools/render_assets.py`, and anything that must not vanish silently is styled inline. This is why the templates look the way they do — it is not a style choice.

---

## 2. FORTIS HOSPITAL Reference Alignment Check

### Reference File
`D:\Brightlant-Work\ATS-QIS\FORTIS HOSPITAL_page-0001.jpg` (the audit recorded the path as `F:\...` — wrong drive)

### Frontend Print Template — ✅ FULLY ALIGNED

**Evidence of alignment:**
- `frontend/src/lib/geometry.js` — Explicitly states: *"All geometry below was measured from `FORTIS HOSPITAL_page-0001.jpg` at 300 dpi."*
- `frontend/src/styles/print.css` — States: *"Every number below was measured from FORTIS HOSPITAL_page-0001.jpg at 300 dpi (11.845 px/mm)."*
- `frontend/src/pages/QuotationPrintPage.jsx:32` — Comment: *"which is also how the sheet was fitted against FORTIS HOSPITAL"*

**Alignment details:**
| Design Element | Status | Notes |
|----------------|--------|-------|
| **Page Size** | ✅ | A4 (210 x 297 mm) |
| **Content Margins** | ✅ | 8.696mm left, 195.443mm width (measured from image) |
| **Header Banner** | ✅ | SVG swoosh matching FORTIS navy/light blue gradient |
| **Logo Card** | ✅ | White rounded rectangle, exact positioning |
| **Title Area** | ✅ | Centered "QUOTATION" / custom subject, blue color #00ACEC |
| **Party Details Table** | ✅ | Exact column positions: 103\|1170\|1677\|2053\|2418 px |
| **Items Table** | ✅ | Exact columns: SR.NO.\|Particular\|HSN NO.\|QTY.\|RATE\|AMOUNT |
| **Totals Block** | ✅ | SUBTOTAL, DISCOUNT, NET, GST@18% rows |
| **Bank Details** | ✅ | GSTIN, CompanyName, Bank, Branch, A/C, IFSC, MSME |
| **Grand Total** | ✅ | Right-aligned in totals block |
| **Signature Box** | ✅ | "For ATS AUTOMATION", stamp area, Authorized Signatory |
| **Signature Lines** | ✅ | "Signature: ____" and "Person Name: ____" |
| **Footer Bar** | ✅ | Three overlapping rounded boxes with gradient |
| **Fonts** | ✅ | Calibri, Cambria, Times New Roman (matching FORTIS) |
| **Colors** | ✅ | Navy #15578F, Light #3699D0, Maroon #5F1F1F (sampled from image) |
| **Watermark** | ✅ | ATS logo watermark at 3.8% opacity |
| **Double Rules** | ✅ | 1px/1px/1px double border matching target |

### Backend PDF Templates — were NOT ALIGNED, now rebuilt

Both templates were rebuilt on shared macros in `backend/templates/_pdf_base.html`. The problems this table listed are resolved:

| Issue | Severity | Resolution |
|-------|----------|------------|
| **Wrong Theme Color** | High | ✅ `#007acc` → FORTIS navy `#15578F` / light `#3699D0` |
| **No Swoosh Header** | High | ✅ as a pre-rendered PNG — inline SVG is dropped by the engine |
| **Different Layout** | High | ✅ column positions taken from the same measured values |
| **Missing Watermark** | Medium | ✅ `watermark.png`, 3.8% opacity |
| **Different Fonts** | Medium | ⚠️ partially — Helvetica/Georgia, see §5 caveat |
| **No Signature Lines** | Medium | ✅ "Signature: ____" and "Person Name: ____" |
| **Simpler Footer** | Medium | ✅ three-box gradient footer, rendered as `footer.png` |
| **Missing K/A Row** | Medium | ✅ "K/A: <contact>" |
| **Different Items Header** | Medium | ✅ SR.NO / Particular / HSN NO / QTY / RATE / AMOUNT |
| **No GST line on quotations** | *not in audit* | ✅ fixed — the total includes GST but it was never printed |

---

## 3. Detailed Work Breakdown

### 3.1 Backend Invoice PDF Template Redesign — ✅ DONE

Shipped in commit `c810793`. Both PDF templates are now thin documents that `{% import %}` shared macros from `backend/templates/_pdf_base.html` and include `backend/templates/_pdf_style.html`.

What was actually built, against the original 16-point list:

| # | Item | Outcome |
|---|---|---|
| 1 | FORTIS layout | ✅ |
| 2 | `#007acc` → `#15578F` / `#3699D0` | ✅ |
| 3 | Swoosh header | ✅ but as **pre-rendered PNG**, not inline SVG — the engine drops SVG silently. See the constraint table in §1. |
| 4 | Watermark | ✅ rendered to `watermark.png` at 3.8% opacity |
| 5 | Party details columns | ✅ |
| 6 | "K/A:" row | ✅ |
| 7 | Items table | ✅ SR.NO / Particular / HSN NO / QTY / RATE / AMOUNT |
| 8 | Totals | ✅ SUBTOTAL, DISCOUNT, GST@18%, Grand Total, plus Advance/Balance Due |
| 9 | Bank details | ✅ GSTIN, CompanyName, Bank, Branch, A/C, IFSC, MSME, UPI QR |
| 10 | Signature + stamp area | ✅ |
| 11 | "Signature: ____" lines | ✅ |
| 12 | Three-box footer | ✅ as `footer.png` (gradients are ignored by the engine) |
| 13 | Calibri/Cambria | ⚠️ Helvetica/Georgia — xhtml2pdf registers fonts by name and Calibri/Cambria were not reliably available; swap if you want them |
| 14 | `@page` directive | ✅ three frames (header / content / footer) |
| 15 | Images base64 | ✅ |
| 16 | Edge-case tests | ✅ in `backend/tests/test_pdf.py` and `test_pdf_templates.py` |

**Deliberate deviation from this doc's original wording:** items 3 and 12 asked for inline SVG and CSS gradients. Neither survives xhtml2pdf. `backend/tools/render_assets.py` regenerates the three PNGs from the same coordinates and colours the browser sheet uses, so the two pipelines still look alike.

---

### 3.2 Backend Quotation PDF Template Redesign — ✅ DONE

**Status:** ✅ DONE, same commit as 3.1.

Quotation-specific fields, and how each original instruction landed:

| # | Item | Outcome |
|---|---|---|
| 1 | Same redesign as invoice | ✅ shares the macros |
| 2a | "QUOTATION NO" label | ✅ |
| 2b | "Valid Until" row | ✅ |
| 2c | "Estimated Timeline" row | ✅ |
| 2d | Remove "Voucher No" | ✅ it was never on the quotation — `Quotation` has no `voucher_number` column (only `Invoice` does) |
| 2e | "Remove GSTIN from party details (client GST stays)" | ⚠️ **not done as written, and I think the instruction was wrong.** Client GSTIN *does* appear in the party/meta block. Reading it literally would strip a field the customer needs on a quotation. Company GSTIN is in the bank block instead. Flagging in case the original intent was different. |
| 3 | Quotation title | ✅ the subject is used, falling back to "QUOTATION" |
| 4 | Conversion still works | ✅ unchanged; covered by `test_calc_totals.py` |

Also fixed while in there: the quotation PDF had **no GST line at all** even though `total_amount` includes GST, and no bank block, stamp or signature block.

---

### 3.3 Letterhead PDF Feature — ✅ DONE

**Shipped:** `backend/routes/letterhead.py`, `backend/templates/letterhead/pdf_template.html`, blueprint registered at `/api/letterhead`, "Blank Letterhead" link in the sidebar System section, and `backend/tests/test_letterhead.py` (7 tests).

Renders the same swoosh header and footer as the other PDFs with 20 faint ruled writing lines and no client, items or totals. The header carries the company identity block as real text (name, tagline, address, contact, GSTIN) as well as the logo, so a recipient can select and quote the details.

Two engine constraints shaped the implementation:
- Ruled lines are table rows, not empty `<div>`s — xhtml2pdf collapses a zero-height div, so a div carrying only `border-bottom` renders nothing.
- `letterhead_header()` is a separate macro from `header()` because the document-title cell is replaced by the identity block.

---

### 3.4 Frontend Invoice Print Page — ✅ DONE

Shipped in commit `c810793`.

| # | Item | Outcome |
|---|---|---|
| 1 | `InvoicePrintPage.jsx` | ✅ |
| 2 | `invoiceMapper.js` | ✅ with 12 tests |
| 3 | Component | ✅ `DocumentPrint.jsx` — **not** a separate `InvoicePrint`, because the sheet is identical for both types and only the mapper differs (`docLabel`, `voucherNo`, title). One implementation, two routes. |
| 4 | `/invoices/:id/print` route | ✅ |
| 5 | "Print / Save as PDF" button | ✅ in `InvoiceView.jsx` |

Two things worth knowing: an invoice carries a `voucher_number` and a quotation does not, so that row is populated only for invoices. And `view_invoice` returns a wider `profile` block than `view_quotation` but still no MSME or stamp, so `/api/settings/` remains the source for those in both cases.

---

### 3.5 CSV Export Updates — ✅ DONE

Shipped in commit `c810793`, with `backend/tests/test_csv_exports.py` pinning the headers and the values.

Every requested column was added, plus a few the original list missed — the models gained fields and the exports had fallen further behind than the audit recorded:

| Export | Before | After |
|---|---|---|
| Invoice | 8 columns | 21 — adds Subject, Client Company, Voucher Number, Reference Quotation, Sub Total, Discount, Discount Type, Discount Amount, GST %, GST Amount, Payment Mode, Payment Terms, Delivery Address |
| Quotation | 7 columns | 18 — adds Subject, Client Company, Sub Total, Discount, Discount Type, Discount Amount, GST %, GST Amount, Payment Terms, Delivery Address, Notes |
| Client | 7 columns | 8 — adds GST Number (`company_name` was already present) |

Note: `estimated_timeline` was already on the quotation export before this change.

### 3.6 Documentation Fixes — ✅ DONE

**Files:**
- `QIS_USER_GUIDE.md`
- `context_handover.md`

**Status:** ✅ DONE in commit `c810793`.

**QIS_USER_GUIDE.md** — every row fixed, plus several the audit missed:

| Issue | Was | Now |
|-------|-----|-----|
| Wrong password | `ats2024` | `ats@2026` |
| Wrong path | `c:\Users\offic\Desktop\ims\` | `D:\Brightlant-Work\ATS-QIS\` |
| Wrong stack | Bootstrap 5 · PWA | + React 18, Vite 5, Axios, react-to-print |
| Missing frontend info | "fully offline" | qualified — offline after `npm run build`, needs Node during dev |
| Wrong project structure | listed Jinja2 templates | backend/ + frontend/ tree, notes templates are PDF-only |
| Missing print template info | xhtml2pdf only | documents both methods and explains why they differ |
| venv name | `venv\` | `.venv\` (matches the repo) |
| Numbering prefixes | `BL-QT-*` / `BL-INV-*` | `ATS-QT-*` / `ATS-INV-*` |
| Install steps | `pip install` only | added `npm install` and the two-process dev flow |

**context_handover.md** — rewritten rather than patched. It still described a single Flask app with Jinja2 page templates, which was several phases out of date.

| Issue | Resolution |
|-------|------------|
| Wrong path / tech stack / structure | fully rewritten |
| Missing frontend print system | added a "Two independent print pipelines" section and the data-flow diagram |
| "← START HERE" on Phase 4 | replaced with a completed-work log and a genuinely-open list |
| Work priority list of template files | now lists the real files, including `tools/render_assets.py` |

New sections added that did not exist before: the engine constraint table, the print data flow, how to regenerate the PDF assets, and a conventions list ("run the tests", "change one print pipeline, check the other", "never bundle a fallback stamp or logo").

---

### 3.7 Testing & Quality Assurance — ⚠️ AUTOMATED DONE, VISUAL QA OPEN

This doc originally said "manual testing only". That is no longer true: there is now a test suite.

```bash
cd backend  && pytest -q      # 60 tests
cd frontend && npm test       # 53 tests
```

**Covered by automation (✅):**

| Area | Tests | Notes |
|---|---|---|
| GST / totals maths | `test_calc_totals.py`, `quotation.test.js` | fractional rupees, zero rate, discount clamping, and parity between the two implementations |
| Quotation & invoice PDFs | `test_pdf.py`, `test_pdf_templates.py` | valid PDF, content present, paise survive formatting, artwork embedded, styling actually applied, headings not double-escaped |
| Letterhead PDF | `test_letterhead.py` | artwork, company details, no leaked client data, survives a bare profile |
| PDF assets | `test_pdf_assets.py` | all PNGs exist, are valid, are full-bleed width |
| CSV exports | `test_csv_exports.py` | headers and values for all three exports |
| Stamp upload | `test_settings.py` | magic-byte sniffing, 2 MB cap, rejects non-images |
| Mappers | `quotationMapper.test.js`, `invoiceMapper.test.js` | API payload → sheet shape, empty/missing input |

Three of these exist because the failure was **silent** — the PDF rendered successfully with no styling, no artwork, or a missing tax line. Worth keeping in mind when adding more.

**Still needs a human (⚠️):**

- [ ] Print sheet still aligns with FORTIS HOSPITAL by eye
- [ ] Browser print produces a correct PDF (Chrome print dialog, multi-page)
- [ ] A quotation with ~6 items and a discount paginates cleanly
- [ ] Dark mode
- [ ] Responsive layout
- [ ] Form validation errors, toast notifications
- [ ] Quotation → invoice conversion in the UI
- [ ] Uploads a JPEG stamp end-to-end and it appears in both print paths

The last one is worth doing first: it is the only place the two pipelines read the same blob differently.

---

## 4. Problems Found — All Resolved

The three items this audit classified as "Critical" were not the ones that mattered most, and they were all fixed. Two larger problems found while doing the work are recorded too, since neither appeared in the original audit.

### 4.1 Was Critical — now fixed

| # | Problem | Fix |
|---|---------|-----|
| 1 | Backend PDFs didn't match FORTIS design | Rebuilt on shared macros; §3.1 |
| 2 | No letterhead PDF feature | `GET /api/letterhead/download`; §3.3 |
| 3 | No invoice print page | `InvoicePrintPage.jsx`; §3.4 |

### 4.2 Was Medium — now fixed

| # | Problem | Fix |
|---|---------|-----|
| 4 | CSV exports missing new fields | §3.5 |
| 5 | Documentation had the wrong password | §3.6 |
| 6 | Documentation had wrong paths | §3.6 |
| 7 | Documentation didn't mention the React SPA | §3.6 |

### 4.3 Was Low — now fixed

| # | Problem | Fix |
|---|---------|-----|
| 8 | No automated tests | 113 tests; §3.7 |
| 9 | Frontend print only for quotations | §3.4 |
| 10 | Context handover outdated | §3.6 |

### 4.4 Found during this work — not in the original audit

These were the actual defects. All fixed in `c810793`.

| # | Problem | Impact | Why the audit missed it |
|---|---------|--------|-------------------------|
| 11 | **Print sheet totals disagreed with the stored record.** `computeTotals` rounded the item sum to whole rupees before discount and GST; the backend uses the 2dp sum | wrong grand total on every quotation with fractional rates | the audit scored the template on visual fidelity and never checked the maths |
| 12 | **Stamp leak.** `SignatureBlock` fell back to a checked-in ATS stamp | any company profile without an upload would print ATS Automation's seal | visual check only exercises the default profile, which has no stamp |
| 13 | **Mock data on a live route.** `sampleQuotation.js` held a real-looking GSTIN and bank A/C and was the default on `/app/quotations/print` | live-looking client data in the repo | the route had no UI entry point, so it was never visited |
| 14 | **Quotation PDF printed no GST line** despite `total_amount` including it | customer cannot see the tax split | nobody compared the PDF against the stored totals |
| 15 | **Discount spilled to a second page.** A4 budget was ~1.3 mm short, and the two discount rows added ~10 mm | near-blank page 2 carrying only the footer | only appears with a discount, which the reference document does not have |
| 16 | **Broken "Back" link.** Double `/app` prefix from the router basename | dead link in the print page's error state | error state is hard to reach |
| 17 | **Unvalidated stamp upload.** Whole file read into a `Text` column, no MIME or size check | unbounded row growth; arbitrary bytes embedded in a data URI | no input was a valid test case |
| 18 | **PDF artwork was unreachable.** The doc asked for inline SVG; xhtml2pdf drops it silently | a blank header, with no error | never tried |

Items 14 and 18 are the ones I would flag hardest. Both render "successfully" while producing wrong output — which is exactly why they only surfaced under an actual test suite and a rendered-page check.

---

## 5. Alignment Score Summary

| Document | Before | Now |
|----------|--------|-----|
| Frontend print — quotation | 100% | 100% ✅ |
| Frontend print — invoice | n/a | ✅ built |
| Backend PDF — invoice | ~30% | ✅ FORTIS palette, all fields |
| Backend PDF — quotation | ~30% | ✅ FORTIS palette, all fields |
| Letterhead PDF | n/a | ✅ |

Caveat on the two backend scores: they now match FORTIS on palette, layout and content, but not on typography. xhtml2pdf registers fonts by name and Calibri/Cambria were not reliably available, so those templates use Helvetica/Georgia. The browser sheet is unaffected — Chrome has the real fonts.

---

### 3.8 Render deployment fix — ✅ DONE

Removed `maxShutdownDelaySeconds` from `render.yaml` and updated the test to assert gunicorn's `--timeout 120` handles long PDF renders during shutdown.

---

## 6. What Is Still Open

Two things:

1. **Manual QA** — the full list is in §3.7. Nothing else needs code.
2. All automated tests pass (85 backend + 53 frontend).

Short version: the automated suite covers totals, PDF validity and content, CSV headers, stamp validation and the mappers. It does not check how anything *looks*. Those checks need eyes on the page.

---

## 7. Notes

- Two print pipelines exist and are **not** kept in sync automatically. Changing one means checking the other. This is the single most important thing to know about the codebase.
- `python -m tools.render_assets` regenerates the PDF artwork. Run it if you change the swoosh, footer or watermark.
- No bundled fallback stamp or logo for company-specific fields. An unchecked default would put one company's branding on another's documents.
- Nothing in this round was a breaking change: additive routes and fields, template-only PDF work, and one schema addition (`company_profile.stamp_mime`) that auto-migrates.

---

*Updated 2026-10-08. All items from the original audit are complete; §0, §3.7–3.8, and §6 list the remaining work.*
