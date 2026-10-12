# Document Template System

Invoices and quotations have **five switchable layouts each**. Every layout is a
React component. There is exactly one renderer, so the preview, the print view
and the saved PDF can never disagree.

## The one rule

> A template key resolves to a component in **one** file. Nothing else decides
> what a document looks like.

```
pdf_theme (the key)  →  frontend/src/templates/registry.js  →  a layout component
        ↑                                                            ↓
        │                                                      .doc-sheet  ← what prints
   saved on the row                                    rendered into preview + print view
```

If you are adding, renaming or removing a layout, you touch `registry.js` and
`layouts.jsx`. Nowhere else.

## Data contract (fixed — do not change)

Both document types are built into **one shape** by
`frontend/src/lib/docData.js` (`buildDocData(docType, doc, settings)`), so every
template reads the same fields for an invoice and a quotation.

| Field | Notes |
|---|---|
| `number`, `title`, `subject` | `title` is the uppercased subject, or the document name |
| `date`, `dueDate`, `validUntil` | invoices use due date, quotations use valid-until |
| `voucherNo`, `paymentTerm`, `delivery`, `timeline`, `refQuotation`, `status` | |
| `docLabel`, `grandLabel`, `notesHeading`, `signatureCaption` | per-document wording, from `labelsFor()` |
| `client` | `name` (trading), `kindAttn`, `address`, `phone`, `email`, `gstNo` |
| `items[]` | `srNo`, `description` (name + newline + description), `hsn`, `qty`, `rate`, `amount`, `amountFormatted` |
| `totals` | `subtotal`, `discount`, `net`, `gst`, `grandTotal`, `advance`, `balance` + a `*Formatted` of each |
| `company` | name, tagline, logo, gstin, msme, bank, branch, accountNo, ifsc, upiId, email, website, phone, address, stamp |
| `notes`, `qrBase64`, `amountWords` | |

**`settings` (from `GET /api/settings/`) is the source for the company block**,
not the document's inline `profile` key — that is what carries the bank details,
MSME number and stamp.

Blank fields are never rendered. A company with no IFSC gets no IFSC row, not a
row with an empty label.

## Layouts

Structure lives in `frontend/src/templates/layouts.jsx` as five archetypes;
colour lives in `print.css`, keyed off the sheet's `data-template` class. A
template is therefore **(archetype, palette)**.

| Archetype | Structure |
|---|---|
| `classic` | boxed panels, ATS blue band header, subject bar |
| `hero` | subject-led hero panel above two cards |
| `minimal` | no boxes, hairline rules, grand total ruled not filled |
| `compact` | small type, tight leading, inline meta |
| `letterhead` | full-bleed blue band with the logo on it |

## Keys

The keys are the ones the Jinja templates used, kept deliberately so nothing
needs migrating. They are already in `invoices.pdf_theme`,
`quotations.pdf_theme`, `CompanyProfile.invoice_pdf_theme` and
`CompanyProfile.quotation_pdf_theme`.

| Invoice key | Archetype | |
|---|---|---|
| `classic_gst` | classic | **Company standard** |
| `t2_letterhead` | letterhead | |
| `t4_corporate_slate` | hero | |
| `t3_minimal` | minimal | |
| `t5_compact_dense` | compact | |

| Quotation key | Archetype | |
|---|---|---|
| `classic` | classic | **Company standard** |
| `q1_classic` | classic | |
| `q2_proposal` | hero | |
| `q3_minimal` | minimal | |
| `q4_compact` | compact | |

The two key sets are **disjoint**. `validate_pdf_theme` rejects a key from the
wrong document type, and `registry.js` will not resolve one.

## Resolution order

First valid wins, then fall through:

1. `document.pdf_theme` — the template saved on that invoice/quotation
2. `CompanyProfile.invoice_pdf_theme` / `quotation_pdf_theme` — Printing Settings
3. `classic_gst` / `classic` — the company standard

In the browser this is `resolveKey(docType, savedKey, defaultKey)` in
`registry.js`. On the server it is `resolve_key()` in `backend/pdf_themes.py`.
Both are guarded against drift by `frontend/src/templates/__tests__/registry.test.js`,
which reads `backend/pdf_themes.py` and asserts every key offered there resolves
to a component.

## Switching a template

**Per document** — the create/edit form dropdown, or the print view dropdown.
The print view writes to `PUT /api/invoices/<id>/pdf-theme`, which is a
dedicated endpoint because `PUT /<id>` rebuilds the line items and recomputes the
status — a presentation change must not be able to rewrite the financial record.

**Globally** — Settings → Printing → Default Invoice/Quotation Template.

## There is no server-side PDF

`GET /api/.../pdf` and the `/api/settings/themes/preview/...` image endpoint no
longer exist. Download opens the print view with `?print=1`, which triggers the
browser print dialog, where the user chooses Save as PDF.

This is the fix for the bug where three surfaces rendered three different
layouts: there was a React sheet, a set of Jinja templates, and a folder of PNGs
pretending to be previews. Two tests guard against it coming back:
`test_server_side_pdf_endpoint_no_longer_exists` and
`test_theme_preview_image_endpoint_is_gone`.

## Layout rules

- **Never set a height.** The previous stylesheet hardcoded mm row heights
  measured from one sample scan, which left a ~48mm gap under a one-item table
  and pushed everything onto page 2. Let content size the block.
- **`white-space: nowrap` needs room.** "Authorized Signatory" used to overflow
  a 21mm cell and print over its neighbour. Wrap instead, or widen the column.
- Column labels sit on two lines (`SR.` / `NO.`), so give the header row
  breathing room rather than a fixed height.
- The items table may break across pages and repeats its `<thead>`; every other
  block carries `break-inside: avoid`.

## Adding a template

1. Add the key to `INVOICE_THEMES` or `QUOTATION_THEMES` in
   `backend/pdf_themes.py`, and to `USER_THEMES` if it should be selectable.
2. Map it to an archetype in `REGISTRY` in `frontend/src/templates/registry.js`.
3. If you need a genuinely new structure, add an archetype in `layouts.jsx` and
   give it a palette in `print.css`.

`registry.test.js` fails if step 2 is missed, so a backend key cannot ship
without a component.

## Verifying

```
cd backend  && pytest -q                                  # 74 tests
cd frontend && npm test                                   # 135 tests
cd frontend && npm run build
node tools/verify-templates.mjs                           # 19 live checks
```

`tools/verify-templates.mjs` drives a real browser through the whole flow and
writes screenshots to `.render/verify/`. Run the app first
(`cd backend; python app.py`).
