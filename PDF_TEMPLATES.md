# PDF Theme System

Invoice aur quotation PDFs ke liye 16 switchable layouts. **Data contract har
theme me identical hai** — sirf presentation badalti hai. Koi bhi theme badalne
se data nahi badalta.

## Data contract (fixed — do not change)

Har invoice theme ko ye milta hai:

| Variable | Contents |
|---|---|
| `invoice` | number, subject, date, due_date, voucher, payment_terms, delivery_address, ref_quotation_number, sub_total, discount(+type), gst_percent, gst_amount, total_amount, advance_amount, `balance_due`, notes, status |
| `invoice.client` | name, company_name, email, phone, address, gst_number |
| `invoice.items[]` | service_name, description, hsn_code, quantity, rate, amount |
| `profile` | company details, GSTIN, MSME, bank, UPI, `stamp_image` |
| `logo_base64` | logo as data URI |
| `qr_base64` | UPI payment QR (balance due > 0 only) |

Quotation themes ko wahi milta hai, bas `quotation` ke naam se — aur
**`qr_base64` nahi** (quotation me payment maanga nahi jaata). Quotation-only
fields: `valid_until`, `estimated_timeline`, 6-way `status`.

## Invoice themes

| Key | Look | Use when |
|---|---|---|
| `classic_gst` | Original dense bordered layout | Default fallback, backwards compatible |
| `t1_classic_gst` | Refined classic + amount-in-words + notes | CA / filing safety |
| `t2_letterhead` | Blue band header, subject banner, blue footer | **Default.** Matches the Fortis Hospital reference |
| `t3_minimal` | Hairlines, no boxes, heavy whitespace | Premium / white-glove service work |
| `t4_corporate_slate` | Navy + status badges, card panels | Enterprise B2B clients |
| `t5_compact_dense` | Tight leading, 40+ items/page | BOM-heavy site work |
| `t6_amber_accent` | Warm amber/cream | Small & retail clients |
| `t7_ledger` | Monospace accounting register | Physical bill-book feel |
| `t8_mono_bw` | Pure black & white | Fax / photocopy / thermal |
| `t9_legal_compliance` | CGST/SGST split, UOM, declaration | Auditors, statutory filings |
| `t10_modern_saas` | Teal hero, chips, cards | Invoices sent digitally |
| `t11_retail_pos` | Huge total at top | Counter / site handover |

## Quotation themes

| Key | Look |
|---|---|
| `classic` | Original layout — **still indigo `#4f46e5`, no GST/HSN.** Kept for reference only |
| `q1_classic` | ATS blue, GST rows + HSN + subject/delivery/terms. **Default** |
| `q2_proposal` | Navy pitch-style, timeline block, scope-first |
| `q3_minimal` | Clean hairlines, ATS blue |
| `q4_compact` | Dense single page for long lists (AMC renewals) |

## Switching themes

**Globally** — Settings → PDF Layout. Stored on `CompanyProfile.invoice_pdf_theme`
/ `quotation_pdf_theme`.

**Preview without saving** — append `?theme=<key>`:

```
GET /api/invoices/<id>/pdf?theme=t3_minimal
GET /api/quotations/<id>/pdf?theme=q2_proposal
```

Unknown keys fall back to the default; the filename gets a `_themekey` suffix so
previews don't collide with the real download.

**API** — `GET /api/settings/themes` returns every theme with `label` and
`description`, ready to populate a dropdown.

## Adding a theme

1. Drop a file in `backend/templates/invoices/themes/` or
   `backend/templates/quotations/themes/`.
2. Register it in `backend/pdf_themes.py`.
3. Done — no route changes needed.

Start from any existing theme and copy it.

## Shared macros

`backend/templates/_pdfmacros.html` — import at the top of a theme:

```jinja
{% import "_pdfmacros.html" as m %}
```

| Macro | Purpose |
|---|---|
| `m.amt(v)` | `53,223/-` — Indian invoice format |
| `m.num(v)` / `m.qty(v)` / `m.amt2(v)` | Plain / compact / 2-decimal numbers |
| `m.dt(v, fmt)` / `m.dmy(v)` | Dates |
| `m.nl(text)` | Multi-line, **HTML-escaped** — replaces the old unsafe `\|replace('\\n','<br>')\|safe` pattern |
| `m.amount_in_words(v)` | Indian system (Crore/Lakh/Thousand) |
| `m.amount_words_label(v)` | Adds the paise clause |
| `m.status_label(inv)` | PAID / PART PAID / PENDING |
| `m.bank_block(profile)` | GSTIN + company + bank + MSME |
| `m.upi_qr(profile, amt, qr)` | Payment QR — `qr` passed explicitly, macros can't read caller context |
| `m.footer_bar(profile)` | Contact strip |

