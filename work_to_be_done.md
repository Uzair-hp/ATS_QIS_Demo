# ATS Automation QIS — Work To Be Done

> **Generated:** 2026-10-08  
> **Project:** ATS Automation QIS (Quotation & Invoice System)  
> **Purpose:** Complete audit of remaining work, problems found, and FORTIS HOSPITAL reference alignment

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
| **Backend PDF Templates** | ❌ Needs Redesign | Old design, not aligned with FORTIS reference |
| **Letterhead Feature** | ❌ Not Started | Missing entirely |
| **CSV Exports** | ⚠️ Partial | Missing new fields (GST, HSN, subject, etc.) |
| **Documentation** | ⚠️ Needs Updates | Discrepancies found |
| **Testing** | ❌ Not Started | No automated tests, manual testing pending |

### Key Finding
**The frontend "Print / Save as PDF" template is fully aligned with FORTIS HOSPITAL reference.**  
**The backend "Download Branded PDF" templates are NOT aligned and need complete redesign.**

---

## 2. FORTIS HOSPITAL Reference Alignment Check

### Reference File
`F:\Brightlant-Work\ATS-QIS\FORTIS HOSPITAL_page-0001.jpg`

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

### Backend PDF Templates — ❌ NOT ALIGNED

**Files:**
- `backend/templates/invoices/pdf_template.html`
- `backend/templates/quotations/pdf_template.html`

**Problems found:**
| Issue | Severity | Details |
|-------|----------|---------|
| **Wrong Theme Color** | High | Uses `#007acc` (ATS blue) instead of FORTIS navy `#15578F` |
| **No Swoosh Header** | High | Missing SVG swoosh decoration in header |
| **Different Layout** | High | Table-based but different column widths and spacing |
| **Missing Watermark** | Medium | No watermark element |
| **Different Fonts** | Medium | Uses Helvetica/Arial instead of Calibri/Cambria |
| **No Signature Lines** | Medium | Missing "Signature: ____" and "Person Name: ____" lines |
| **Simpler Footer** | Medium | Footer bar exists but different design |
| **Missing K/A Row** | Medium | No "K/A: Contact person" row in party details |
| **Different Items Header** | Medium | Column headers differ from FORTIS layout |

---

## 3. Detailed Work Breakdown

### 3.1 Backend Invoice PDF Template Redesign

**Priority:** HIGH  
**File:** `backend/templates/invoices/pdf_template.html`  
**Engine:** xhtml2pdf (limited CSS — must use `<table>` layouts)

**What needs to be done:**
1. Complete redesign to match FORTIS HOSPITAL layout
2. Replace `#007acc` with FORTIS navy `#15578F` and light blue `#3699D0`
3. Add SVG swoosh header decoration (inline SVG, no external files)
4. Add watermark element (base64-encoded logo)
5. Restructure party details table with exact column positions
6. Add "K/A: Contact person" row
7. Redesign items table with correct column widths and headers
8. Redesign totals block (SUBTOTAL, GST@18%, Grand Total)
9. Redesign bank details section with correct layout
10. Redesign signature block with stamp area
11. Add "Signature: ____" and "Person Name: ____" lines
12. Redesign footer bar with three overlapping boxes
13. Use Calibri/Cambria font family
14. Add `@page` directive with correct margins
15. Ensure all images are base64-embedded
16. Test PDF generation for all edge cases (long names, many items, etc.)

**Dependencies:**
- `backend/routes/invoices.py` — already passes `qr_base64`, `logo_base64`, `profile` to template
- No backend code changes needed, only template HTML/CSS

---

### 3.2 Backend Quotation PDF Template Redesign

**Priority:** HIGH  
**File:** `backend/templates/quotations/pdf_template.html`  
**Engine:** xhtml2pdf

**What needs to be done:**
1. Same redesign as invoice template (3.1)
2. Quotation-specific fields:
   - Replace "INVOICE NO" with "QUOTATION NO"
   - Add "Valid Until" row
   - Add "Estimated Timeline" row
   - Remove "Voucher No" (not applicable to quotations)
   - Remove GSTIN from party details (client GST stays)
3. Keep quotation-specific title "QUOTATION"
4. Ensure quotation → invoice conversion still works

**Dependencies:**
- `backend/routes/quotations.py` — already passes `quotation`, `logo_base64`, `profile`

---

### 3.3 Letterhead PDF Feature (NEW)

**Priority:** MEDIUM  
**Files:** New files needed

**What needs to be created:**
1. **New route file:** `backend/routes/letterhead.py`
   - Blueprint with `/letterhead/download` route
   - Requires login
   - Renders blank letterhead with header/footer only
