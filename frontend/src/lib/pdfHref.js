// Build the PDF download URL for a document.
//
// A plain <a href> download: the browser follows it, the session cookie
// authenticates it, and the Content-Disposition header starts the download.
// No blob handling, per the project's download convention.
//
// The template is normally resolved server-side, so no query string is needed.
// Passing a one-time choice appends ?theme= for that download only - it is never
// written back to the document. Passing an explicit `saved` reads the template
// stored on the document, which is what list and view pages want.

const SIDES = { invoice: 'invoices', quotation: 'quotations' }

export function pdfHref(docType, id, { theme } = {}) {
  const side = SIDES[docType]
  if (!side || !id) return '#'
  const base = `/api/${side}/${id}/pdf`
  return theme ? `${base}?theme=${encodeURIComponent(theme)}` : base
}

/** The template saved on the document, if any. Falls back to no query string. */
export function savedPdfHref(docType, doc) {
  return pdfHref(docType, doc?.id, { theme: doc?.pdf_theme })
}

export function invoicePdfHref(inv) {
  return savedPdfHref('invoice', inv)
}

export function quotationPdfHref(q) {
  return savedPdfHref('quotation', q)
}