import { useEffect, useState } from 'react'

/**
 * Pre-rendered page image for a PDF template.
 *
 * The backend ships one PNG per theme page under /api/settings/themes/preview,
 * so a template can be judged by eye without rendering a PDF. These are static
 * sample images, never rendered from the live document.
 *
 * Settings passes `paged={false}` and renders every page, which is what it has
 * always done. The create forms pass `paged` so a multi-page template starts on
 * page 1 and can be flipped through.
 */
export default function ThemePreview({
  doc,
  theme,
  title = 'Preview',
  paged = false,
  showEmpty = false,
}) {
  const pages = theme?.preview_pages || []
  const [page, setPage] = useState(0)
  const [failed, setFailed] = useState(false)

  // A new theme means a new image, so go back to the first page and clear any
  // load failure left over from the previous one.
  useEffect(() => {
    setPage(0)
    setFailed(false)
  }, [theme?.key])

  if (!theme) return null
  // Settings has always rendered nothing at all for a theme with no preview;
  // showEmpty is how the forms ask for the "not available" note instead.
  if (!pages.length && !showEmpty) return null

  const visible = paged ? pages.slice(page, page + 1) : pages
  const canFlip = paged && pages.length > 1 && !failed
  // No pages and no load error is still "no preview", so both land on the same
  // note rather than rendering an empty stack.
  const unavailable = failed || pages.length === 0

  return (
    <div className="theme-preview mt-3">
      <div className="theme-preview-head">
        <i className="bi bi-eye me-1"></i> {title}
      </div>

      {unavailable ? (
        <div className="theme-preview-missing">Preview not available</div>
      ) : (
        <div className="theme-preview-stack">
          {visible.map((p) => (
            <img
              key={p}
              className="theme-preview-img"
              src={`/api/settings/themes/preview/${doc}/${theme.key}/${p}`}
              alt={`${theme.label} — page ${p}`}
              loading="lazy"
              onError={() => setFailed(true)}
            />
          ))}
        </div>
      )}

      {canFlip && (
        <div className="theme-preview-nav">
          <button
            type="button"
            className="btn btn-sm btn-inf-outline"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </button>
          <span className="theme-preview-page">Page {page + 1} of {pages.length}</span>
          <button
            type="button"
            className="btn btn-sm btn-inf-outline"
            disabled={page >= pages.length - 1}
            onClick={() => setPage((p) => Math.min(pages.length - 1, p + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}