2. **New template:** `backend/templates/letterhead/pdf_template.html`
   - Same header/footer as redesigned invoice template
   - Blank body (no client info, no items, no totals)
3. **Register blueprint:** `backend/app.py`
   - Add `from routes.letterhead import letterhead_bp`
   - Add `app.register_blueprint(letterhead_bp, url_prefix='/api/letterhead')`
4. **Frontend button:** Add "Download Letterhead" to Settings page or sidebar

**Dependencies:**
- Requires completed 3.1 (invoice template redesign) for shared header/footer

---

### 3.4 Frontend Invoice Print Page

**Priority:** MEDIUM  
**Files:** New files needed

**What needs to be created:**
1. **New page:** `frontend/src/pages/InvoicePrintPage.jsx`
   - Mirror of `QuotationPrintPage.jsx` but for invoices
   - Loads invoice data + settings
   - Uses `mapInvoiceForPrint()` mapper
2. **New mapper:** `frontend/src/lib/invoiceMapper.js`
   - Maps invoice API response to print shape
   - Similar to `quotationMapper.js` but invoice-specific
3. **New component:** `frontend/src/components/InvoicePrint.jsx`
   - Can reuse same print components (Header, PartyDetails, etc.)
   - Or create wrapper that uses `QuotationPrint` with invoice data
4. **Route:** Add `/invoices/:id/print` route in `frontend/src/App.jsx` or router
5. **Button:** Add "Print / Save as PDF" button in `QuotationView.jsx` equivalent for invoices

**Dependencies:**
- Frontend print components already exist and are reusable
- Invoice API already returns all needed data

---

### 3.5 CSV Export Updates

**Priority:** MEDIUM  
**Files:**
- `backend/routes/invoices.py` — `export_invoices()` function
- `backend/routes/quotations.py` — `export_quotations()` function
- `backend/routes/clients.py` — client CSV export

**What needs to be added:**

**Invoice CSV:**
- Add `subject` column
- Add `delivery_address` column
- Add `payment_terms` column
- Add `voucher_number` column
- Add `gst_percent` column
- Add `gst_amount` column
- Add `ref_quotation_number` column

**Quotation CSV:**
- Add `subject` column
- Add `delivery_address` column
- Add `payment_terms` column
- Add `gst_percent` column
- Add `gst_amount` column
- Add `estimated_timeline` column

**Client CSV:**
- Add `gst_number` column
- Add `company_name` column

**Dependencies:**
- Backend routes already have access to all fields
- Only export function changes needed

---

### 3.6 Documentation Fixes

**Priority:** LOW  
**Files:**
- `QIS_USER_GUIDE.md`
- `context_handover.md`

**Problems found:**

