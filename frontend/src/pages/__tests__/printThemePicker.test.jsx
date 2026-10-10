// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'

import InvoicePrintPage from '../InvoicePrintPage.jsx'
import QuotationPrintPage from '../QuotationPrintPage.jsx'

// The print-page picker is a one-time ?theme= override. It has to start from the
// template saved on the document, which the API returns as pdf_theme. An earlier
// version read `invoice.pdfTheme`, so the picker always started empty and the
// document's own template was invisible.
const THEMES = {
  invoices: [
    { category: 'Default', items: [{ key: 'classic_gst', label: 'Default (Company Standard)', description: 'GST invoice' }] },
    { category: 'Professional', items: [{ key: 't5_compact_dense', label: 'Compact Dense', description: 'Compact' }] },
  ],
  quotations: [
    { category: 'Default', items: [{ key: 'classic', label: 'Default (Company Standard)', description: 'Plain' }] },
    { category: 'Specialised', items: [{ key: 'q1_classic', label: 'Classic', description: 'Classic style' }] },
  ],
  default_invoice: 'classic_gst',
  default_quotation: 'classic',
}

const get = vi.fn()

vi.mock('../../api/client', () => ({
  default: { get: (...a) => get(...a) },
}))

vi.mock('../../components/Layout', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../../components/DocumentPrint', () => ({
  default: () => <div data-testid="sheet" />,
}))

vi.mock('react-to-print', () => ({
  useReactToPrint: () => () => {},
}))

vi.mock('../../lib/invoiceMapper', () => ({
  mapInvoiceForPrint: () => ({}),
}))

vi.mock('../../lib/quotationMapper', () => ({
  mapQuotationForPrint: () => ({}),
}))

vi.mock('../../lib/quotation', () => ({
  normaliseQuotation: (q) => q,
}))

vi.mock('../../../public/assets/watermark.svg', () => ({
  default: '/watermark.svg',
}))

vi.mock('react-router-dom', () => ({
  Link: ({ children }) => <span>{children}</span>,
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: '7' }),
}))

afterEach(() => cleanup())

function serve(doc) {
  get.mockImplementation((url) => {
    if (url === '/settings/themes') return Promise.resolve({ data: THEMES })
    if (url === '/settings/') return Promise.resolve({ data: {} })
    return Promise.resolve({ data: doc })
  })
}

const picker = () => document.getElementById('print-invoice-theme')
  || document.getElementById('print-quotation-theme')

beforeEach(() => vi.clearAllMocks())

describe('InvoicePrintPage template picker', () => {
  it("pre-selects the invoice's saved pdf_theme", async () => {
    serve({ id: 7, invoice_no: 'ATS-1', pdf_theme: 't5_compact_dense' })
    render(<InvoicePrintPage />)
    await waitFor(() => expect(picker()).toBeTruthy())
    await waitFor(() => expect(picker().value).toBe('t5_compact_dense'))
  })

  it('falls back to the company default when the document has none', async () => {
    serve({ id: 7, invoice_no: 'ATS-1', pdf_theme: null })
    render(<InvoicePrintPage />)
    await waitFor(() => expect(picker()).toBeTruthy())
    await waitFor(() => expect(picker().value).toBe('classic_gst'))
  })

  it('offers invoice keys only', async () => {
    serve({ id: 7, invoice_no: 'ATS-1', pdf_theme: 'classic_gst' })
    render(<InvoicePrintPage />)
    await waitFor(() => expect(picker()).toBeTruthy())
    const values = Array.from(picker().querySelectorAll('option')).map((o) => o.value)
    expect(values).toEqual(['classic_gst', 't5_compact_dense'])
  })
})

describe('QuotationPrintPage template picker', () => {
  it("pre-selects the quotation's saved pdf_theme", async () => {
    serve({ id: 7, quotation_no: 'ATS-Q1', pdf_theme: 'q1_classic' })
    render(<QuotationPrintPage />)
    await waitFor(() => expect(picker()).toBeTruthy())
    await waitFor(() => expect(picker().value).toBe('q1_classic'))
  })

  it('offers quotation keys only', async () => {
    serve({ id: 7, quotation_no: 'ATS-Q1', pdf_theme: 'classic' })
    render(<QuotationPrintPage />)
    await waitFor(() => expect(picker()).toBeTruthy())
    const values = Array.from(picker().querySelectorAll('option')).map((o) => o.value)
    expect(values).toEqual(['classic', 'q1_classic'])
  })
})