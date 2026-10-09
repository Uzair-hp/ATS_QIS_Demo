import { describe, expect, it } from 'vitest'
import { mapInvoiceForPrint } from '../invoiceMapper.js'

// Shaped exactly like backend/routes/invoices.py::_invoice_json(detailed=True)
// as returned by view_invoice, plus the separate GET /api/settings/ payload.
const apiInvoice = {
  id: 1,
  invoice_number: 'ATS-INV-2026-001',
  client_id: 1,
  client_name: 'Prakash Pituha',
  date_created: '2026-05-27T14:03:11.482000',
  due_date: '2026-06-11T00:00:00',
  sub_total: 99.99,
  discount: 10,
  discount_type: 'percent',
  discount_amount: 10.0,
  total_amount: 106.19,
  advance_amount: 0,
  balance_due: 106.19,
  status: 'Pending',
  payment_mode: null,
  notes: null,
  is_archived: false,
  ref_quotation_number: 'ATS-QT-2026-001',
  subject: 'BOOM BARRIER',
  delivery_address: 'Kolaba, Mumbai',
  payment_terms: '50% Advance',
  voucher_number: 'VCH-77',
  gst_percent: 18.0,
  gst_amount: 16.2,
  is_overdue: false,
  qr_base64: 'iVBORw0KGgo=',
  logo_base64: 'iVBORw0KGgo=',
  whatsapp_url: 'https://wa.me/919000000000',
  email_url: 'mailto:info@atsautomation.in',
  items: [
    { id: 1, service_name: 'Sliding Gate Motor', description: '400kg capacity',
      hsn_code: '996521', quantity: 3, rate: 33.33, amount: 99.99 },
  ],
  client: {
    id: 1,
    name: 'Prakash Pituha',
    company_name: 'NAVAL DOCKYARD KOLABA',
    email: 'p@example.com',
    phone: '+91-9000000000',
    address: 'Kolaba, Mumbai',
    gst_number: '27AAAAA0000A1Z5',
  },
  profile: {
    name: 'ATS Automation',
    email: 'info@atsautomation.in',
    phone: '+91-9967399864',
    bank_name: 'HDFC Bank',
    bank_account: '50200097301710',
    bank_ifsc: 'HDFC0001234',
    bank_branch: 'Virar East',
    upi_id: null,
    gst_number: '27BTHPT0851K1Z9',
  },
}

const apiSettings = {
  name: 'ATS Automation',
  tagline: 'Security & Systems',
  email: 'info@atsautomation.in',
  phone: '+91-9967399864',
  website: 'www.atsautomation.in',
  address: 'Main St, Nallasopara East',
  bank_name: 'HDFC Bank', bank_branch: 'Virar East',
  bank_account: '50200097301710', bank_ifsc: 'HDFC0001234',
  gst_number: '27BTHPT0851K1Z9', msme_number: 'UDYAM-MH-170148612',
  stamp_image: 'iVBORw0KGgo=',
}

describe('mapInvoiceForPrint', () => {
  it('labels the document as an invoice', () => {
    const m = mapInvoiceForPrint(apiInvoice, apiSettings)
    expect(m.docLabel).toBe('INVOICE NO:-')
    expect(m.invoiceNo).toBe('ATS-INV-2026-001')
  })

  // The distinguishing fields between the two document types. A quotation has
  // no voucher_number column, so this row is always blank there.
  it('carries the voucher number, which quotations lack', () => {
    expect(mapInvoiceForPrint(apiInvoice, apiSettings).voucherNo).toBe('VCH-77')
  })

  it('leaves the voucher number blank when none is set', () => {
    const m = mapInvoiceForPrint(
      { ...apiInvoice, voucher_number: null }, apiSettings,
    )
    expect(m.voucherNo).toBe('')
  })

  it('passes the stored totals through for computeTotals to prefer', () => {
    const m = mapInvoiceForPrint(apiInvoice, apiSettings)
    expect(m.subTotal).toBe(99.99)
    expect(m.discountAmount).toBe(10.0)
    expect(m.gstAmount).toBe(16.2)
    expect(m.totalAmount).toBe(106.19)
  })

  it('uses the subject as the title, falling back to INVOICE', () => {
    expect(mapInvoiceForPrint(apiInvoice, apiSettings).title).toBe('BOOM BARRIER')
    expect(mapInvoiceForPrint({ ...apiInvoice, subject: null }, apiSettings).title)
      .toBe('INVOICE')
  })

  it('prefers the client company name and keeps the contact as attn', () => {
    expect(mapInvoiceForPrint(apiInvoice, apiSettings).client).toEqual({
      name: 'NAVAL DOCKYARD KOLABA',
      address: 'Kolaba, Mumbai',
      kindAttn: 'Prakash Pituha',
      gstNo: '27AAAAA0000A1Z5',
    })
  })

  it('joins the item name and description with a newline', () => {
    const m = mapInvoiceForPrint(apiInvoice, apiSettings)
    expect(m.items[0].description).toBe('Sliding Gate Motor\n400kg capacity')
  })

  it('maps qty, rate and hsn from the item row', () => {
    expect(mapInvoiceForPrint(apiInvoice, apiSettings).items[0]).toMatchObject({
      hsn: '996521', qty: 3, rate: 33.33,
    })
  })

  it('takes the company block from settings, including MSME and the stamp', () => {
    // view_invoice returns a wider profile than view_quotation, but no MSME and
    // no stamp, so /api/settings/ remains the only source for those.
    expect(mapInvoiceForPrint(apiInvoice, apiSettings).company).toMatchObject({
      gstin: '27BTHPT0851K1Z9',
      bank: 'HDFC Bank',
      branch: 'Virar East',
      accountNo: '50200097301710',
      ifsc: 'HDFC0001234',
      msme: 'UDYAM-MH-170148612',
      stampImage: 'iVBORw0KGgo=',
      website: 'www.atsautomation.in',
    })
  })

  it('falls back to the invoice profile when settings are missing', () => {
    const m = mapInvoiceForPrint(apiInvoice, null)
    expect(m.company.name).toBe('ATS Automation')
    expect(m.company.bank).toBe('HDFC Bank')
    expect(m.company.gstin).toBe('27BTHPT0851K1Z9')
    expect(m.company.msme).toBe('')
    expect(m.company.stampImage).toBe('')
  })

  it('survives an invoice with no items', () => {
    expect(mapInvoiceForPrint({ ...apiInvoice, items: null }, apiSettings).items)
      .toEqual([])
  })

  it('survives being handed nothing at all', () => {
    const m = mapInvoiceForPrint(undefined, undefined)
    expect(m.items).toEqual([])
    expect(m.title).toBe('INVOICE')
    expect(m.voucherNo).toBe('')
  })
})