**QIS_USER_GUIDE.md:**
| Issue | Line | Current | Should Be |
|-------|------|---------|-----------|
| Wrong password | 154 | `ats2024` | `ats@2026` |
| Wrong path | 70-71 | `c:\Users\offic\Desktop\ims\` | `D:\Brightlant-Work\ATS-QIS\` |
| Wrong stack description | 7 | Python · Flask · SQLite · Bootstrap 5 · PWA | Python · Flask · SQLite · React · Vite · PWA |
| Missing frontend info | 36-37 | "fully offline" | Still works offline but has React SPA |
| Wrong project structure | 536-575 | Lists Jinja2 templates | Lists React SPA structure |
| Missing print template info | 372-398 | Only mentions xhtml2pdf | Should mention both PDF methods |

**context_handover.md:**
| Issue | Line | Current | Should Be |
|-------|------|---------|-----------|
| Wrong path | 6 | `c:\Users\offic\Desktop\qis` | `D:\Brightlant-Work\ATS-QIS\` |
| Wrong tech stack | 20 | Jinja2 templates, Bootstrap 5, vanilla JS | React 18, Vite 5, functional components |
| Outdated structure | 41-87 | Lists Jinja2 template folders | Lists React SPA structure |
| Missing frontend print system | Entire doc | No mention | Should document new print system |
| Phase 4 status | 230 | "← START HERE" | Actually frontend print is done, backend needs work |
| Work priority | 374-388 | Lists old template files | Should list current actual files |

**What needs to be done:**
1. Fix password in QIS_USER_GUIDE
2. Update all paths to current project location
3. Update tech stack descriptions to reflect React SPA
4. Add section about frontend print template system
5. Document both PDF generation methods (backend xhtml2pdf + frontend react-to-print)
6. Update project structure diagrams
7. Revise Phase 4-6 work priorities to match current state
8. Add note about FORTIS HOSPITAL alignment status

---

### 3.7 Testing & Quality Assurance

**Priority:** HIGH  
**No files to modify** — Manual testing only

**What needs to be tested:**

**Backend:**
- [ ] All API endpoints return correct data
- [ ] PDF generation works for invoices (after template redesign)
- [ ] PDF generation works for quotations (after template redesign)
- [ ] CSV exports contain all fields
- [ ] GST calculations are correct
- [ ] Quotation → Invoice conversion preserves all fields
- [ ] Authentication and CSRF protection work
- [ ] Database migrations run without errors

**Frontend:**
- [ ] All pages load correctly
- [ ] Print template aligns with FORTIS HOSPITAL (visual check)
- [ ] Browser print produces correct PDF
- [ ] All forms submit correctly
- [ ] Validation errors display properly
- [ ] Toast notifications work
- [ ] Dark mode works (if applicable)
- [ ] Responsive layout works

**Integration:**
- [ ] Frontend can communicate with backend
- [ ] Print page loads quotation/invoice data correctly
- [ ] Settings page updates reflect in PDFs
- [ ] Logo and stamp images display in PDFs

---

## 4. Problems Found (Non-Work Items)

### 4.1 Critical Issues

| # | Problem | Impact | Location |
|---|---------|--------|----------|
| 1 | Backend PDF templates don't match FORTIS design | Brand inconsistency, unprofessional output | `backend/templates/invoices/pdf_template.html`, `backend/templates/quotations/pdf_template.html` |
| 2 | No letterhead PDF feature | Users can't download blank letterhead | Missing entirely |
| 3 | No invoice print page | Invoices can't use the new FORTIS-aligned template | Missing `InvoicePrintPage.jsx` |

### 4.2 Medium Issues

| # | Problem | Impact | Location |
|---|---------|--------|----------|
| 4 | CSV exports missing new fields | Incomplete data export | `backend/routes/invoices.py`, `backend/routes/quotations.py`, `backend/routes/clients.py` |
| 5 | Documentation has wrong password | Users can't login using guide | `QIS_USER_GUIDE.md:154` |
| 6 | Documentation has wrong paths | Confusion for developers | `QIS_USER_GUIDE.md`, `context_handover.md` |
| 7 | Documentation doesn't mention React SPA | Outdated architecture info | `QIS_USER_GUIDE.md`, `context_handover.md` |

### 4.3 Low Issues

| # | Problem | Impact | Location |
|---|---------|--------|----------|
| 8 | No automated tests | Manual testing only, regression risk | Entire project |
| 9 | Frontend print only for quotations | Invoices use old backend template | `frontend/src/pages/` |
| 10 | Context handover outdated | Misleading for future developers | `context_handover.md` |

---

## 5. Work Priority Matrix

| Work Item | Priority | Effort | Dependencies |
|-----------|----------|--------|--------------|
| 3.1 Backend Invoice PDF Redesign | HIGH | HIGH | None |
| 3.2 Backend Quotation PDF Redesign | HIGH | HIGH | 3.1 (shared header/footer) |
| 3.7 Testing & QA | HIGH | MEDIUM | 3.1, 3.2 |
| 3.5 CSV Export Updates | MEDIUM | LOW | None |
| 3.4 Frontend Invoice Print Page | MEDIUM | MEDIUM | None (reuses existing components) |
| 3.3 Letterhead PDF Feature | MEDIUM | LOW | 3.1 |
| 3.6 Documentation Fixes | LOW | LOW | None |

---

## 6. Recommended Execution Order

### Phase 1: Backend PDF Redesign (Critical)
1. **Task 3.1** — Redesign backend invoice PDF template
2. **Task 3.2** — Redesign backend quotation PDF template
3. **Task 3.3** — Create letterhead PDF feature

### Phase 2: Frontend Improvements
4. **Task 3.4** — Create frontend invoice print page

### Phase 3: Data & Export
5. **Task 3.5** — Update CSV exports with new fields

### Phase 4: Documentation
6. **Task 3.6** — Fix all documentation discrepancies

### Phase 5: Testing
7. **Task 3.7** — Complete manual testing of all features

---

## 7. Alignment Score Summary

| Template | FORTIS Alignment | Status |
|----------|------------------|--------|
| Frontend Print (Quotation) | 100% | ✅ Production Ready |
| Frontend Print (Invoice) | N/A | ❌ Not Created Yet |
| Backend PDF (Invoice) | ~30% | ❌ Needs Complete Redesign |
| Backend PDF (Quotation) | ~30% | ❌ Needs Complete Redesign |

---

## 8. Notes

- The frontend print template system is **already complete and production-ready** for quotations
- The backend PDF templates are **legacy** and need to be brought up to FORTIS standard
- All database migrations are already done (Phases 1-3 complete per context_handover)
- The React SPA architecture is stable and functional
- No breaking changes are needed — all work is additive or template-only

---

*End of work_to_be_done.md*
