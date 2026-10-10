import { useEffect, useState } from 'react'
import api from '../api/client'
import { groupThemes, defaultFor, describeTheme } from '../lib/pdfThemes'

/**
 * PDF template picker, grouped by category.
 *
 * `docType` is 'invoice' | 'quotation'. `value` is the chosen key, '' or null
 * meaning "follow the company default". The options come from
 * GET /api/settings/themes, so the allowlist lives in one place on the backend
 * and this component never hard-codes a key.
 *
 * On a failed request the selector still renders with the company standard
 * alone, so a document can still be created or edited.
 */
export default function TemplateSelect({ docType, value, onChange, id, disabled, onLoaded }) {
  const [themes, setThemes] = useState(null)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api.get('/settings/themes')
      .then((res) => {
        if (!active) return
        setThemes(res.data)
        // The caller gets the same payload, so a form can show a preview for the
        // selected key without asking for the catalogue a second time.
        onLoaded?.(res.data)
      })
      .catch(() => { if (active) setFailed(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
    // onLoaded is intentionally not a dependency: it is usually an inline
    // setter, and re-running the fetch when its identity changes would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fallbackKey = defaultFor(themes, docType) || ''
  const selected = value || ''

  if (loading) {
    return (
      <div className="mb-3">
        <label className="form-label" htmlFor={id}>PDF Template</label>
        <div className="d-flex align-items-center gap-2 form-text" id={`${id}-status`}>
          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
          Loading templates…
        </div>
      </div>
    )
  }

  if (failed) {
    // No options available. Fall back to a plain select carrying only the
    // company standard, so saving still works and no bad key can be sent.
    return (
      <div className="mb-3">
        <label className="form-label" htmlFor={id}>PDF Template</label>
        <select
          id={id}
          name={id}
          className="form-select"
          value={selected || fallbackKey}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          <option value={fallbackKey}>Default (Company Standard)</option>
        </select>
        <div className="form-text" id={`${id}-hint`}>
          Templates could not be loaded. The company standard will be used.
        </div>
      </div>
    )
  }

  const groups = groupThemes(themes, docType)

  return (
    <div className="mb-3">
      <label className="form-label" htmlFor={id}>PDF Template</label>
      <select
        id={id}
        name={id}
        className="form-select"
        value={selected || fallbackKey}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-describedby={`${id}-hint`}
      >
        {groups.map((group) => (
          <optgroup key={group.category} label={group.category}>
            {group.items.map((item) => (
              <option key={item.key} value={item.key} title={item.description}>
                {item.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <div className="form-text" id={`${id}-hint`}>
        {describeTheme(groups, selected || fallbackKey)}
      </div>
    </div>
  )
}