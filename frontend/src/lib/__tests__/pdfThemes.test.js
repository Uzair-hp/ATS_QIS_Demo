import { describe, expect, it } from 'vitest'

import {
  SIDES,
  defaultFor,
  describeTheme,
  findTheme,
  groupThemes,
  groupsFor,
} from '../pdfThemes.js'

// Mirrors GET /api/settings/themes. The invoice and quotation key sets are
// deliberately disjoint, which is what these tests protect.
const THEMES = {
  invoices: [
    {
      category: 'Default',
      items: [
        { key: 'classic_gst', label: 'Default (Company Standard)', description: 'GST invoice', preview_pages: [1] },
      ],
    },
    {
      category: 'Professional',
      items: [
        { key: 't2_letterhead', label: 'Letterhead', description: 'On letterhead', preview_pages: [1] },
        { key: 't4_corporate_slate', label: 'Corporate Slate', description: 'Two pages', preview_pages: [1, 2] },
      ],
    },
  ],
  quotations: [
    {
      category: 'Default',
      items: [
        { key: 'classic', label: 'Default (Company Standard)', description: 'Plain quotation', preview_pages: [1] },
      ],
    },
    {
      category: 'Specialised',
      items: [
        { key: 'q2_proposal', label: 'Proposal', description: 'Proposal style', preview_pages: [1] },
      ],
    },
  ],
  default_invoice: 'classic_gst',
  default_quotation: 'classic',
}

const keysOf = (groups) => groups.flatMap((g) => g.items.map((i) => i.key))

describe('groupsFor', () => {
  it('returns the list for the requested document type only', () => {
    expect(groupsFor(THEMES, 'invoice')).toBe(THEMES.invoices)
    expect(groupsFor(THEMES, 'quotation')).toBe(THEMES.quotations)
  })

  it('returns [] for an unknown document type instead of guessing', () => {
    expect(groupsFor(THEMES, 'credit_note')).toEqual([])
    expect(groupsFor(THEMES, undefined)).toEqual([])
  })

  it('returns [] when the payload is missing or the wrong shape', () => {
    expect(groupsFor(null, 'invoice')).toEqual([])
    expect(groupsFor(undefined, 'quotation')).toEqual([])
    expect(groupsFor({}, 'invoice')).toEqual([])
    expect(groupsFor({ invoices: null }, 'invoice')).toEqual([])
    expect(groupsFor({ invoices: 'nope' }, 'invoice')).toEqual([])
  })
})

describe('groupThemes', () => {
  it('keeps every allowlisted key for the invoice type', () => {
    expect(keysOf(groupThemes(THEMES, 'invoice'))).toEqual([
      'classic_gst',
      't2_letterhead',
      't4_corporate_slate',
    ])
  })

  it('keeps every allowlisted key for the quotation type', () => {
    expect(keysOf(groupThemes(THEMES, 'quotation'))).toEqual(['classic', 'q2_proposal'])
  })

  // The regression this suite exists for: the old implementation read
  // `themes.invoices || themes.quotations`, so a quotation selector was handed
  // invoice keys and every save was rejected by the backend.
  it('never mixes invoice keys into the quotation selector', () => {
    const keys = keysOf(groupThemes(THEMES, 'quotation'))
    expect(keys).not.toContain('classic_gst')
    expect(keys).not.toContain('t2_letterhead')
    expect(keys).not.toContain('t4_corporate_slate')
  })

  it('never mixes quotation keys into the invoice selector', () => {
    const keys = keysOf(groupThemes(THEMES, 'invoice'))
    expect(keys).not.toContain('classic')
    expect(keys).not.toContain('q2_proposal')
  })

  it('drops groups with no items rather than rendering an empty optgroup', () => {
    const themes = {
      invoices: [
        { category: 'Empty', items: [] },
        { category: 'Full', items: [{ key: 'classic_gst', description: 'd' }] },
      ],
    }
    const groups = groupThemes(themes, 'invoice')
    expect(groups).toHaveLength(1)
    expect(groups[0].category).toBe('Full')
  })

  it('preserves preview_pages so a caller can build a preview', () => {
    const slate = findTheme(groupThemes(THEMES, 'invoice'), 't4_corporate_slate')
    expect(slate.preview_pages).toEqual([1, 2])
  })

  it('returns [] rather than falling back when the requested side is missing', () => {
    const themes = { quotations: THEMES.quotations, default_quotation: 'classic' }
    expect(groupThemes(themes, 'invoice')).toEqual([])
    expect(groupThemes(themes, 'quotation')).toHaveLength(2)
  })
})

describe('defaultFor', () => {
  it('reads the backend default for each type', () => {
    expect(defaultFor(THEMES, 'invoice')).toBe('classic_gst')
    expect(defaultFor(THEMES, 'quotation')).toBe('classic')
  })

  it('is undefined when the payload is absent', () => {
    expect(defaultFor(null, 'invoice')).toBeUndefined()
  })
})

describe('findTheme', () => {
  it('finds a key inside the grouped shape', () => {
    const found = findTheme(groupThemes(THEMES, 'invoice'), 't2_letterhead')
    expect(found.label).toBe('Letterhead')
    expect(found.description).toBe('On letterhead')
  })

  it('returns null for an unknown key, a blank key or a missing list', () => {
    const groups = groupThemes(THEMES, 'invoice')
    expect(findTheme(groups, 't9_legal_compliance')).toBeNull()
    expect(findTheme(groups, '')).toBeNull()
    expect(findTheme(groups, undefined)).toBeNull()
    expect(findTheme(null, 'classic_gst')).toBeNull()
  })

  it('cannot find a quotation key in the invoice groups', () => {
    expect(findTheme(groupThemes(THEMES, 'invoice'), 'q2_proposal')).toBeNull()
  })
})

describe('describeTheme', () => {
  it('returns the description for a known key', () => {
    expect(describeTheme(groupThemes(THEMES, 'quotation'), 'q2_proposal')).toBe('Proposal style')
  })

  it("returns '' for an unknown or blank key", () => {
    const groups = groupThemes(THEMES, 'quotation')
    expect(describeTheme(groups, 'nope')).toBe('')
    expect(describeTheme(groups, '')).toBe('')
  })
})

describe('SIDES', () => {
  it('maps each document type to its own payload key', () => {
    expect(SIDES).toEqual({ invoice: 'invoices', quotation: 'quotations' })
  })
})