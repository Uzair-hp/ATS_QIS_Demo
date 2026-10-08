// Derived values for a quotation. Nothing here is typed by hand - every
// figure comes from the item rows, the discount and gstPercent.
//
// Mirrors backend/routes/quotations.py::_calc_totals, so a printed sheet agrees
// with the stored record:
//   subtotal = Σ round(qty * rate, 2)          <- NOT pre-rounded to whole rupees
//   discAmt  = percent ? round(subtotal * pct / 100, 2) : round(flat, 2)
//   net      = max(round(subtotal - discAmt, 2), 0)
//   gst      = gstPercent ? round(net * gstPercent / 100, 2) : 0
//   total    = round(net + gst, 2)
//
// When the API supplies stored totals (subTotal / discountAmount / gstAmount /
// totalAmount) those are authoritative and preferred: they are what the record
// and the server-rendered PDF both use. Recomputation is the fallback for a
// sheet driven from local JSON.

export const roundRupee = (n) => Math.round(n)

const round2 = (n) => Math.round(n * 100) / 100

/** A server-supplied figure, or null when it is absent/non-finite. */
const serverFigure = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function computeTotals(quotation) {
  const items = quotation.items ?? []

  const lines = items.map((item, index) => {
    const qty = Number(item.qty) || 0
    const rate = Number(item.rate) || 0
    // The backend rounds each line before summing (see _build_items).
    return { ...item, srNo: index + 1, qty, rate, amount: round2(qty * rate) }
  })

  // Sum of the per-line 2dp amounts. The subtotal keeps its paise - rounding it
  // to whole rupees here is what desynced the sheet from the stored record.
  const computedSubtotal = round2(lines.reduce((sum, l) => sum + l.amount, 0))
  const subtotal = serverFigure(quotation.subTotal) ?? computedSubtotal

  const gstPercent = Number(quotation.gstPercent) || 0
  const rawDiscount = Number(quotation.discount) || 0
  const discountType = quotation.discountType === 'percent' ? 'percent' : 'flat'

  const computedDiscount = discountType === 'percent'
    ? round2((subtotal * rawDiscount) / 100)
    : round2(rawDiscount)
  const discount = serverFigure(quotation.discountAmount) ?? computedDiscount

  const net = Math.max(round2(subtotal - discount), 0)
  const computedGst = gstPercent ? round2((net * gstPercent) / 100) : 0
  const gst = serverFigure(quotation.gstAmount) ?? computedGst

  const computedTotal = round2(net + gst)
  const grandTotal = serverFigure(quotation.totalAmount) ?? computedTotal

  return {
    lines,
    subtotal,
    discount,
    discountPercent: rawDiscount,
    discountType,
    // Driven by what the user entered, not by the computed amount: a percent
    // discount small enough to round to zero still has a DISCOUNT row to show.
    hasDiscount: rawDiscount > 0,
    net,
    gstPercent,
    gst,
    grandTotal,
  }
}

// Amount formatting.
//
// The target image prints plain digits with NO thousands separators and a
// trailing "/-"; the subtotal additionally carries a doubled "/-/-". That
// quirk is reproduced verbatim here so it can be changed in one place.
export const AMOUNT_SUFFIX = '/-'
export const SUBTOTAL_SUFFIX = '/-/-'

export function formatAmount(value) {
  return `${roundRupee(value)}${AMOUNT_SUFFIX}`
}

export function formatSubtotal(value) {
  return `${roundRupee(value)}${SUBTOTAL_SUFFIX}`
}

/** "2026-05-27" -> "27/05/2026". */
export function formatDate(value) {
  if (!value) return ''
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value).trim())
  if (!match) return String(value)
  const [, y, m, d] = match
  return `${d}/${m}/${y}`
}

export function formatCompanyName(name) {
  return name ? `CompanyName-${name}.` : ''
}

// ── loading external data ───────────────────────────────────────────────
//
// The sheet only ever reads a single `quotation` object, so anything that can
// produce that shape can drive it. `normaliseQuotation` fills the gaps so a
// partially filled JSON payload still renders instead of throwing.

const str = (v) => (v === null || v === undefined ? '' : String(v))
const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export class QuotationShapeError extends Error {}

export function normaliseQuotation(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new QuotationShapeError('Expected a JSON object at the top level.')
  }

  const rawItems = input.items ?? []
  if (!Array.isArray(rawItems)) {
    throw new QuotationShapeError('"items" must be an array.')
  }

  const company = input.company ?? {}
  const client = input.client ?? {}

  return {
    title: str(input.title),
    docLabel: str(input.docLabel ?? 'INVOICENO:-'),
    invoiceNo: str(input.invoiceNo),
    date: str(input.date),
    voucherNo: str(input.voucherNo),
    paymentTerm: str(input.paymentTerm),
    delivery: str(input.delivery),
    gstPercent: num(input.gstPercent),
    // Discount is applied before GST, matching the backend.
    discount: num(input.discount),
    discountType: str(input.discountType ?? 'flat'),
    // Stored totals from the API, when present. computeTotals prefers these.
    subTotal: serverFigure(input.subTotal),
    discountAmount: serverFigure(input.discountAmount),
    gstAmount: serverFigure(input.gstAmount),
    totalAmount: serverFigure(input.totalAmount),
    client: {
      name: str(client.name),
      address: str(client.address),
      kindAttn: str(client.kindAttn),
      gstNo: str(client.gstNo),
    },
    items: rawItems.map((it) => ({
      description: str(it?.description),
      hsn: str(it?.hsn),
      qty: num(it?.qty),
      rate: num(it?.rate),
    })),
    company: {
      name: str(company.name),
      gstin: str(company.gstin),
      bank: str(company.bank),
      branch: str(company.branch),
      accountNo: str(company.accountNo),
      ifsc: str(company.ifsc),
      msme: str(company.msme),
      email: str(company.email),
      website: str(company.website),
      phones: str(company.phones),
      address: str(company.address),
      stampImage: str(company.stampImage),
    },
  }
}

export function parseQuotationJson(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    throw new QuotationShapeError(`Invalid JSON: ${e.message}`)
  }
  return normaliseQuotation(parsed)
}

export function stampDataUri(base64) {
  if (!base64) return ''
  const head = base64.slice(0, 16)
  let mime = 'image/png'
  if (head.startsWith('/9j/')) mime = 'image/jpeg'
  else if (head.startsWith('R0lGOD')) mime = 'image/gif'
  else if (head.startsWith('UklGR')) mime = 'image/webp'
  else if (head.startsWith('iVBORw0KGgo')) mime = 'image/png'
  else if (head.startsWith('PHN2Zy')) mime = 'image/svg+xml'
  return `data:${mime};base64,${base64}`
}