// Maps the invoice JSON API response onto the shape the print sheet expects
// (see lib/quotation.js :: normaliseQuotation).
//
// Two sources are needed:
//   - GET /api/invoices/:id    the invoice, its client and its items
//   - GET /api/settings/       company/bank details
//
// view_invoice returns a broader `profile` block than view_quotation does, but
// not MSME or the stamp, so the company block is taken from /api/settings/
// exactly as quotationMapper does. This is a pure function: no React, no axios,
// no side effects, so it can be unit-tested on its own.

const str = (v) => (v === null || v === undefined ? '' : String(v))

export function mapInvoiceForPrint(invoice, settings) {
  const inv = invoice ?? {}
  const client = inv.client ?? {}
  const profile = inv.profile ?? {}
  const company = settings ?? {}

  return {
    title: str(inv.subject) || 'INVOICE',
    docLabel: 'INVOICE NO:-',
    invoiceNo: str(inv.invoice_number),
    // ISO "YYYY-MM-DDTHH:MM:SS..." - normaliseQuotation/formatDate only reads
    // the leading date part, so it is passed through untouched.
    date: str(inv.date_created),
    // Unlike a quotation, an invoice does carry a voucher_number.
    voucherNo: str(inv.voucher_number),
    paymentTerm: str(inv.payment_terms),
    delivery: str(inv.delivery_address),
    gstPercent: Number(inv.gst_percent) || 0,
    discount: Number(inv.discount) || 0,
    discountType: str(inv.discount_type) || 'flat',
    // The API returns the stored, already-computed totals. They are what the
    // database holds and what the server-rendered PDF prints, so the sheet must
    // show these rather than recomputing them from the item rows.
    subTotal: inv.sub_total,
    discountAmount: inv.discount_amount,
    gstAmount: inv.gst_amount,
    totalAmount: inv.total_amount,

    client: {
      name: str(client.company_name) || str(client.name),
      address: str(client.address),
      kindAttn: str(client.name),
      gstNo: str(client.gst_number),
    },

    items: (inv.items ?? []).map((it) => ({
      // The sheet has a single "Particular" column, so the item name and its
      // description share it, separated by a newline. print.css sets
      // `white-space: pre-line` on .qp-particular to keep that break.
      description: [str(it?.service_name), str(it?.description)].filter(Boolean).join('\n'),
      hsn: str(it?.hsn_code),
      qty: it?.quantity,
      rate: it?.rate,
    })),

    company: {
      name: str(company.name) || str(profile.name),
      gstin: str(company.gst_number) || str(profile.gst_number),
      bank: str(company.bank_name) || str(profile.bank_name),
      branch: str(company.bank_branch) || str(profile.bank_branch),
      accountNo: str(company.bank_account) || str(profile.bank_account),
      ifsc: str(company.bank_ifsc) || str(profile.bank_ifsc),
      msme: str(company.msme_number),
      email: str(company.email) || str(profile.email),
      website: str(company.website),
      phones: str(company.phone) || str(profile.phone),
      address: str(company.address) || str(profile.address),
      stampImage: str(company.stamp_image),
    },
  }
}

export default mapInvoiceForPrint
