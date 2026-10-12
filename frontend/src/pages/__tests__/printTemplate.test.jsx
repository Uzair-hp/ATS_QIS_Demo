// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import InvoicePrintPage from '../InvoicePrintPage.jsx'
import QuotationPrintPage from '../QuotationPrintPage.jsx'
import QuotationForm from '../QuotationForm.jsx'
import { REGISTRY } from '../../templates/registry.js'

// These tests exist because of a specific bug: the template dropdown on the
// print page was wired only to a `?theme=` query string for a server-side
// render, so the sheet on screen never changed and the "preview" was a static
// PNG of unrelated sample data. Each test below pins one acceptance rule.

const THEMES = {
  invoices: [
    { category: 'Default', items: [
      { key: 'classic_gst', label: 'Default (Company Standard)', description: 'Bordered' },
      { key: 't2_letterhead', label: 'Letterhead', description: 'Band' },
      { key: 't3_minimal', label: 'Minimal', description: 'Hairlines' },
    ] },
  ],
  quotations: [
    { category: 'Default', items: [
      { key: 'classic', label: 'Default (Company Standard)', description: 'Bordered' },
      { key: 'q1_classic', label: 'Classic', description: 'Blue' },
      { key: 'q2_proposal', label: 'Proposal', description: 'Hero' },
      { key: 'q3_minimal', label: 'Minimal', description: 'Hairlines' },
      { key: 'q4_compact', label: 'Compact', description: 'Dense' },
    ] },
  ],
  default_invoice: 'classic_gst',
  default_quotation: 'classic',
}

const get = vi.fn()
const put = vi.fn()
const post = vi.fn()

vi.mock('../../api/client', () => ({
  default: {
    get: (...a) => get(...a),
    put: (...a) => put(...a),
    post: (...a) => post(...a),
  },
}))

vi.mock('react-to-print', () => ({ useReactToPrint: () => () => {} }))
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ push: vi.fn() }) }))
vi.mock('../../components/Layout', () => ({ default: ({ children }) => <div>{children}</div> }))

// The route id, so a test can serve a document whose id is not 7.
let routeId = '7'
vi.mock('react-router-dom', () => ({
  Link: ({ children }) => <span>{children}</span>,
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: routeId }),
  useSearchParams: () => [new URLSearchParams(''), () => {}],
}))

const SETTINGS = {
  name: 'ATS Automation',
  tagline: 'Security & Systems',
  bank_name: 'HDFC Bank',
  bank_branch: 'Vasai East',
  bank_account: '50200097301710',
  bank_ifsc: 'HDFC0001234',
  gst_number: '27BTHPT0851K1Z9',
  msme_number: 'UDYAM-MH-170148612',
}

const QUOTATION = {
  id: 7,
  quotation_number: 'ATS-QT-2026-014',
  pdf_theme: null,
  subject: 'BOOM BARRIER',
  status: 'Draft',
  date_created: '2026-10-12',
  valid_until: '2026-10-27',
  estimated_timeline: '2 weeks',
  payment_terms: '50% Advance',
  delivery_address: 'Gate 4, Nallasopara East',
  notes: 'Supply and installation included.',
  sub_total: 800,
  discount: 0,
  discount_type: 'flat',
  discount_amount: 0,
  gst_percent: 18,
  gst_amount: 144,
  total_amount: 944,
  client: { id: 3, name: 'Preview Co', company_name: 'FORTIS HOSPITAL', gst_number: '09AAFCF1234A1Z5' },
  items: [{ id: 1, service_name: 'Boom Barrier', hsn_code: '996311', quantity: 2, rate: 400 }],
}

function serve(doc) {
  get.mockImplementation((url) => {
    if (url === '/settings/themes') return Promise.resolve({ data: THEMES })
    if (url === '/settings/') return Promise.resolve({ data: SETTINGS })
    if (url === '/quotations/meta' || url === '/invoices/meta') {
      return Promise.resolve({ data: { clients: [{ id: 3, name: 'Preview Co' }], services: [], company: { default_gst_percent: 18, default_quotation_terms: '', quotation_pdf_theme: '', invoice_pdf_theme: '' } } })
    }
    return Promise.resolve({ data: doc })
  })
  put.mockResolvedValue({ data: { ...doc, pdf_theme: 'q2_proposal' } })
  post.mockResolvedValue({ data: { id: 7 } })
}

