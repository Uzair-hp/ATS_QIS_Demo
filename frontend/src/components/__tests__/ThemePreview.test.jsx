// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import ThemePreview from '../ThemePreview.jsx'
import InvoiceForm from '../../pages/InvoiceForm.jsx'
import QuotationForm from '../../pages/QuotationForm.jsx'

const THEMES = {
  invoices: [
    { category: 'Default', items: [{ key: 'classic_gst', label: 'Default (Company Standard)', description: 'GST invoice', preview_pages: [1] }] },
    { category: 'Professional', items: [
      { key: 't2_letterhead', label: 'Letterhead', description: 'On letterhead', preview_pages: [1] },
      { key: 't4_corporate_slate', label: 'Corporate Slate', description: 'Two pages', preview_pages: [1, 2] },
    ] },
  ],
  quotations: [
    { category: 'Default', items: [{ key: 'classic', label: 'Default (Company Standard)', description: 'Plain', preview_pages: [1] }] },
    { category: 'Specialised', items: [{ key: 'q2_proposal', label: 'Proposal', description: 'Proposal style', preview_pages: [1] }] },
  ],
  default_invoice: 'classic_gst',
  default_quotation: 'classic',
}

const get = vi.fn()
const post = vi.fn()

vi.mock('../../api/client', () => ({
  default: { get: (...a) => get(...a), post: (...a) => post(...a), put: (...a) => post(...a) },
}))
vi.mock('../Layout', () => ({
  default: ({ children }) => <div>{children}</div>,
}))
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ push: vi.fn() }) }))
vi.mock('react-router-dom', () => ({
  Link: ({ children }) => <span>{children}</span>,
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
}))

const meta = {
  data: {
    clients: [{ id: 1, name: 'Naval Dockyard' }],
    services: [],
    company: { default_gst_percent: 18, default_quotation_terms: '', default_terms: '',
               quotation_pdf_theme: '', invoice_pdf_theme: '' },
  },
}

afterEach(() => cleanup())
beforeEach(() => {
  vi.clearAllMocks()
  get.mockImplementation((url) => {
    if (url === '/settings/themes') return Promise.resolve({ data: THEMES })
    if (url === '/quotations/meta' || url === '/invoices/meta') return Promise.resolve(meta)
    return Promise.resolve({ data: {} })
  })
  post.mockResolvedValue({ data: { id: 99 } })
})

const img = () => document.querySelector('img.theme-preview-img')
const select = () => document.getElementById('pdf_theme')

