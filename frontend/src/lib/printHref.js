// Where a document's PDF comes from.
//
// There is no server-side PDF endpoint any more. The document is rendered by
// the React print view, so "Download PDF" navigates there and opens the browser
// print dialog, which offers Save as PDF. That is what removed the second,
// silently-diverging layout - and why a Download can no longer disagree with
// what the print view shows.
//
// The template is NOT carried in the URL. It lives on the record, the print
// view reads it from there, and its dropdown writes it back. A URL template
// override would reintroduce exactly the "one-time choice that is not the saved
// one" behaviour this replaced.

const SIDES = { invoice: 'invoices', quotation: 'quotations' }

/** The print route for a document. `autoPrint` opens the dialog on arrival. */
export function printHref(docType, id, { autoPrint = false } = {}) {
  const side = SIDES[docType]
  if (!side || !id) return '#'
  return `/${side}/${id}/print${autoPrint ? '?print=1' : ''}`
}

/** Same route, for a document object from a list or detail response. */
export function docPrintHref(docType, doc, { autoPrint = false } = {}) {
  return printHref(docType, doc?.id, { autoPrint })
}

export const invoicePrintHref = (doc, opts) => docPrintHref('invoice', doc, opts)
export const quotationPrintHref = (doc, opts) => docPrintHref('quotation', doc, opts)
