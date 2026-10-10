import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useReactToPrint } from 'react-to-print'
import api from '../api/client'
import DocumentPrint from '../components/DocumentPrint'
import PrintThemePicker from '../components/PrintThemePicker'
import { normaliseQuotation } from '../lib/quotation'
import { mapInvoiceForPrint } from '../lib/invoiceMapper'
// Imported here (not in main.jsx) so the sheet's Calibri/Cambria face and
// mm-positioned layout never compete with the app's stylesheet, and so the CSS
// is code-split onto these routes alone.
import '../styles/print.css'
// Vite resolves this to a URL that respects base '/app/'.
import watermarkUrl from '../../public/assets/watermark.svg'

export default function InvoicePrintPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const contentRef = useRef(null)
  const [invoice, setInvoice] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  // A one-time ?theme= choice for the server-rendered PDF. Deliberately not
  // saved: this is a preview affordance on the print page, not an edit.
  const [oneTimeTheme, setOneTimeTheme] = useState('')
  // Read from the API response, not from `invoice`: the print mapper builds a
  // sheet-shaped object and carries no pdf_theme, so the toolbar would always
  // start from the company default.
  const [savedTheme, setSavedTheme] = useState('')

  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: invoice?.invoiceNo || 'Invoice',
  })

  useEffect(() => {
    let cancelled = false

    if (!id) {
      setError('No invoice was selected to print.')
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    Promise.all([api.get(`/invoices/${id}`), api.get('/settings/')])
      .then(([iRes, sRes]) => {
        if (cancelled) return
        setSavedTheme(iRes.data?.pdf_theme || '')
        setInvoice(normaliseQuotation(mapInvoiceForPrint(iRes.data, sRes.data)))
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.response?.data?.error || 'Could not load this invoice.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

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

  return (
    <div className="qp-print-page">
      {/* no-print: react-to-print clones contentRef only, so this toolbar is
          never part of the printed page. */}
      <div className="no-print d-flex align-items-center gap-2 p-3" style={{ borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
        <button type="button" className="btn btn-inf" onClick={handlePrint}>
          <i className="bi bi-printer me-1" />
          Print / Save as PDF
        </button>
        <Link className="btn btn-inf-outline" to={`/invoices/${id}`}>
          Back
        </Link>
        <PrintThemePicker
          docType="invoice"
          saved={savedTheme}
          onPick={(key) => setOneTimeTheme(key)}
        />
        {oneTimeTheme && (
          <a className="btn btn-inf-outline" href={`/api/invoices/${id}/pdf?theme=${oneTimeTheme}`}>
            <i className="bi bi-download me-1" />
            Download this template
          </a>
        )}
      </div>

      <div ref={contentRef} style={{ '--qp-watermark': `url(${watermarkUrl})` }}>
        <DocumentPrint document={invoice} />
      </div>
    </div>
  )
}
