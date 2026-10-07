// Sample quotation reproducing `FORTIS HOSPITAL_page-0001.jpg` exactly.
//
// TODO: replace this import with a fetch of `/api/quotations/:id` when the
// Flask API is migrated. `QuotationForm` and `QuotationPrint` both receive
// this object shape as a single `quotation` prop and never import it
// themselves, so swapping this module for a fetch is the only change needed.
const sampleQuotation = {
  title: 'GARAGE DOOR',
  docLabel: 'INVOICENO:-',
  invoiceNo: '',
  date: '2026-05-27',
  voucherNo: '',
  paymentTerm: '100% Advance',
  delivery: 'NAVAL DOCKYARD KOLABA',
  client: {
    name: 'Prakash Pituha',
    address: 'Mira road',
    kindAttn: 'MR. Prakash',
    gstNo: '27AAZCS9860N1ZY',
  },
  items: [
    {
      description:
        'Garage Door Size: Length 5330mm, Height 2580mm. Model SN6041 Motor For Garage Door',
      hsn: '998719',
      qty: 1,
      rate: 53223,
    },
    { description: 'SNA6 preassembled guide 4m (3+1m)', hsn: '', qty: 1, rate: 19334 },
    { description: 'Installation Charges', hsn: '', qty: 1, rate: 7000 },
  ],
  gstPercent: 18,
  company: {
    name: 'ATS AUTOMATION',
    gstin: '27BTHPT0851K1Z9',
    bank: 'HDFC BANK',
    branch: 'KANDIVALI (E)',
    accountNo: '50200097301710',
    ifsc: 'HDFC0000182',
    msme: 'UDYAM-MH-170148612',
    email: 'info@atsautomation.in',
    website: 'www.atsautomation.in',
    phones: '+91-9967399864 | +91-8454068378',
    address: 'Main St, Nallasopara East, Vasai Virar, Maharashtra 401209',
  },
}

export default sampleQuotation