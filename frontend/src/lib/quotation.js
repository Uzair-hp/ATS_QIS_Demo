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
// and the templates both use. Recomputation is the fallback for a sheet driven
// from local JSON.

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

// Amount and date formatting live in docData.js (money) and below (formatDate).
// The old "/-" and "/-/-" suffixes were reproduced from a reference scan and
// rounded away real paise, so they are gone with the templates that used them.

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

// ── images ──────────────────────────────────────────────────────────────

/**
 * Wrap a stored base64 blob in a data URI.
 *
 * `mime` is the value the backend sniffed from the upload's magic bytes and
 * stored alongside it, so it is authoritative when present. The sniffing below
 * is the fallback for a caller that has the blob but not the recorded type.
 */
export function stampDataUri(base64, mime) {
  if (!base64) return ''
  if (mime) return `data:${mime};base64,${base64}`
  const head = base64.slice(0, 16)
  let sniffed = 'image/png'
  if (head.startsWith('/9j/')) sniffed = 'image/jpeg'
  else if (head.startsWith('R0lGOD')) sniffed = 'image/gif'
  else if (head.startsWith('UklGR')) sniffed = 'image/webp'
  else if (head.startsWith('iVBORw0KGgo')) sniffed = 'image/png'
  else if (head.startsWith('PHN2Zy')) sniffed = 'image/svg+xml'
  return `data:${sniffed};base64,${base64}`
}

// ── amount in words ──────────────────────────────────────────────────────

// Indian numbering (Crore / Lakh / Thousand), matching the macro the retired
// Jinja templates used. Ported rather than dropped: the shipped PDFs carried
// this line and losing it is a regression customers notice.

const ONES = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight',
  'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
  'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigit(x) {
  if (x < 0) return ''
  if (x < 10) return ONES[x]
  if (x < 20) return ONES[x]
  const t = TENS[Math.floor(x / 10)]
  const o = x % 10
  return o ? `${t}-${ONES[o]}` : t
}

function threeDigit(x) {
  if (x <= 0) return ''
  const h = Math.floor(x / 100)
  const r = x % 100
  if (!h) return twoDigit(r)
  if (!r) return `${ONES[h]} Hundred`
  return `${ONES[h]} Hundred and ${twoDigit(r)}`
}

export function amountInWords(value) {
  const v = Math.floor(Number(value) || 0)
  if (v <= 0) return 'Zero Rupees Only'
  const crore = Math.floor(v / 10000000)
  const lakh = Math.floor((v % 10000000) / 100000)
  const thousand = Math.floor((v % 100000) / 1000)
  const last3 = v % 1000
  const parts = []
  if (crore) parts.push(`${twoDigit(crore)} Crore`)
  if (lakh) parts.push(`${twoDigit(lakh)} Lakh`)
  if (thousand) parts.push(`${twoDigit(thousand)} Thousand`)
  const tail = threeDigit(last3)
  if (tail) parts.push(tail)
  return `${parts.join(' ')} Rupees Only`
}

/** Whole rupees plus a paise clause when the amount is not round. */
export function amountWordsLabel(value) {
  const n = Number(value) || 0
  const rupees = Math.floor(n)
  const paise = Math.round((n - rupees) * 100)
  if (paise > 0) {
    return `${amountInWords(n)} and ${paise} Paise Only`
  }
  return amountInWords(n)
}