// The template registry: the only place a template key turns into a component.
//
// There used to be no such thing on this side. The print page had a dropdown
// whose only effect was to rewrite a `?theme=` query string for the server-side
// Jinja render, so the sheet on screen could never change - and the create-page
// "preview" was a PNG of unrelated sample data. Now one key resolves to one
// component, and preview, print view, save-as-PDF and download all go through
// this file.
//
// Keys are deliberately the SAME strings the backend validates and the ones
// already stored in `invoices.pdf_theme` / `quotations.pdf_theme`, so no
// document needs migrating.

import { ARCHETYPES } from './layouts.jsx'

export const DEFAULT_KEY = {
  invoice: 'classic_gst',
  quotation: 'classic',
}

// key -> archetype. Every key the backend offers must appear here for its
// document type; `assertRegistryComplete` and the test suite both enforce it,
// so a new backend key without a component fails loudly instead of silently
// falling back to the company standard.
export const REGISTRY = {
  invoice: {
    classic_gst: 'classic',
    t2_letterhead: 'letterhead',
    t3_minimal: 'minimal',
    t4_corporate_slate: 'hero',
    t5_compact_dense: 'compact',
  },
  quotation: {
    classic: 'classic',
    q1_classic: 'classic',
    q2_proposal: 'hero',
    q3_minimal: 'minimal',
    q4_compact: 'compact',
  },
}

/**
 * The component for `key`, or null.
 *
 * Unknown, blank and cross-type keys all return null so the caller falls
 * through to the company default rather than rendering the wrong document type.
 */
export function componentFor(docType, key) {
  const side = REGISTRY[docType]
  if (!side || !key) return null
  const archetype = side[String(key).trim()]
  return archetype ? ARCHETYPES[archetype] || null : null
}

/** Resolve a key against a document's saved value and the company default. */
export function resolveKey(docType, savedKey, defaultKey) {
  if (componentFor(docType, savedKey)) return savedKey
  if (componentFor(docType, defaultKey)) return defaultKey
  return DEFAULT_KEY[docType]
}

/**
 * Keys the backend offers but the frontend cannot render.
 *
 * Empty in a healthy deploy. Surfaced by tests and by `assertRegistryComplete`
 * rather than swallowed, because a missing component would otherwise degrade
 * to "company standard" with no signal that the user's choice was ignored.
 */
export function missingKeys(docType, offeredKeys) {
  const side = REGISTRY[docType] || {}
  return (offeredKeys || []).filter((k) => !side[k])
}

export function assertRegistryComplete(docType, offeredKeys) {
  const gaps = missingKeys(docType, offeredKeys)
  if (gaps.length) {
    throw new Error(
      `Template registry is missing a component for ${docType} key(s): ${gaps.join(', ')}`,
    )
  }
}
