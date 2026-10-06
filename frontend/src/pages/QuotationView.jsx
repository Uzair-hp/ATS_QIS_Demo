import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../api/client'
import Layout from '../components/Layout'
import { useToast } from '../context/ToastContext'

const formatINR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const formatDate = (s) => (s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
const statuses = ['Draft', 'Sent', 'Accepted', 'Declined', 'Expired']

export default function QuotationView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { push } = useToast()
  const [q, setQ] = useState(null)

  const load = () => api.get(`/quotations/${id}`).then((res) => setQ(res.data))
  useEffect(() => { load() }, [id])

  const setStatus = async (status) => {
    try {
      await api.post(`/quotations/${id}/status`, { status })
      push(`Status set to ${status}.`, 'success')
      load()
    } catch (err) { push(err.response?.data?.error || 'Failed.', 'danger') }
  }

  const duplicate = async () => {
    const res = await api.post(`/quotations/${id}/duplicate`)
    push('Revision created.', 'success')
    navigate(`/quotations/edit/${res.data.id}`)
  }

  const convert = async () => {
    try {
      const res = await api.post(`/quotations/${id}/convert`)
      push('Converted to invoice!', 'success')
      navigate(`/invoices/${res.data.invoice_id}`)
    } catch (err) {
      push(err.response?.data?.error || 'Failed to convert.', 'danger')
      if (err.response?.data?.invoice_id) navigate(`/invoices/${err.response.data.invoice_id}`)
    }
  }

  const archive = async () => { await api.post(`/quotations/${id}/archive`); push('Quotation archived.', 'success'); navigate('/quotations') }
  const unarchive = async () => { await api.post(`/quotations/${id}/unarchive`); push('Quotation restored.', 'success'); load() }

  if (!q) return <Layout title="Quotation"><div className="text-center py-5"><div className="spinner-border"></div></div></Layout>

  const editable = q.status !== 'Accepted' && q.status !== 'Invoiced'

  return (
    <Layout title={q.quotation_number} breadcrumb={<><Link to="/">Dashboard</Link><span className="separator">/</span><Link to="/quotations">Quotations</Link><span className="separator">/</span><span className="current">{q.quotation_number}</span></>}>
      <div className="row g-4">
        <div className="col-lg-8">
          <div className="invoice-preview">
            <div className="invoice-header-bar">
              <div className="d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-3">
                  {q.logo_base64 && <img src={`data:image/png;base64,${q.logo_base64}`} alt="Logo" style={{ width: 42, height: 42, objectFit: 'contain', borderRadius: 8, background: '#fff', padding: 4 }} />}
                  <div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-0.5px', color: 'var(--inf-text)' }}>{q.profile?.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--inf-text-muted)' }}>{q.profile?.tagline}</div>
                  </div>
                </div>
                <div className="text-end" style={{ whiteSpace: 'nowrap' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--inf-primary)' }}>Quotation</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--inf-text-muted)' }}>{q.quotation_number}</div>
                  <span className="badge bg-secondary mt-1">{q.status}</span>
                </div>
              </div>
            </div>

            <div className="invoice-body-content">
              <div className="row mb-4">
                <div className="col-md-6">
                  <div className="info-label">Prepared For</div>
                  {q.client?.company_name ? (
                    <><div className="fw-bold">{q.client.company_name}</div><div className="small text-muted">Attn: {q.client.name}</div></>
                  ) : <div className="fw-bold">{q.client?.name}</div>}
                  {q.client?.email && <div className="small text-muted">{q.client.email}</div>}
                  {q.client?.phone && <div className="small text-muted">{q.client.phone}</div>}
                </div>
                <div className="col-md-6 text-md-end">
                  <div className="info-label">Date</div>
                  <div className="small">{formatDate(q.date_created)}</div>
                  <div className="info-label mt-2">Valid Until</div>
                  <div className="small">{formatDate(q.valid_until)}</div>
                  {q.estimated_timeline && <><div className="info-label mt-2">Timeline</div><div className="small">{q.estimated_timeline}</div></>}
                </div>
              </div>

              <div className="table-responsive mb-4">
                <table className="items-table w-100" style={{ borderCollapse: 'collapse' }}>
                  <thead><tr><th>#</th><th>Service</th><th className="text-end">Qty</th><th className="text-end">Rate</th><th className="text-end">Amount</th></tr></thead>
                  <tbody>
                    {q.items.map((it, i) => (
                      <tr key={it.id}>
                        <td>{i + 1}</td>
                        <td><div>{it.service_name}</div>{it.description && <div className="text-muted" style={{ fontSize: '0.75rem' }}>{it.description}</div>}</td>
                        <td className="text-end">{it.quantity}</td>
                        <td className="text-end">{formatINR(it.rate)}</td>
                        <td className="text-end fw-semibold">{formatINR(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="row justify-content-end">
                <div className="col-md-8 col-lg-7">
                  <div className="summary-line"><span className="text-muted">Sub Total</span><span className="fw-semibold">{formatINR(q.sub_total)}</span></div>
                  {q.discount_amount > 0 && <div className="summary-line"><span className="text-muted">Discount{q.discount_type === 'percent' && ` (${q.discount}%)`}</span><span className="fw-semibold" style={{ color: 'var(--inf-danger)' }}>-{formatINR(q.discount_amount)}</span></div>}
                  {q.gst_amount > 0 && <div className="summary-line"><span className="text-muted">GST ({q.gst_percent}%)</span><span className="fw-semibold">{formatINR(q.gst_amount)}</span></div>}
                  <div className="summary-line summary-total mb-2"><span>Total</span><span>{formatINR(q.total_amount)}</span></div>
                </div>
              </div>

              {q.notes && <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--inf-border-light)' }}>
                <div className="info-label mb-1">Terms &amp; Conditions</div>
                <div className="small text-muted" style={{ whiteSpace: 'pre-wrap' }}>{q.notes}</div>
              </div>}
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="inf-card mb-3"><div className="card-body p-4">
            <h6 className="fw-bold mb-3">Actions</h6>
            <a href={`/api/quotations/${q.id}/pdf`} className="btn btn-inf w-100 mb-2" target="_blank" rel="noreferrer"><i className="bi bi-file-earmark-pdf me-1"></i>Download PDF</a>
            {q.whatsapp_url && <a href={q.whatsapp_url} target="_blank" rel="noreferrer" className="btn btn-inf-outline w-100 mb-2"><i className="bi bi-whatsapp me-1"></i>WhatsApp</a>}
            {q.email_url && <a href={q.email_url} target="_blank" rel="noreferrer" className="btn btn-inf-outline w-100 mb-2"><i className="bi bi-envelope me-1"></i>Email</a>}
            {editable && <Link to={`/quotations/edit/${q.id}`} className="btn btn-inf-outline w-100 mb-2"><i className="bi bi-pencil me-1"></i>Edit</Link>}
            <button className="btn btn-inf-outline w-100 mb-2" onClick={duplicate}><i className="bi bi-copy me-1"></i>New Revision</button>
            {q.status !== 'Invoiced' && <button className="btn btn-inf w-100 mb-2" onClick={convert}><i className="bi bi-receipt me-1"></i>Convert to Invoice</button>}
            {q.is_archived
              ? <button className="btn btn-inf-outline w-100" onClick={unarchive}><i className="bi bi-arrow-counterclockwise me-1"></i>Restore</button>
              : <button className="btn btn-inf-outline text-danger w-100" onClick={archive}><i className="bi bi-archive me-1"></i>Archive</button>}
          </div></div>

          <div className="inf-card"><div className="card-body p-4">
            <h6 className="fw-bold mb-3">Status</h6>
            <div className="d-flex flex-wrap gap-2">
              {statuses.map((s) => (
                <button key={s} className={`btn btn-sm ${q.status === s ? 'btn-inf' : 'btn-inf-outline'}`} onClick={() => setStatus(s)}>{s}</button>
              ))}
            </div>
          </div></div>
        </div>
      </div>
    </Layout>
  )
}
