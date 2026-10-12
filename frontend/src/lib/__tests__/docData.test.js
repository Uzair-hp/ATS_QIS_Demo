import { describe, expect, it } from 'vitest'

import { buildDocData, labelsFor, money } from '../docData.js'

// One builder feeds the create preview, the print view and the saved document,
// so it is where a field can be lost. The quotation shape used to have no room
// for valid_until, estimated_timeline, status, advance or balance and they
// silently vanished from the print sheet - these tests pin that they are kept.

const SETTINGS = {
  name: 'ATS Automation',
  tagline: 'Security & Systems',
  bank_name: 'HDFC Bank',
  bank_branch: 'Vasai East',
  bank_account: '50200097301710',
  bank_ifsc: 'HDFC0001234',
  msme_number: 'UDYAM-MH-170148612',
  gst_number: '27BTHPT0851K1Z9',
  upi_id: 'ats@okaxis',
  email: 'info@atsautomation.in',
  phone: '+91-9967399864',
  address: 'Nallasopara East',
  website: 'www.atsautomation.in',
}

const QUOTATION = {
  quotation_number: 'ATS-QT-2026-014',
  subject: 'boom barrier',
  status: 'Accepted',
  date_created: '2026-10-12',
  valid_until: '2026-10-27',
  estimated_timeline: '2 weeks',
  voucher_number: '',
  payment_terms: '50% Advance',
  delivery_address: 'Gate 4',
  notes: 'Scope and terms',
  sub_total: 800,
  discount: 5,
  discount_type: 'percent',
  discount_amount: 40,
  gst_percent: 18,
  gst_amount: 136.8,
  total_amount: 896.8,
  pdf_theme: 'q3_minimal',
  client: { name: 'Kailash', company_name: 'Fortis', gst_number: '09AAAAA', address: 'Noida' },
  items: [{ service_name: 'Barrier', description: '600mm', hsn_code: '996311', quantity: 2, rate: 400 }],
}

const INVOICE = {
  ...QUOTATION,
  quotation_number: undefined,
  invoice_number: 'ATS-INV-2026-011',
  due_date: '2026-10-27',
  voucher_number: 'V-1',
  advance_amount: 400,
  estimated_timeline: undefined,
}

describe('money', () => {
  it('keeps paise, which the old sheet rounded away', () => {
    expect(money(944.5)).toBe('₹944.50')
    expect(money(0.4)).toBe('₹0.40')
  })

  it('groups in Indian notation', () => {
    expect(money(1234567.89)).toBe('₹12,34,567.89')
  })

  it('treats a missing value as zero', () => {
    expect(money(null)).toBe('₹0.00')
    expect(money(undefined)).toBe('₹0.00')
  })
})

describe('quotation fields', () => {
  const d = buildDocData('quotation', QUOTATION, SETTINGS)

  it('carries the fields the old quotation shape dropped', () => {
    expect(d.validUntil).toBe('2026-10-27')
    expect(d.timeline).toBe('2 weeks')
    expect(d.status).toBe('Accepted')
  })

  it('uppercases the subject for the heading and keeps it for the banner', () => {
    expect(d.title).toBe('BOOM BARRIER')
    expect(d.subject).toBe('boom barrier')
  })

  it('falls back to the document heading when there is no subject', () => {
    expect(buildDocData('quotation', { ...QUOTATION, subject: null }, SETTINGS).title)
      .toBe('QUOTATION')
  })

  it('uses the quotation labels', () => {
    expect(d.docLabel).toBe('QUOTATION NO:-')
    expect(d.signatureCaption).toBe('Client Acceptance')
    expect(d.notesHeading).toBe('Scope of Work, Exclusions & Terms')
  })

  it('has no advance or balance, because a quotation has nothing to collect', () => {
    expect(d.totals.hasAdvance).toBe(false)
    expect(d.totals.advanceFormatted).toBe('₹0.00')
  })

  it('joins the item name and description into one Particular cell', () => {
    expect(d.items[0].description).toBe('Barrier\n600mm')
    expect(d.items[0].amountFormatted).toBe('₹800.00')
  })

  it('numbers the rows', () => {
    const two = buildDocData('quotation', {
      ...QUOTATION,
      items: [...QUOTATION.items, { service_name: 'AMC', quantity: 1, rate: 100 }],
    }, SETTINGS)
    expect(two.items.map((i) => i.srNo)).toEqual([1, 2])
  })

  it('reads the saved template key so the print view can render it', () => {
    expect(d.theme).toBe('q3_minimal')
  })
})