## xhtml2pdf constraints

Themes render through **xhtml2pdf 0.2.21**, which is not a browser engine.
Every item below was found the hard way — each one produced visibly broken PDFs:

- **No `@frame`.** Frame content taller than the frame does not paginate, it
  bleeds outside and paints over the header/footer band. Verified: 60
  paragraphs (two pages' worth) inside a framed layout still produced a single
  page with text drawn from y=-3 to y=762. Themes use plain
  `@page { size: a4 portrait; margin: ... }` and the header/footer flow inline.
- **`<colgroup><col width="N%">` is ignored.** Use absolute `cm` widths.
- **Width on `<th>` alone is not enough** — every `<td>` in the column needs it
  too, or reportlab auto-sizes the body and long names wrap one word per line.
- **Cell padding shrinks an `<img>`.** The logo inside a padded `<td>` renders
  smaller. Keep the cell at `padding:0` and pad the wrapper instead.
- **A sibling cell's fixed `height` scales the logo down.** `height:26px`
  beside a 150px logo renders it 38×19pt. Don't pin a height on the title cell.
- **No CSS custom properties**, `box-shadow`, `border-radius`, flexbox, grid,
  or float.
- **Base-14 fonts only**: `Helvetica`, `Times`, `Courier`. The web fonts loaded
  in `index.html` do not apply. `Helvetica` has no `−` (U+2212) and no `₹`, so
  amounts use the `/-` suffix and a plain hyphen.
- **Don't emit long runs of `&nbsp;`** — reportlab raises
  `IndexError: string index out of range`. Use a bordered table for a rule.
- `repeat="1"` on the items `<table>` repeats the column headings across
  pages. This is what makes a 2-page invoice usable.

## Fitting on one page

Content width is 19.4cm with `margin: 0.6cm 0.8cm 0.4cm 0.8cm`. The standard
6-column items table uses:

```
SR 1.1 · Particulars 7.0 · HSN 2.3 · Qty 1.5 · Rate 3.0 · Amount 4.5
```

and the 7-column legal template:

```
SR 0.9 · Description 5.6 · HSN 2.0 · UOM 1.3 · Qty 1.3 · Rate 2.8 · Value 5.5
```

Tightening those matters more than anything else — a wrapped item name costs
~60pt of row height. 12 of 17 themes fit a typical 3-item invoice on one page;
the heavier ones (`t1`, `t4`, `t7`, `t9`, `t11`) spill a little to page 2 and
render correctly there.

`_fix_widths.py` regenerates the column widths if you add a theme.

## Bugs fixed while building these

These were pre-existing in the repo, not introduced by the themes:

- **`@frame` layout produced unreadable PDFs.** The original
  `invoices/pdf_template.html` rendered with the bank block stacked on top of
  the header, the items table printed twice, and text overlapping itself — with
  no error and no warning. Root cause and fix above.
- **Column widths never applied**, so every item name wrapped to 3+ lines and
  pushed the document onto a second page.
- **Logo rendered at 28×14pt** instead of 112×56pt in several templates.
- **Quotation template was indigo `#4f46e5`** while invoices were ATS blue.
- **Quotation template dropped `gst_percent` / `gst_amount` entirely**, despite
  both being stored. GST now renders.
- **Quotation template had no HSN column** and ignored `subject`,
  `delivery_address`, `payment_terms`.
- **Quotation template set `body { font-weight: bold }`** — entire document bold.
- `|replace('\n','<br>')|safe` passed unescaped user text straight into the PDF
  parser. `m.nl()` escapes each line first.
- `label='SCAN &amp; PAY'` double-escaped to `SCAN &amp;amp; PAY`. Labels now
  pass a bare `&`.

## Preview images

`backend/_preview/` holds a rendered PNG of every theme at 100 DPI, generated
from a representative invoice and quotation. Regenerate after editing a theme
by rendering it and rasterising page 1.