// Pure helpers for the grouped PDF theme catalogue.
//
// GET /api/settings/themes answers with one shape:
//   { invoices: [{ category, items: [{ key, label, description, preview_pages }] }],
//     quotations: [...], default_invoice, default_quotation }
//
// Every lookup goes through docType. The invoice and quotation key sets are
// disjoint and the backend rejects a key from the wrong side, so a selector
// that mixed them would offer choices that cannot be saved.

export const SIDES = { invoice: 'invoices', quotation: 'quotations' }

/** The raw group list for one document type. Never the other type. */
export function groupsFor(themes, docType) {
  const side = SIDES[docType]
  if (!side) return []
  const list = themes?.[side]
  return Array.isArray(list) ? list : []
}

/**
 * Groups for `docType` with empty groups dropped, ready to map over.
 *
 * A missing, wrong-typed or empty payload yields [] rather than falling back to
 * the other document type - offering invoice keys in a quotation is worse than
 * offering nothing.
 */
export function groupThemes(themes, docType) {
  return groupsFor(themes, docType)
    .filter((g) => g && Array.isArray(g.items) && g.items.length > 0)
    .map((g) => ({ category: g.category, items: g.items }))
}

/** The backend's fallback key for this document type. */
export function defaultFor(themes, docType) {
  return docType === 'invoice' ? themes?.default_invoice : themes?.default_quotation
}

/** The theme object for `key` within `groups`, or null. */
export function findTheme(groups, key) {
  if (!key) return null
  for (const group of groups || []) {
    for (const item of group.items || []) {
      if (item.key === key) return item
    }
  }
  return null
}

/** A theme's description, or '' when the key is not in `groups`. */
export function describeTheme(groups, key) {
  return findTheme(groups, key)?.description || ''
}