const sheet = () => document.querySelector('.doc-sheet')
const sheetClass = () => (sheet() ? sheet().getAttribute('class') : '')
const picker = () => document.getElementById('print-quotation-theme')
  || document.getElementById('print-invoice-theme')

// The sheet appears when the document loads; the selector arrives separately,
// once its own catalogue request settles. Wait for both before asserting.
const ready = () => waitFor(() => {
  expect(sheet()).toBeTruthy()
  expect(picker()).toBeTruthy()
})

afterEach(() => cleanup())
beforeEach(() => {
  vi.clearAllMocks()
  routeId = '7'
  serve(QUOTATION)
})

// ── AC1: every template renders, and renders differently ─────────────────

describe('template keys resolve to distinct layouts', () => {
  it.each(Object.keys(REGISTRY.quotation))('renders %s', async (key) => {
    serve({ ...QUOTATION, pdf_theme: key })
    render(<QuotationPrintPage />)
    await ready()
    expect(picker().value).toBe(key)
  })

  it('produces different markup per template, not one fixed sheet', async () => {
    const seen = new Set()
    for (const key of Object.keys(REGISTRY.quotation)) {
      serve({ ...QUOTATION, pdf_theme: key })
      const { unmount } = render(<QuotationPrintPage />)
      await ready()
      seen.add(sheetClass())
      unmount()
      cleanup()
    }
    expect(seen.size).toBeGreaterThan(1)
  })
})

// ── AC2: one source of truth per template ───────────────────────────────

describe('the print view renders the selected template', () => {
  it('uses the company standard when the document has no template of its own', async () => {
    render(<QuotationPrintPage />)
    await ready()
    expect(picker().value).toBe('classic')
    expect(sheetClass()).toContain('doc-t-classic')
  })

  it('uses the template saved on the document', async () => {
    serve({ ...QUOTATION, pdf_theme: 'q3_minimal' })
    render(<QuotationPrintPage />)
    await ready()
    expect(picker().value).toBe('q3_minimal')
    expect(sheetClass()).toContain('doc-t-minimal')
  })

  it('shows the company name, bank block and GSTIN, not blanks', async () => {
    render(<QuotationPrintPage />)
    await ready()
    const text = sheet().textContent
    expect(text).toContain('ATS Automation')
    expect(text).toContain('HDFC Bank')
    expect(text).toContain('HDFC0001234')
    expect(text).toContain('27BTHPT0851K1Z9')
    expect(text).toContain('UDYAM-MH-170148612')
  })

  it('does not print an empty label for an unrecorded field', async () => {
    const sparse = { ...SETTINGS, bank_name: '', bank_branch: '', bank_account: '', bank_ifsc: '', msme_number: '' }
    get.mockImplementation((url) => {
      if (url === '/settings/themes') return Promise.resolve({ data: THEMES })
      if (url === '/settings/') return Promise.resolve({ data: sparse })
      return Promise.resolve({ data: QUOTATION })
    })
    render(<QuotationPrintPage />)
    await ready()
    expect(sheet().textContent).not.toMatch(/IFSC Code:\s*$/m)
  })

  it('carries the fields the old sheet dropped: timeline and valid until', async () => {
    render(<QuotationPrintPage />)
    await ready()
    const text = sheet().textContent
    expect(text).toContain('Valid Until')
    expect(text).toContain('Est. Timeline')
    expect(text).toContain('2 weeks')
  })
})

// ── AC3: changing the dropdown re-renders and persists ──────────────────

