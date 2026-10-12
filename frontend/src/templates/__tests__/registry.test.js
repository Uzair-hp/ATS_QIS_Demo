import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
  DEFAULT_KEY,
  REGISTRY,
  componentFor,
  resolveKey,
  missingKeys,
} from '../registry.js'

// The backend owns which keys are valid (it rejects anything else on save) and
// this file owns which key renders what. If one side gains a key without the
// other, a user picks a template and silently gets the company standard instead.
// This suite is what makes that impossible to ship.

// Read the backend catalogue directly rather than importing Python, so the two
// sides cannot be pinned to a stale copy of each other.
const here = dirname(fileURLToPath(import.meta.url))
const backendPdfThemes = readFileSync(
  join(here, '..', '..', '..', '..', 'backend', 'pdf_themes.py'),
  'utf8'
)

function backendKeys(docType) {
  const constName = docType === 'invoice' ? 'INVOICE_THEMES' : 'QUOTATION_THEMES'
  const block = backendPdfThemes.split(`${constName} = {`)[1].split('}')[0]
  return [...block.matchAll(/^\s{4}'([a-z0-9_]+)':/gm)].map((m) => m[1])
}

describe('registry matches the backend catalogue', () => {
  it.each(['invoice', 'quotation'])('covers every %s key the backend offers', (docType) => {
    expect(missingKeys(docType, backendKeys(docType))).toEqual([])
  })

  it('offers no key the backend does not', () => {
    for (const docType of ['invoice', 'quotation']) {
      expect(Object.keys(REGISTRY[docType]).sort())
        .toEqual(backendKeys(docType).sort())
    }
  })

  it('has no default pointing at a missing component', () => {
    for (const docType of ['invoice', 'quotation']) {
      expect(componentFor(docType, DEFAULT_KEY[docType])).toBeTruthy()
    }
  })
})

describe('componentFor', () => {
  it('resolves every registered key to a component', () => {
    for (const docType of ['invoice', 'quotation']) {
      for (const key of Object.keys(REGISTRY[docType])) {
        expect(componentFor(docType, key), `${docType}/${key}`).toBeTypeOf('function')
      }
    }
  })

  it('returns null for a blank, unknown or cross-type key', () => {
    expect(componentFor('quotation', '')).toBeNull()
    expect(componentFor('quotation', undefined)).toBeNull()
    expect(componentFor('quotation', 'nope')).toBeNull()
    expect(componentFor('credit_note', 'classic')).toBeNull()
    // A quotation key must never render an invoice, or vice versa.
    expect(componentFor('quotation', 'classic_gst')).toBeNull()
    expect(componentFor('invoice', 'q2_proposal')).toBeNull()
  })

  it('trims a padded key rather than rejecting it', () => {
    expect(componentFor('quotation', '  q2_proposal  ')).toBeTruthy()
  })
})

describe('resolveKey', () => {
  it('prefers the document’s own saved key', () => {
    expect(resolveKey('quotation', 'q3_minimal', 'q2_proposal')).toBe('q3_minimal')
  })

  it('falls back to the company default when the document has none', () => {
    expect(resolveKey('quotation', '', 'q2_proposal')).toBe('q2_proposal')
    expect(resolveKey('quotation', null, undefined)).toBe('classic')
  })

  it('falls back to the company standard when the saved key is unusable', () => {
    expect(resolveKey('quotation', 'gone', 'gone')).toBe('classic')
    expect(resolveKey('quotation', 'classic_gst', undefined)).toBe('classic')
  })

  it('gives each document type its own standard', () => {
    expect(DEFAULT_KEY).toEqual({ invoice: 'classic_gst', quotation: 'classic' })
  })
})