describe('invoice fields', () => {
  const d = buildDocData('invoice', INVOICE, SETTINGS)

  it('carries the invoice-only fields', () => {
    expect(d.dueDate).toBe('2026-10-27')
    expect(d.voucherNo).toBe('V-1')
    expect(d.totals.hasAdvance).toBe(true)
    expect(d.totals.advanceFormatted).toBe('₹400.00')
    expect(d.totals.balanceFormatted).toBe('₹496.80')
  })

  it('uses the invoice labels', () => {
    expect(d.docLabel).toBe('INVOICE NO:-')
    expect(d.signatureCaption).toBe('Signature')
  })

  it('carries the UPI QR when the API supplies one', () => {
    const withQr = buildDocData('invoice', { ...INVOICE, qr_base64: 'AAA' }, SETTINGS)
    expect(withQr.qrBase64).toBe('AAA')
  })

  it('has no QR for a quotation', () => {
    expect(buildDocData('quotation', { ...QUOTATION, qr_base64: 'AAA' }, SETTINGS).qrBase64)
      .toBe('AAA')
  })
})

describe('company block', () => {
  const d = buildDocData('quotation', QUOTATION, SETTINGS)

  it('takes the bank block, MSME and GSTIN from settings', () => {
    expect(d.company.bank).toBe('HDFC Bank')
    expect(d.company.ifsc).toBe('HDFC0001234')
    expect(d.company.msme).toBe('UDYAM-MH-170148612')
    expect(d.company.gstin).toBe('27BTHPT0851K1Z9')
  })

  it('falls back to the document profile when settings are unavailable', () => {
    const noSettings = buildDocData('quotation', {
      ...QUOTATION,
      profile: { name: 'Fallback Co', bank_name: 'SBI' },
    }, {})
    expect(noSettings.company.name).toBe('Fallback Co')
    expect(noSettings.company.bank).toBe('SBI')
  })

  it('uses the company-uploaded logo rather than a bundled one', () => {
    const withLogo = buildDocData('quotation', QUOTATION, {
      ...SETTINGS,
      logo_image: 'QUJD',
      logo_mime: 'image/png',
    })
    expect(withLogo.company.logo).toBe('data:image/png;base64,QUJD')
    expect(buildDocData('quotation', QUOTATION, SETTINGS).company.logo).toBe('')
  })

  it('keeps the stamp, and leaves the slot empty when there is none', () => {
    expect(buildDocData('quotation', QUOTATION, SETTINGS).company.stamp).toBe('')
    expect(buildDocData('quotation', QUOTATION, { ...SETTINGS, stamp_image: 'QUJD' })
      .company.stamp).toBe('data:image/png;base64,QUJD')
  })
})

describe('defensive behaviour', () => {
  it('renders from an empty document rather than throwing', () => {
    const d = buildDocData('quotation', undefined, undefined)
    expect(d.items).toEqual([])
    expect(d.client.name).toBe('')
    expect(d.company.name).toBe('')
    expect(d.totals.grandTotalFormatted).toBe('₹0.00')
  })

  it('coerces junk values instead of stringifying them into the page', () => {
    const d = buildDocData('quotation', {
      ...QUOTATION,
      gst_percent: 'abc',
      items: [{ service_name: 'x', quantity: null, rate: undefined }],
    }, SETTINGS)
    expect(d.totals.gstPercent).toBe(0)
    expect(d.items[0].qty).toBe(0)
    expect(d.items[0].rate).toBe(0)
  })

  it('gives each document type its own labels', () => {
    expect(labelsFor('invoice').docHeading).toBe('TAX INVOICE')
    expect(labelsFor('quotation').docHeading).toBe('QUOTATION')
    expect(labelsFor('nonsense').docHeading).toBe('TAX INVOICE')
  })

  it('produces the amount in words for the grand total', () => {
    expect(buildDocData('quotation', QUOTATION, SETTINGS).amountWords)
      .toBe('Eight Hundred and Ninety-Six Rupees Only and 80 Paise Only')
  })
})