describe('changing the template on the print view', () => {
  it('re-renders immediately, before any request settles', async () => {
    const user = userEvent.setup()
    serve({ ...QUOTATION, pdf_theme: 'classic' })
    render(<QuotationPrintPage />)
    await ready()
    expect(sheetClass()).toContain('doc-t-classic')

    await user.selectOptions(picker(), 'q2_proposal')

    // No waiting on the network: the sheet must already have changed.
    expect(sheetClass()).toContain('doc-t-hero')
  })

  it('saves the new template on the record', async () => {
    const user = userEvent.setup()
    render(<QuotationPrintPage />)
    await ready()

    await user.selectOptions(picker(), 'q4_compact')
    await waitFor(() => expect(put).toHaveBeenCalled())
    expect(put).toHaveBeenCalledWith('/quotations/7/pdf-theme', { pdf_theme: 'q4_compact' })
  })

  it('puts the saved value in its own field, not in the content payload', async () => {
    const user = userEvent.setup()
    render(<QuotationPrintPage />)
    await ready()
    await user.selectOptions(picker(), 'q3_minimal')
    await waitFor(() => expect(put).toHaveBeenCalled())
    const [url, body] = put.mock.calls[0]
    expect(url).toBe('/quotations/7/pdf-theme')
    expect(body).toEqual({ pdf_theme: 'q3_minimal' })
  })

  it('rolls the sheet back when the save is rejected', async () => {
    const user = userEvent.setup()
    put.mockRejectedValue({ response: { data: { error: 'nope' } } })
    render(<QuotationPrintPage />)
    await ready()

    await user.selectOptions(picker(), 'q2_proposal')
    await waitFor(() => expect(put).toHaveBeenCalled())
    // The reload restores the server's value, so the screen cannot show a
    // template that was never saved.
    await waitFor(() => expect(sheetClass()).toContain('doc-t-classic'))
  })
})

// ── AC5: reload / reopen uses the saved template ─────────────────────────

describe('reopening the document', () => {
  it('renders the saved template after a fresh load', async () => {
    serve({ ...QUOTATION, pdf_theme: 'q1_classic' })
    render(<QuotationPrintPage />)
    await ready()
    expect(picker().value).toBe('q1_classic')
  })
})

// ── create-page preview matches the print view ───────────────────────────

describe('the create-page preview', () => {
  it('renders the same sheet, from the same builder', async () => {
    render(<QuotationForm />)
    await waitFor(() => expect(document.querySelector('.doc-sheet')).toBeTruthy())
    expect(document.querySelector('.doc-sheet').getAttribute('class')).toContain('doc-t-classic')
  })

  it('follows the dropdown as the template changes', async () => {
    const user = userEvent.setup()
    render(<QuotationForm />)
    await waitFor(() => expect(document.getElementById('pdf_theme')).toBeTruthy())

    await user.selectOptions(document.getElementById('pdf_theme'), 'q2_proposal')
    await waitFor(() =>
      expect(document.querySelector('.doc-sheet').getAttribute('class')).toContain('doc-t-hero'))
  })

  it('shows the live company bank block in the preview', async () => {
    render(<QuotationForm />)
    await waitFor(() => expect(document.querySelector('.doc-sheet')).toBeTruthy())
    expect(document.querySelector('.doc-sheet').textContent).toContain('HDFC Bank')
  })
})

// ── invoices behave the same way ─────────────────────────────────────────

describe('InvoicePrintPage', () => {
  const INVOICE = { ...QUOTATION, id: 9, invoice_number: 'ATS-INV-2026-011', due_date: '2026-10-27', advance_amount: 400, status: 'Partially Paid' }

  it('renders the template saved on the invoice', async () => {
    routeId = '9'
    serve({ ...INVOICE, pdf_theme: 't2_letterhead' })
    render(<InvoicePrintPage />)
    await ready()
    expect(picker().value).toBe('t2_letterhead')
    expect(sheetClass()).toContain('doc-t-letterhead')
  })

  it('persists a template change to the invoice endpoint', async () => {
    const user = userEvent.setup()
    routeId = '9'
    serve(INVOICE)
    render(<InvoicePrintPage />)
    await ready()

    await user.selectOptions(picker(), 't3_minimal')
    await waitFor(() => expect(put).toHaveBeenCalled())
    expect(put).toHaveBeenCalledWith('/invoices/9/pdf-theme', { pdf_theme: 't3_minimal' })
    expect(sheetClass()).toContain('doc-t-minimal')
  })

  it('shows the advance and balance rows the quotation has no use for', async () => {
    routeId = '9'
    serve(INVOICE)
    render(<InvoicePrintPage />)
    await ready()
    expect(sheet().textContent).toContain('Advance Received')
    expect(sheet().textContent).toContain('Balance Due')
  })
})
