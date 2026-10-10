import { useState } from 'react'
import TemplateSelect from './TemplateSelect'

/**
 * Theme picker for a print-page toolbar.
 *
 * Distinct from TemplateSelect in one way that matters: the pick here changes
 * ?theme= for this session only. The browser print sheet is a different
 * pipeline and is unaffected, so the label says so rather than implying the
 * printed sheet changed.
 */
export default function PrintThemePicker({ docType, saved, onPick }) {
  const [value, setValue] = useState(saved || '')

  return (
    <div className="d-flex align-items-end gap-2 ms-auto">
      <div style={{ minWidth: 220 }}>
        <TemplateSelect
          docType={docType}
          id={`print-${docType}-theme`}
          value={value}
          onChange={(key) => { setValue(key); onPick(key) }}
        />
      </div>
    </div>
  )
}