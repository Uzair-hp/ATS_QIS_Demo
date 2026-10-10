// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import InvoiceForm from '../InvoiceForm.jsx'
import QuotationForm from '../QuotationForm.jsx'

// The invoice and quotation key sets are disjoint; a selector that leaked across
// them would offer a key the backend rejects, so the form could not be saved.
const THEMES = {
  invoices: [
    { category: 'Default', items: [{ key: 'classic_gst', label: 'Default (Company Standard)', description: 'GST invoice' }] },
    { category: 'Professional', items: [{ key: 't2_letterhead', label: 'Letterhead', description: 'On letterhead' }] },
  ],
  quotations: [
    { category: 'Default', items: [{ key: 'classic', label: 'Default (Company Standard)', description: 'Plain quotation' }] },
    { category: 'Specialised', items: [{ key: 'q2_proposal', label: 'Proposal', description: 'Proposal style' }] },
  ],
  default_invoice: 'classic_gst',
  default_quotation: 'classic',
}

const QUOTATION_KEYS = ['classic', 'q2_proposal']
const INVOICE_KEYS = ['classic_gst', 't2_letterhead']

const get = vi.fn()
const post = vi.fn()
const put = vi.fn()

vi.mock('../../api/client', () => ({
  default: {
    get: (...a) => get(...a),
    post: (...a) => post(...a),
    put: (...a) => put(...a),
  },
}))

vi.mock('../../components/Layout', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ push: vi.fn() }),
}))

vi.mock('react-router-dom', () => ({
  Link: ({ children }) => <span>{children}</span>,
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
}))

function metaFor(kind) {
  return {
    data: {
      clients: [{ id: 1, name: 'Naval Dockyard' }],
      services: [],
      company: {
        default_gst_percent: 18,
        default_quotation_terms: '',
        quotation_pdf_theme: '',
        invoice_pdf_theme: '',
      },
    },
  }
}

const templateSelect = () => document.getElementById('pdf_theme')

const optionKeys = (select) =>
  Array.from(select.querySelectorAll('option')).map((o) => o.value)

async function mountAndWait(element) {
  render(element)
  // TemplateSelect renders a spinner, not the <select>, until the catalogue
  // request settles - so the element existing means it is ready, including in
  // the failure case where only the single fallback option is offered.
  await waitFor(() => expect(templateSelect()).toBeTruthy())
}

// Vitest runs with globals off, so Testing Library does not auto-clean. Without
// this the previous render stays in the document and getElementById returns the
// stale one.
afterEach(() => cleanup())

beforeEach(() => {
  vi.clearAllMocks()
  get.mockImplementation((url) => {
    if (url === '/settings/themes') return Promise.resolve({ data: THEMES })
    if (url === '/quotations/meta') return Promise.resolve(metaFor('quotation'))
    if (url === '/invoices/meta') return Promise.resolve(metaFor('invoice'))
    return Promise.resolve({ data: {} })
  })
  post.mockResolvedValue({ data: { id: 99 } })
  put.mockResolvedValue({ data: { id: 99 } })
})

describe('QuotationForm PDF template selector', () => {
  it('offers only quotation keys', async () => {
    await mountAndWait(<QuotationForm />)
    expect(optionKeys(templateSelect())).toEqual(QUOTATION_KEYS)
  })

  it('never offers an invoice key', async () => {
    await mountAndWait(<QuotationForm />)
    const keys = optionKeys(templateSelect())
    for (const key of INVOICE_KEYS) expect(keys).not.toContain(key)
  })

  it('groups the options under their category', async () => {
    await mountAndWait(<QuotationForm />)
    const labels = Array.from(templateSelect().querySelectorAll('optgroup')).map((g) => g.label)
    expect(labels).toEqual(['Default', 'Specialised'])
  })

  it('sends the selected key as pdf_theme when the form is saved', async () => {
    const user = userEvent.setup()
    await mountAndWait(<QuotationForm />)

    await user.selectOptions(templateSelect(), 'q2_proposal')
    await user.selectOptions(document.querySelector('select[required]'), '1')
    document.querySelector('form').requestSubmit()

    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0][0]).toBe('/quotations/')
    expect(post.mock.calls[0][1].pdf_theme).toBe('q2_proposal')
  })
})

