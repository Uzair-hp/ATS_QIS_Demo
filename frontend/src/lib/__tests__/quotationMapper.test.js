import { describe, expect, it } from 'vitest'
import { mapQuotationForPrint } from '../quotationMapper.js'

// Shaped exactly like backend/routes/quotations.py::_quotation_json(detailed=True)
// plus the separate GET /api/settings/ payload.
const apiQuotation = {
  id: 1,
  quotation_number: 'ATS-QT-2026-001',
  client_id: 1,
  client_name: 'Prakash Pituha',
  date_created: '2026-05-27T14:03:11.482000',
  valid_until: '2026-06-11T00:00:00',
  estimated_timeline: '4-6 weeks',
  sub_total: 99.99,
  discount: 10,
  discount_type: 'percent',
  discount_amount: 10.0,
  gst_percent: 18.0,
  gst_amount: 16.2,
  total_amount: 106.19,
  status: 'Draft',
  subject: 'BOOM BARRIER',
  delivery_address: 'Kolaba, Mumbai',
  payment_terms: '50% Advance',
  notes: null,
  is_archived: false,
  is_expired: false,
  logo_base64: 'iVBORw0KGgo=',
  whatsapp_url: 'https://wa.me/919000000000',
  email_url: 'mailto:info@atsautomation.in',
  client: {
    id: 1,
    name: 'Prakash Pituha',
    company_name: 'NAVAL DOCKYARD KOLABA',
    email: 'p@example.com',
    phone: '+91-9000000000',
    address: 'Kolaba, Mumbai',
    gst_number: '27AAAAA0000A1Z5',
  },
  items: [
    { id: 1, service_name: 'Sliding Gate Motor', description: '400kg capacity',
      hsn_code: '996521', quantity: 3, rate: 33.33, amount: 99.99 },
  ],
  profile: {
    name: 'ATS Automation', tagline: 'Security & Systems',
    email: 'info@atsautomation.in', phone: '+91-9967399864',
    address: 'Main St, Nallasopara East',
  },
}

const apiSettings = {
  name: 'ATS Automation',
  tagline: 'Security & Systems',
  email: 'info@atsautomation.in',
  phone: '+91-9967399864',
  website: 'www.atsautomation.in',
  address: 'Main St, Nallasopara East',
  upi_id: null, upi_name: null,
  bank_name: 'HDFC Bank', bank_branch: 'Virar East',
  bank_account: '50200097301710', bank_ifsc: 'HDFC0001234',
  gst_number: '27BTHPT0851K1Z9', msme_number: 'UDYAM-MH-170148612',
  stamp_image: 'iVBORw0KGgo=',
  default_gst_percent: 18.0,
  default_terms: '', default_quotation_terms: '', default_due_days: 15,
}

describe('mapQuotationForPrint', () => {
  it('passes the stored totals through for computeTotals to prefer', () => {
    const m = mapQuotationForPrint(apiQuotation, apiSettings)
    expect(m.subTotal).toBe(99.99)
    expect(m.discountAmount).toBe(10.0)
    expect(m.gstAmount).toBe(16.2)
    expect(m.totalAmount).toBe(106.19)
  })

  it('labels the document as a quotation, not an invoice', () => {
    expect(mapQuotationForPrint(apiQuotation, apiSettings).docLabel)
      .toBe('QUOTATION NO:-')
  })

  it('uses the subject as the title, falling back to QUOTATION', () => {
    expect(mapQuotationForPrint(apiQuotation, apiSettings).title).toBe('BOOM BARRIER')
    expect(mapQuotationForPrint({ ...apiQuotation, subject: null }, apiSettings).title)
      .toBe('QUOTATION')
  })

  it('prefers the client company name and keeps the contact as attn', () => {
    expect(mapQuotationForPrint(apiQuotation, apiSettings).client).toEqual({
      name: 'NAVAL DOCKYARD KOLABA',
      address: 'Kolaba, Mumbai',
      kindAttn: 'Prakash Pituha',
      gstNo: '27AAAAA0000A1Z5',
    })
  })

  it('falls back to the contact name when there is no company', () => {
    const m = mapQuotationForPrint(
      { ...apiQuotation, client: { ...apiQuotation.client, company_name: null } },
      apiSettings,
    )
    expect(m.client.name).toBe('Prakash Pituha')
  })

  it('joins the item name and description with a newline', () => {
    const m = mapQuotationForPrint(apiQuotation, apiSettings)
    expect(m.items[0].description).toBe('Sliding Gate Motor\n400kg capacity')
  })

  it('omits the newline when an item has no description', () => {
    const m = mapQuotationForPrint(
      { ...apiQuotation, items: [{ ...apiQuotation.items[0], description: null }] },
      apiSettings,
    )
    expect(m.items[0].description).toBe('Sliding Gate Motor')
  })

  it('maps qty, rate and hsn from the item row', () => {
    const m = mapQuotationForPrint(apiQuotation, apiSettings)
    expect(m.items[0]).toMatchObject({ hsn: '996521', qty: 3, rate: 33.33 })
  })

  // view_quotation only returns five profile fields, so bank/GSTIN/MSME/stamp
  // can only come from /api/settings/. If these regress the sheet silently
  // prints an empty bank block.
  it('takes bank, GSTIN, MSME and the stamp from the settings payload', () => {
    expect(mapQuotationForPrint(apiQuotation, apiSettings).company).toMatchObject({
      gstin: '27BTHPT0851K1Z9',
      bank: 'HDFC Bank',
      branch: 'Virar East',
      accountNo: '50200097301710',
      ifsc: 'HDFC0001234',
      msme: 'UDYAM-MH-170148612',
      stampImage: 'iVBORw0KGgo=',
    })
  })

  it('falls back to the quotation profile when settings are missing', () => {
    const m = mapQuotationForPrint(apiQuotation, null)
    expect(m.company.name).toBe('ATS Automation')
    expect(m.company.email).toBe('info@atsautomation.in')
    expect(m.company.bank).toBe('')
  })

  it('leaves the voucher number blank - quotations have no such column', () => {
    expect(mapQuotationForPrint(apiQuotation, apiSettings).voucherNo).toBe('')
  })

  it('survives a quotation with no items', () => {
    const m = mapQuotationForPrint({ ...apiQuotation, items: null }, apiSettings)
    expect(m.items).toEqual([])
  })

  it('survives being handed nothing at all', () => {
    const m = mapQuotationForPrint(undefined, undefined)
    expect(m.items).toEqual([])
    expect(m.title).toBe('QUOTATION')
    expect(m.client.name).toBe('')
  })
})
