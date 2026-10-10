// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import Settings from '../Settings.jsx'
import { defaultFor, groupThemes } from '../../lib/pdfThemes'

// classic_gst / classic are the company standard. These pin that they stay first,
// stay labelled, and are what a selector and a preview open on when nothing
// has been chosen.
const THEMES = {
  invoices: [
    { category: 'Default', items: [{ key: 'classic_gst', label: 'Default (Company Standard)', description: 'Original dense bordered layout.', preview_pages: [1] }] },
    { category: 'Professional', items: [
      { key: 't2_letterhead', label: 'Letterhead', description: 'Matches the Fortis Hospital reference.', preview_pages: [1] },
      { key: 't4_corporate_slate', label: 'Corporate Slate', description: 'Navy.', preview_pages: [1] },
    ] },
    { category: 'Compact', items: [{ key: 't5_compact_dense', label: 'Compact Dense', description: 'Tight.', preview_pages: [1] }] },
  ],
  quotations: [
    { category: 'Default', items: [{ key: 'classic', label: 'Default (Company Standard)', description: 'Original quotation layout.', preview_pages: [1] }] },
    { category: 'Specialised', items: [{ key: 'q2_proposal', label: 'Proposal', description: 'Navy.', preview_pages: [1] }] },
  ],
  default_invoice: 'classic_gst',
  default_quotation: 'classic',
}

const get = vi.fn()
const post = vi.fn()

vi.mock('../../api/client', () => ({
  default: { get: (...a) => get(...a), post: (...a) => post(...a), put: (...a) => post(...a) },
}))
vi.mock('../../components/Layout', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ push: vi.fn() }) }))
vi.mock('react-router-dom', () => ({ Link: ({ children }) => <span>{children}</span> }))

afterEach(() => cleanup())

const openPrinting = async () => {
  const user = userEvent.setup()
  render(<Settings />)
  // The selectors live behind the Printing tab, which is not the default.
  await user.click(screen.getByText('Printing'))
  await waitFor(() => expect(document.getElementById('company-default-invoice')).toBeTruthy())
}

beforeEach(() => {
  vi.clearAllMocks()
  get.mockImplementation((url) => {
    if (url === '/settings/themes') return Promise.resolve({ data: THEMES })
    return Promise.resolve({ data: {} })
  })
  post.mockResolvedValue({ data: {} })
})

const optionsOf = (id) =>
  Array.from(document.getElementById(id).querySelectorAll('option')).map((o) => ({
    value: o.value, label: o.textContent,
  }))

describe('catalogue ordering', () => {
  it('puts the company standard first in both sides', () => {
    expect(groupThemes(THEMES, 'invoice')[0].items[0].key).toBe('classic_gst')
    expect(groupThemes(THEMES, 'quotation')[0].items[0].key).toBe('classic')
  })

  it('labels the company standard', () => {
    expect(groupThemes(THEMES, 'invoice')[0].items[0].label).toBe('Default (Company Standard)')
    expect(groupThemes(THEMES, 'quotation')[0].items[0].label).toBe('Default (Company Standard)')
  })

  it('reports the company standard as the backend default', () => {
    expect(defaultFor(THEMES, 'invoice')).toBe('classic_gst')
    expect(defaultFor(THEMES, 'quotation')).toBe('classic')
  })
})

describe('Settings Printing tab', () => {
  it('offers the standard as the first real option on both sides', async () => {
    await openPrinting()
    const inv = optionsOf('company-default-invoice').filter((o) => o.value)
    const quo = optionsOf('company-default-quotation').filter((o) => o.value)
    expect(inv[0].value).toBe('classic_gst')
    expect(inv[0].label).toBe('Default (Company Standard)')
    expect(quo[0].value).toBe('classic')
    expect(quo[0].label).toBe('Default (Company Standard)')
  })

  it('names the standard in the "Reset to default" option when none is set', async () => {
    await openPrinting()
    const reset = optionsOf('company-default-invoice')[0]
    expect(reset.value).toBe('')
    expect(reset.label).toBe('Reset to default (classic_gst)')
  })

  it('opens both previews on the company standard when no default is set', async () => {
    await openPrinting()
    // Settings keeps upstream's "Preview" heading, so assert on the images.
    await waitFor(() =>
      expect(document.querySelector('img.theme-preview-img')).toBeTruthy())
    const srcs = Array.from(document.querySelectorAll('img.theme-preview-img'))
      .map((i) => i.getAttribute('src'))
    expect(srcs).toContain('/api/settings/themes/preview/invoices/classic_gst/1')
    expect(srcs).toContain('/api/settings/themes/preview/quotations/classic/1')
    // Nothing else may appear while no company default is set.
    expect(srcs).toHaveLength(2)
  })
})

describe('create form selectors', () => {
  it('resolve to the company standard when nothing is chosen', () => {
    // The select's value is `chosen || defaultFor(themes, docType)`, so with no
    // stored preference the company standard is what is on screen.
    expect(groupThemes(THEMES, 'invoice')[0].items[0].key).toBe('classic_gst')
    expect(groupThemes(THEMES, 'quotation')[0].items[0].key).toBe('classic')
  })
})