describe('ThemePreview', () => {
  it('renders nothing for a null theme', () => {
    const { container } = render(<ThemePreview doc="invoices" theme={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when the theme has no pages, keeping the Settings behaviour', () => {
    const { container } = render(<ThemePreview doc="invoices" theme={{ key: 'x', label: 'X', preview_pages: [] }} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows "Preview not available" for a page-less theme when asked', () => {
    render(<ThemePreview doc="invoices" theme={{ key: 'x', label: 'X', preview_pages: [] }} showEmpty />)
    expect(screen.getByText('Preview not available')).toBeTruthy()
  })

  it('builds the image URL from the document side and theme key', () => {
    render(<ThemePreview doc="quotations" theme={THEMES.quotations[0].items[0]} />)
    expect(img().getAttribute('src')).toBe('/api/settings/themes/preview/quotations/classic/1')
  })

  it('falls back to "Preview not available" when the image fails to load', () => {
    render(<ThemePreview doc="invoices" theme={THEMES.invoices[0].items[0]} />)
    fireEvent.error(img())
    expect(screen.getByText('Preview not available')).toBeTruthy()
    expect(img()).toBeNull()
  })

  it('stacks every page by default, which is what Settings renders', () => {
    const slate = THEMES.invoices[1].items[1]
    render(<ThemePreview doc="invoices" theme={slate} />)
    expect(document.querySelectorAll('img.theme-preview-img')).toHaveLength(2)
    expect(screen.queryByText(/Page 1 of/)).toBeNull()
  })

  describe('paged', () => {
    const slate = () => THEMES.invoices[1].items[1]

    it('starts on page 1 and offers a flipper for a multi-page template', () => {
      render(<ThemePreview doc="invoices" theme={slate()} paged />)
      expect(img().getAttribute('src')).toContain('/t4_corporate_slate/1')
      expect(screen.getByText('Page 1 of 2')).toBeTruthy()
    })

    it('flips to the next page and back', async () => {
      const user = userEvent.setup()
      render(<ThemePreview doc="invoices" theme={slate()} paged />)
      await user.click(screen.getByRole('button', { name: 'Next' }))
      expect(img().getAttribute('src')).toContain('/t4_corporate_slate/2')
      expect(screen.getByText('Page 2 of 2')).toBeTruthy()
      await user.click(screen.getByRole('button', { name: 'Previous' }))
      expect(img().getAttribute('src')).toContain('/t4_corporate_slate/1')
    })

    it('hides the flipper on a single-page template', () => {
      render(<ThemePreview doc="invoices" theme={THEMES.invoices[0].items[0]} paged />)
      expect(screen.queryByText(/Page 1 of/)).toBeNull()
    })

    it('resets to page 1 when the theme changes', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<ThemePreview doc="invoices" theme={slate()} paged />)
      await user.click(screen.getByRole('button', { name: 'Next' }))
      expect(screen.getByText('Page 2 of 2')).toBeTruthy()
      rerender(<ThemePreview doc="quotations" theme={THEMES.quotations[1].items[0]} paged />)
      expect(img().getAttribute('src')).toContain('/q2_proposal/1')
    })
  })
})

describe('create form previews', () => {
  const mount = async (el) => {
    render(el)
    await waitFor(() => expect(img()).toBeTruthy())
  }

  it('the quotation form previews a quotation template', async () => {
    await mount(<QuotationForm />)
    expect(screen.getByText('Sample preview')).toBeTruthy()
    expect(img().getAttribute('src')).toContain('/quotations/')
  })

  it('the quotation form never shows an invoice preview', async () => {
    const user = userEvent.setup()
    await mount(<QuotationForm />)
    for (const key of ['classic', 'q2_proposal']) {
      await user.selectOptions(select(), key)
      expect(img().getAttribute('src')).toContain('/quotations/')
      expect(img().getAttribute('src')).not.toContain('classic_gst')
      expect(img().getAttribute('src')).not.toContain('t2_letterhead')
    }
  })

  it('the quotation form changes its preview image with the selected key', async () => {
    const user = userEvent.setup()
    await mount(<QuotationForm />)
    expect(img().getAttribute('src')).toContain('/classic/1')
    await user.selectOptions(select(), 'q2_proposal')
    expect(img().getAttribute('src')).toContain('/q2_proposal/1')
  })

  it('the invoice form changes its preview image with the selected key', async () => {
    const user = userEvent.setup()
    await mount(<InvoiceForm />)
    expect(img().getAttribute('src')).toContain('/classic_gst/1')
    await user.selectOptions(select(), 't2_letterhead')
    expect(img().getAttribute('src')).toContain('/t2_letterhead/1')
  })

  it('the invoice form flips pages for a multi-page template', async () => {
    const user = userEvent.setup()
    await mount(<InvoiceForm />)
    await user.selectOptions(select(), 't4_corporate_slate')
    expect(screen.getByText('Page 1 of 2')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(img().getAttribute('src')).toContain('/t4_corporate_slate/2')
  })

  it('keeps the form usable when the preview image fails', async () => {
    await mount(<QuotationForm />)
    fireEvent.error(img())
    expect(screen.getByText('Preview not available')).toBeTruthy()
    // The selector still works and still carries the template through.
    const user = userEvent.setup()
    await user.selectOptions(select(), 'q2_proposal')
    await user.selectOptions(document.querySelector('select[required]'), '1')
    document.querySelector('form').requestSubmit()
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0][1].pdf_theme).toBe('q2_proposal')
  })
})