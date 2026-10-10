import { describe, expect, it } from 'vitest'

import {
  invoicePdfHref,
  pdfHref,
  quotationPdfHref,
  savedPdfHref,
} from '../pdfHref.js'

describe('pdfHref', () => {
  it('builds an invoice download URL', () => {
    expect(pdfHref('invoice', 12)).toBe('/api/invoices/12/pdf')
  })

  it('builds a quotation download URL', () => {
    expect(pdfHref('quotation', 34)).toBe('/api/quotations/34/pdf')
  })

  it('omits the query string when there is no one-time choice', () => {
    expect(pdfHref('invoice', 1, {})).toBe('/api/invoices/1/pdf')
    expect(pdfHref('invoice', 1)).not.toContain('theme=')
  })

  it('appends ?theme= when a one-time choice is given', () => {
    expect(pdfHref('invoice', 1, { theme: 't3_minimal' }))
      .toBe('/api/invoices/1/pdf?theme=t3_minimal')
  })

  it('encodes a hostile theme value instead of letting it into the query', () => {
    const href = pdfHref('invoice', 1, { theme: 'a b&c=d' })
    expect(href).toBe('/api/invoices/1/pdf?theme=a%20b%26c%3Dd')
  })

  it('returns a dead link for an unknown type or a missing id', () => {
    expect(pdfHref('credit_note', 1)).toBe('#')
    expect(pdfHref('invoice', null)).toBe('#')
    expect(pdfHref(undefined, 1)).toBe('#')
  })
})

describe('savedPdfHref', () => {
  it('uses the template stored on the document', () => {
    expect(savedPdfHref('invoice', { id: 7, pdf_theme: 't5_compact_dense' }))
      .toBe('/api/invoices/7/pdf?theme=t5_compact_dense')
  })

  it('omits the query string when the document has no template of its own', () => {
    expect(savedPdfHref('quotation', { id: 8, pdf_theme: null }))
      .toBe('/api/quotations/8/pdf')
    expect(savedPdfHref('quotation', { id: 8 }))
      .toBe('/api/quotations/8/pdf')
  })
})

describe('invoicePdfHref / quotationPdfHref', () => {
  it('delegate to the shared builder with the right document type', () => {
    expect(invoicePdfHref({ id: 3, pdf_theme: 'classic_gst' }))
      .toBe('/api/invoices/3/pdf?theme=classic_gst')
    expect(quotationPdfHref({ id: 4, pdf_theme: 'q1_classic' }))
      .toBe('/api/quotations/4/pdf?theme=q1_classic')
  })
})