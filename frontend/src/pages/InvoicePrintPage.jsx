import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useReactToPrint } from 'react-to-print'
import api from '../api/client'
import DocumentPrint from '../components/DocumentPrint'
import TemplateSelect from '../components/TemplateSelect'
import { buildDocData } from '../lib/docData'
import { resolveKey } from '../templates/registry.js'
import { useToast } from '../context/ToastContext'
import '../styles/print.css'

// The invoice twin of QuotationPrintPage. Both render through the same
// registry and the same data builder, so a template fix applies to both and
// they cannot drift apart.

export default function InvoicePrintPage() {
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
    documentTitle: data?.number || 'Invoice',
  })

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([api.get(`/invoices/${id}`), api.get('/settings/')])
      .then(([iRes, sRes]) => {
        const inv = iRes.data || {}
        setData(buildDocData('invoice', inv, sRes.data))
        setTheme(inv.pdf_theme || '')
        setDefaultTheme(sRes.data?.invoice_pdf_theme || '')
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Could not load this invoice.')
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  const pickTheme = async (key) => {
    setTheme(key)
    setSavingTheme(true)
    try {
      await api.put(`/invoices/${id}/pdf-theme`, { pdf_theme: key })
    } catch (err) {
      push(err.response?.data?.error || 'Could not save the template.', 'error')
      load()
    } finally {
      setSavingTheme(false)
    }
  }

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
        <button type="button" className="btn btn-inf-outline" onClick={() => navigate('/invoices')}>
          Back to invoices
        </button>
      </div>
    )
  }

  const activeKey = resolveKey('invoice', theme, defaultTheme)

  return (
    <div className="qp-print-page">
      <div className="no-print d-flex flex-wrap align-items-center gap-2 p-3" style={{ borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
        <button type="button" className="btn btn-inf" onClick={handlePrint}>
          <i className="bi bi-printer me-1" />
          Print / Save as PDF
        </button>
        <Link className="btn btn-inf-outline" to={`/invoices/${id}`}>
          Back
        </Link>
        <div className="ms-auto" style={{ minWidth: 240 }}>
          <TemplateSelect
            docType="invoice"
            id="print-invoice-theme"
            value={theme}
            onChange={pickTheme}
          />
          {savingTheme && <div className="form-text">Saving template…</div>}
        </div>
      </div>

      <div ref={contentRef}>
        <DocumentPrint
          docType="invoice"
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
