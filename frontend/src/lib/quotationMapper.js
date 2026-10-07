// Maps the JSON API responses onto the shape the print sheet expects
// (see lib/quotation.js :: normaliseQuotation).
//
// Two sources are needed:
//   - GET /api/quotations/:id  the quotation, its client and its items
//   - GET /api/settings/       company/bank details
//
// view_quotation only returns profile.{name,tagline,email,phone,address}
// (backend/routes/quotations.py), so the bank block, GSTIN and MSME number
// have to come from the settings endpoint. This is a pure function: no React,
// no axios, no side effects, so it can be unit-tested on its own.

const str = (v) => (v === null || v === undefined ? '' : String(v))

export function mapQuotationForPrint(quotation, settings) {
  const q = quotation ?? {}
  const client = q.client ?? {}
  const profile = q.profile ?? {}
  const company = settings ?? {}

  return {
    title: str(q.subject) || 'QUOTATION',
    docLabel: 'QUOTATION NO:-',
    invoiceNo: str(q.quotation_number),
    // ISO "YYYY-MM-DDTHH:MM:SS..." - normaliseQuotation/formatDate only reads
    // the leading date part, so it is passed through untouched.
    date: str(q.date_created),
    // Quotation has no voucher_number column (only Invoice does), so this row
    // is always blank for quotations.
    voucherNo: '',
    paymentTerm: str(q.payment_terms),
    delivery: str(q.delivery_address),
    gstPercent: Number(q.gst_percent) || 0,
    discount: Number(q.discount) || 0,
    discountType: str(q.discount_type) || 'flat',

    client: {
      name: str(client.company_name) || str(client.name),
      address: str(client.address),
      kindAttn: str(client.name),
      gstNo: str(client.gst_number),
    },

    items: (q.items ?? []).map((it) => ({
      // The sheet has a single "Particular" column, so the item name and its
      // description share it. print.css renders this cell with pre-wrap.
      description: [str(it?.service_name), str(it?.description)].filter(Boolean).join('\n'),
      hsn: str(it?.hsn_code),
      qty: it?.quantity,
      rate: it?.rate,
    })),

    company: {
      name: str(company.name) || str(profile.name),
      gstin: str(company.gst_number),
      bank: str(company.bank_name),
      branch: str(company.bank_branch),
      accountNo: str(company.bank_account),
      ifsc: str(company.bank_ifsc),
      msme: str(company.msme_number),
      email: str(company.email) || str(profile.email),
      website: str(company.website),
      phones: str(company.phone) || str(profile.phone),
      address: str(company.address) || str(profile.address),
      stampImage: str(company.stamp_image),
    },
  }
}

export default mapQuotationForPrint
