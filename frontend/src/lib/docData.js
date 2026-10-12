// The single data contract every document template renders from.
//
// Before this there were two mappers (invoiceMapper / quotationMapper) plus
// normaliseQuotation in quotation.js, and they disagreed: the quotation shape
// had no room for valid_until, estimated_timeline, status, advance or balance,
// so those silently vanished from the print sheet. One builder now produces one
// shape for both document types, and every template receives it.

import { amountWordsLabel, computeTotals, stampDataUri } from './quotation.js'

const str = (v) => (v === null || v === undefined ? '' : String(v))
const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export const DOC_TYPES = ['invoice', 'quotation']

/**
 * Money for display. Indian digit grouping, always two decimals.
 *
 * The retired templates rounded to whole rupees before printing ("945/-" for a
 * stored 944.50) and one of them suffixed the subtotal "/-/-". Both quietly
 * disagreed with the stored record, so neither is reproduced here.
 */
export function money(value) {
  const n = Number(value) || 0
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// Labels are part of the contract: the templates must not invent their own
// wording, so a redesign changes the document in one place.
const LABELS = {
  invoice: {
    docLabel: 'INVOICE NO:-',
    fallbackTitle: 'INVOICE',
    grandLabel: 'Grand Total',
    dateLabel: 'Date :-',
    notesHeading: 'Notes & Terms',
    signatureCaption: 'Signature',
    personCaption: 'Person Name',
    counterpartLine: 'BILL TO',
    docHeading: 'TAX INVOICE',
  },
  quotation: {
    docLabel: 'QUOTATION NO:-',
    fallbackTitle: 'QUOTATION',
    grandLabel: 'Grand Total',
    dateLabel: 'Date :-',
    notesHeading: 'Scope of Work, Exclusions & Terms',
    signatureCaption: 'Client Acceptance',
    personCaption: 'Name & Date',
    counterpartLine: 'PROPOSED FOR',
    docHeading: 'QUOTATION',
  },
}

export function labelsFor(docType) {
  return LABELS[docType] || LABELS.invoice
}

/**
 * Build the template input from an API document and the company settings.
 *
 * `doc` is GET /api/invoices/<id> or GET /api/quotations/<id>; `settings` is
 * GET /api/settings/. Both print pages and both create/edit previews pass
 * exactly this pair, which is what makes the four surfaces agree.
 *
 * Neither argument is required to be complete - a create form calls this with a
 * half-filled draft, so every read is defensive.
 */
export function buildDocData(docType, doc, settings) {
  const d = doc || {}
  const client = d.client || {}
  const company = settings || {}
  // The document endpoints return a narrower `profile` block than /settings/.
  // Settings wins because it carries the bank details and MSME number; the
  // inline profile is only a fallback for a caller that could not fetch it.
  const profile = d.profile || {}
  const labels = labelsFor(docType)

  const isInvoice = docType === 'invoice'

  const items = (d.items || []).map((it, i) => {
    const qty = num(it?.qty ?? it?.quantity)
    const rate = num(it?.rate)
    // A saved document carries the stored line amount; a create-form draft does
    // not, because the backend computes it. Falling back to qty x rate means the
    // preview shows the same figure the saved document will.
    const amount = it?.amount === undefined || it?.amount === null ? qty * rate : num(it.amount)
    return {
      srNo: i + 1,
      // One "Particular" column carries the name and its description, separated
      // by a newline; templates render it with white-space: pre-line.
      description: [str(it?.service_name), str(it?.description)].filter(Boolean).join('\n'),
      hsn: str(it?.hsn_code),
      qty,
      rate,
      amount,
      amountFormatted: money(amount),
    }
  })

  const totals = computeTotals({
    items: items.map((l) => ({ qty: l.qty, rate: l.rate })),
    gstPercent: d.gst_percent,
    discount: d.discount,
    discountType: d.discount_type,
    // Server-stored figures win; they are what the record says and what the
    // totals block must agree with.
    subTotal: d.sub_total,
    discountAmount: d.discount_amount,
    gstAmount: d.gst_amount,
    totalAmount: d.total_amount,
  })

  const advance = isInvoice ? num(d.advance_amount) : 0
  const balance = isInvoice ? Math.max(totals.grandTotal - advance, 0) : 0

  return {
    docType,
    isInvoice,
    ...labels,

    number: str(isInvoice ? d.invoice_number : d.quotation_number),
    title: str(d.subject).toUpperCase() || labels.fallbackTitle,
    date: str(d.date_created),
    dueDate: str(d.due_date),
    validUntil: str(d.valid_until),
    voucherNo: str(d.voucher_number),
    paymentTerm: str(d.payment_terms),
    delivery: str(d.delivery_address),
    timeline: str(d.estimated_timeline),
    refQuotation: str(d.ref_quotation_number),
    subject: str(d.subject),
    status: str(d.status),
    theme: str(d.pdf_theme),
    notes: str(d.notes),
    qrBase64: str(d.qr_base64),
    amountWords: amountWordsLabel(totals.grandTotal),

    client: {
      // A client row carries both a trading name and a contact name. The
      // document shows the trading name, with the contact as the "K/A" line.
      name: str(client.company_name) || str(client.name),
      kindAttn: str(client.name),
      address: str(client.address),
      phone: str(client.phone),
      email: str(client.email),
      gstNo: str(client.gst_number),
    },

    items,
    totals: {
      ...totals,
      advance,
      balance,
      hasAdvance: isInvoice && advance > 0,
      subtotalFormatted: money(totals.subtotal),
      discountFormatted: money(totals.discount),
      netFormatted: money(totals.net),
      gstFormatted: money(totals.gst),
      grandTotalFormatted: money(totals.grandTotal),
      advanceFormatted: money(advance),
      balanceFormatted: money(balance),
    },

    company: {
      name: str(company.name) || str(profile.name),
      tagline: str(company.tagline) || str(profile.tagline),
      // The uploaded company logo is used when present, so a company that
      // uploads one is not stamped with the bundled ATS mark.
      logo: company.logo_image
        ? stampDataUri(company.logo_image, company.logo_mime)
        : '',
      logoMime: str(company.logo_mime),
      gstin: str(company.gst_number) || str(profile.gst_number),
      msme: str(company.msme_number),
      bank: str(company.bank_name) || str(profile.bank_name),
      branch: str(company.bank_branch) || str(profile.bank_branch),
      accountNo: str(company.bank_account) || str(profile.bank_account),
      ifsc: str(company.bank_ifsc) || str(profile.bank_ifsc),
      upiId: str(company.upi_id) || str(profile.upi_id),
      email: str(company.email) || str(profile.email),
      website: str(company.website) || str(profile.website),
      phone: str(company.phone) || str(profile.phone),
      address: str(company.address) || str(profile.address),
      stamp: company.stamp_image
        ? stampDataUri(company.stamp_image, company.stamp_mime)
        : '',
    },
  }
}

/** A draft document for the create/edit live preview, before a record exists. */
export function buildDraftData(docType, draft, settings) {
  return buildDocData(docType, draft, settings)
}