describe('InvoiceForm PDF template selector', () => {
  it('offers only invoice keys', async () => {
    await mountAndWait(<InvoiceForm />)
    expect(optionKeys(templateSelect())).toEqual(INVOICE_KEYS)
  })

  it('never offers a quotation key', async () => {
    await mountAndWait(<InvoiceForm />)
    const keys = optionKeys(templateSelect())
    for (const key of QUOTATION_KEYS) expect(keys).not.toContain(key)
  })

  it('sends the selected key as pdf_theme when the form is saved', async () => {
    const user = userEvent.setup()
    await mountAndWait(<InvoiceForm />)

    await user.selectOptions(templateSelect(), 't2_letterhead')
    await user.selectOptions(document.querySelector('select[required]'), '1')
    document.querySelector('form').requestSubmit()

    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0][0]).toBe('/invoices/')
    expect(post.mock.calls[0][1].pdf_theme).toBe('t2_letterhead')
  })
})

describe('a new document starts on the right template', () => {
  const metaWith = (company) => ({ data: { clients: [{ id: 1, name: 'Naval' }], services: [], company } })

  it('pre-selects classic for a new quotation when no company default is set', async () => {
    get.mockImplementation((url) =>
      Promise.resolve(url === '/settings/themes' ? { data: THEMES } : metaWith({
        default_gst_percent: 18, default_quotation_terms: '', quotation_pdf_theme: '',
      })))
    await mountAndWait(<QuotationForm />)
    expect(templateSelect().value).toBe('classic')
  })

  it('pre-selects classic_gst for a new invoice when no company default is set', async () => {
    get.mockImplementation((url) =>
      Promise.resolve(url === '/settings/themes' ? { data: THEMES } : metaWith({
        default_gst_percent: 18, default_terms: '', invoice_pdf_theme: '',
      })))
    await mountAndWait(<InvoiceForm />)
    expect(templateSelect().value).toBe('classic_gst')
  })

  it('pre-selects the company default for a new invoice', async () => {
    get.mockImplementation((url) =>
      Promise.resolve(url === '/settings/themes' ? { data: THEMES } : metaWith({
        default_gst_percent: 18, default_terms: '', invoice_pdf_theme: 't2_letterhead',
      })))
    await mountAndWait(<InvoiceForm />)
    expect(templateSelect().value).toBe('t2_letterhead')
  })

  it('pre-selects the company default for a new quotation', async () => {
    get.mockImplementation((url) =>
      Promise.resolve(url === '/settings/themes' ? { data: THEMES } : metaWith({
        default_gst_percent: 18, default_quotation_terms: '', quotation_pdf_theme: 'q2_proposal',
      })))
    await mountAndWait(<QuotationForm />)
    expect(templateSelect().value).toBe('q2_proposal')
  })

  it('saves the pre-selected company default on the document', async () => {
    const user = userEvent.setup()
    get.mockImplementation((url) =>
      Promise.resolve(url === '/settings/themes' ? { data: THEMES } : metaWith({
        default_gst_percent: 18, default_quotation_terms: '', quotation_pdf_theme: 'q2_proposal',
      })))
    await mountAndWait(<QuotationForm />)

    // The selector lists only real keys, so a new document always stores one.
    await user.selectOptions(document.querySelector('select[required]'), '1')
    document.querySelector('form').requestSubmit()

    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0][1].pdf_theme).toBe('q2_proposal')
  })
})

describe('when the theme catalogue cannot be loaded', () => {
  it('falls back to a single company-standard option so the form still saves', async () => {
    get.mockImplementation((url) => {
      if (url === '/settings/themes') return Promise.reject(new Error('offline'))
      if (url === '/quotations/meta') return Promise.resolve(metaFor('quotation'))
      return Promise.resolve({ data: {} })
    })
    await mountAndWait(<QuotationForm />)

    // One option, and its value is empty: blank means "follow the company
    // default", which the backend stores as NULL. Offering a guess at the
    // default key here would risk sending a key we could not verify.
    expect(optionKeys(templateSelect())).toEqual([''])
    expect(templateSelect().options[0].textContent).toBe('Default (Company Standard)')
    expect(screen.getByText(/Templates could not be loaded/i)).toBeTruthy()
  })

  it('still saves with pdf_theme blank', async () => {
    const user = userEvent.setup()
    get.mockImplementation((url) => {
      if (url === '/settings/themes') return Promise.reject(new Error('offline'))
      if (url === '/quotations/meta') return Promise.resolve(metaFor('quotation'))
      return Promise.resolve({ data: {} })
    })
    await mountAndWait(<QuotationForm />)

    await user.selectOptions(document.querySelector('select[required]'), '1')
    document.querySelector('form').requestSubmit()

    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0][1].pdf_theme).toBe('')
  })
})