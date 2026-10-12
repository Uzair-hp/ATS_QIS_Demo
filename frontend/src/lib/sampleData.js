// Representative sample data, used by Settings to show what a template looks
// like without needing a document to hand.
//
// This is the ONLY place invented content is allowed. The create/edit previews
// deliberately do not use it: they pass the document being built, because the
// old "sample preview" showed a PNG of an unrelated FORTIS HOSPITAL quotation
// next to an empty form and made the two look like the same document.

import { buildDocData } from './docData.js'

const SAMPLE_CLIENT = {
  company_name: 'Naval Dockyard Hospitality',
  name: 'Kailash Prabhat',
  address: 'Sector 62, Noida, Uttar Pradesh 201309',
  phone: '+91 98765 43210',
  email: 'accounts@example.in',
  gst_number: '09AAFCF1234A1Z5',
}

const SAMPLE_ITEMS = [
  { service_name: 'Automatic Boom Barrier Installation', hsn_code: '996311', description: '600mm heavy duty, single phase', quantity: 2, rate: 40000 },
  { service_name: 'Sliding Gate Motor 400kg', hsn_code: '850440', description: null, quantity: 1, rate: 14500 },
  { service_name: 'Preventive Maintenance — Annual AMC', hsn_code: '998719', description: 'Two visits, remote monitoring', quantity: 3, rate: 7200 },
]

const SAMPLE_COMPANY = {
  name: 'ATS Automation',
  tagline: 'Security & Systems',
  website: 'www.atsautomation.in',
  phone: '+91-9967399864',
  email: 'info@atsautomation.in',
  address: 'Main St, Nallasopara East, Virar East, Vasai-Virar, Mumbai, Maharashtra 401209',
  gst_number: '27BTHPT0851K1Z9',
  msme_number: 'UDYAM-MH-19-0045123',
  bank_name: 'HDFC Bank',
  bank_branch: 'Vasai East',
  bank_account: '50200012345678',
  bank_ifsc: 'HDFC0001234',
  upi_id: 'atsautomation@okhdfcbank',
}

const BASE = {
  client: SAMPLE_CLIENT,
  company: SAMPLE_COMPANY,
  items: SAMPLE_ITEMS,
  sub_total: 116700,
  discount: 5,
  discount_type: 'percent',
  discount_amount: 5835,
  gst_percent: 18,
  gst_amount: 19955.7,
  total_amount: 130820.7,
  date_created: '2026-10-12',
  status: 'Draft',
  notes: 'Supply, installation and commissioning included. Payment 50% advance, balance on installation. Warranty 12 months.',
}

/** A filled-in document for either type, for Settings previews. */
export function sampleData(docType) {
  const isInvoice = docType === 'invoice'
  return buildDocData(docType, {
    ...BASE,
    invoice_number: isInvoice ? 'ATS-INV-2026-001' : undefined,
    quotation_number: isInvoice ? undefined : 'ATS-QT-2026-001',
    due_date: isInvoice ? '2026-10-27' : undefined,
    valid_until: isInvoice ? undefined : '2026-10-27',
    payment_terms: '50% Advance, Balance on Installation',
    delivery_address: 'Main Gate, Sector 62, Noida, Uttar Pradesh 201309',
    estimated_timeline: isInvoice ? undefined : '2 weeks',
    voucher_number: isInvoice ? 'V-1042' : undefined,
    subject: isInvoice ? 'GARAGE DOOR' : 'BOOM BARRIER & GATE AUTOMATION',
    advance_amount: isInvoice ? 50000 : undefined,
    ...(isInvoice ? { status: 'Partially Paid' } : {}),
  }, SAMPLE_COMPANY)
}
