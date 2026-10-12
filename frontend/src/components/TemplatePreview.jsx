import DocTemplate from '../templates/DocTemplate'

/**
 * A real, scaled-down render of the selected template.
 *
 * This used to be a PNG baked from unrelated sample data, served from
 * /api/settings/themes/preview. That is why the create page showed a FORTIS
 * HOSPITAL quotation beside an empty form and why the preview could never match
 * the print view: they were different renderers. Now the preview mounts the same
 * component, with the same `data`, that Print / Save as PDF will clone.
 *
 * `data` is the document as typed, so the preview updates as the form is filled
 * in. Callers with nothing to preview pass sample data explicitly.
 */
export default function TemplatePreview({
  docType,
  theme,
  data,
  title = 'Preview',
  empty = 'Choose a template to see how your document will look.',
}) {
  return (
    <div className="theme-preview mt-3">
      <div className="theme-preview-head">
        <i className="bi bi-eye me-1"></i> {title}
      </div>
      <div className="theme-preview-frame">
        {data ? (
          <div className="theme-preview-scale">
            <DocTemplate docType={docType} data={data} theme={theme} />
          </div>
        ) : (
          <div className="theme-preview-missing">{empty}</div>
        )}
      </div>
      <div className="theme-preview-note">
        Exactly what Print / Save as PDF produces.
      </div>
    </div>
  )
}
