import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useReactToPrint } from 'react-to-print'
import api from '../api/client'
import DocumentPrint from '../components/DocumentPrint'
import TemplateSelect from '../components/TemplateSelect'
import { buildDocData } from '../lib/docData'
import { resolveKey } from '../templates/registry.js'
import { useToast } from '../context/ToastContext'
// Imported here (not in main.jsx) so the sheet's stylesheet is code-split onto
// these routes alone.
import '../styles/print.css'

/**
 * The print view is the single place a saved document is rendered.
 *
 * The template in the dropdown is the same value the sheet is rendered from and
 * the same value saved on the record, so "what you see" and "what you get" are
 * one thing. Previously the pick only rewrote a `?theme=` query string for a
 * server-side render and the sheet never changed - which is the whole bug this
 * route is being fixed for.
 *
 * `?print=1` opens the browser print dialog on arrival, which is how the
 * Download PDF buttons on the list and detail pages now produce a file.
 */
export default function QuotationPrintPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const contentRef = useRef(null)
  const { push } = useToast()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState('')
  const [defaultTheme, setDefaultTheme] = useState('')
  const [savingTheme, setSavingTheme] = useState(false)
  const autoPrint = params.get('print') === '1'

  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: data?.number || 'Quotation',
  })

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([api.get(`/quotations/${id}`), api.get('/settings/')])
      .then(([qRes, sRes]) => {
        const q = qRes.data || {}
        setData(buildDocData('quotation', q, sRes.data))
        setTheme(q.pdf_theme || '')
        setDefaultTheme(sRes.data?.quotation_pdf_theme || '')
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Could not load this quotation.')
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  // Re-render immediately, then persist. The screen is never left showing the
  // old template while a request is in flight.
  const pickTheme = async (key) => {
    setTheme(key)
    setSavingTheme(true)
    try {
      await api.put(`/quotations/${id}/pdf-theme`, { pdf_theme: key })
    } catch (err) {
      push(err.response?.data?.error || 'Could not save the template.', 'error')
      load()
    } finally {
      setSavingTheme(false)
    }
  }

  // Arriving from a "Download PDF" button. Deferred a tick so the sheet is in
  // the DOM before react-to-print clones it.
  useEffect(() => {
    if (autoPrint && !loading && data) {
      const t = setTimeout(() => handlePrint(), 250)
      return () => clearTimeout(t)
    }
  }, [autoPrint, loading, data, handlePrint])

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container py-5">
        <div className="alert alert-danger">{error}</div>
        <button type="button" className="btn btn-inf-outline" onClick={() => navigate('/quotations')}>
          Back to quotations
        </button>
      </div>
    )
  }

  const activeKey = resolveKey('quotation', theme, defaultTheme)

  return (
    <div className="qp-print-page">
      {/* react-to-print clones contentRef only, so this toolbar is never part of
          the printed page. */}
      <div className="no-print d-flex flex-wrap align-items-center gap-2 p-3" style={{ borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
        <button type="button" className="btn btn-inf" onClick={handlePrint}>
          <i className="bi bi-printer me-1" />
          Print / Save as PDF
        </button>
        <Link className="btn btn-inf-outline" to={`/quotations/${id}`}>
          Back
        </Link>
        <div className="ms-auto" style={{ minWidth: 240 }}>
          <TemplateSelect
            docType="quotation"
            id="print-quotation-theme"
            value={theme}
            onChange={pickTheme}
          />
          {savingTheme && <div className="form-text">Saving template…</div>}
        </div>
      </div>

      <div ref={contentRef}>
        <DocumentPrint
          docType="quotation"
          data={data}
          theme={theme}
          fallbackTheme={defaultTheme}
        />
      </div>
      <div className="container py-2 preview-caption">
        <small className="text-muted">
          Rendering template <strong>{activeKey}</strong>. This is exactly what
          Print / Save as PDF will produce.
        </small>
      </div>
    </div>
  )
}
