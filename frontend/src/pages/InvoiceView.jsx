import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../api/client'
import Layout from '../components/Layout'
import { useToast } from '../context/ToastContext'

const formatINR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const formatDate = (s) => (s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

export default function InvoiceView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { push } = useToast()
  const [inv, setInv] = useState(null)
  const [advance, setAdvance] = useState(0)
  const [paymentMode, setPaymentMode] = useState('')

  const load = () => api.get(`/invoices/${id}`).then((res) => {
    setInv(res.data)
    setAdvance(res.data.advance_amount)
    setPaymentMode(res.data.payment_mode || '')
  })

  useEffect(() => { load() }, [id])

  const updatePayment = async (e) => {
    e.preventDefault()
    try {
      await api.post(`/invoices/${id}/status`, { advance_amount: advance, payment_mode: paymentMode })
      push('Payment updated.', 'success')
      load()
    } catch { push('Failed to update.', 'danger') }
  }

  const archive = async () => { await api.post(`/invoices/${id}/archive`); push('Invoice archived.', 'success'); navigate('/invoices') }
  const unarchive = async () => { await api.post(`/invoices/${id}/unarchive`); push('Invoice restored.', 'success'); load() }

  if (!inv) return <Layout title="Invoice"><div className="text-center py-5"><div className="spinner-border"></div></div></Layout>

  const editable = inv.status === 'Pending' || inv.status === 'Partially Paid'

  return (
    <Layout title={inv.invoice_number} breadcrumb={<><Link to="/">Dashboard</Link><span className="separator">/</span><Link to="/invoices">Invoices</Link><span className="separator">/</span><span className="current">{inv.invoice_number}</span></>}>
      <div className="row g-4">
        <div className="col-lg-8">
          <div className="invoice-preview">
            <div className="invoice-header-bar">
              <div className="d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-3">
                  {inv.logo_base64 && <img src={`data:image/png;base64,${inv.logo_base64}`} alt="Logo" style={{ width: 42, height: 42, objectFit: 'contain', borderRadius: 8, background: '#fff', padding: 4 }} />}
                  <div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-0.5px', color: 'var(--inf-text)' }}>{inv.profile?.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--inf-text-muted)' }}>{inv.profile?.tagline}</div>
                    <div className="mt-2" style={{ fontSize: '0.75rem', color: 'var(--inf-text-muted)', lineHeight: 1.4 }}>
                      {inv.profile?.address && <>{inv.profile.address}<br /></>}
                      {inv.profile?.email} {inv.profile?.phone && <>&bull; {inv.profile.phone}</>}
                    </div>
                  </div>
                </div>
                <div className="text-end" style={{ whiteSpace: 'nowrap' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--inf-primary)' }}>Invoice</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--inf-text-muted)' }}>{inv.invoice_number}</div>
                  <span className={`badge bg-${inv.status === 'Paid' ? 'success' : inv.status === 'Pending' ? 'warning' : 'info'} mt-1`}>{inv.status}</span>
                </div>
              </div>
            </div>

            <div className="invoice-body-content">
              <div className="row mb-4">
                <div className="col-md-6">
                  <div className="info-label">Bill To</div>
                  {inv.client?.company_name ? (
                    <><div className="fw-bold" style={{ fontSize: '0.95rem' }}>{inv.client.company_name}</div><div className="small text-muted mb-1">Attn: {inv.client.name}</div></>
                  ) : (
                    <div className="fw-bold" style={{ fontSize: '0.95rem' }}>{inv.client?.name}</div>
                  )}
                  {inv.client?.email && <div className="small text-muted">{inv.client.email}</div>}
                  {inv.client?.phone && <div className="small text-muted">{inv.client.phone}</div>}
                  {inv.client?.address && <div className="small text-muted">{inv.client.address}</div>}
                </div>
                <div className="col-md-6 text-md-end">
                  <div className="info-label">Invoice Date</div>
                  <div className="small">{formatDate(inv.date_created)}</div>
                  <div className="info-label mt-2">Due Date</div>
                  <div className="small">{formatDate(inv.due_date)}</div>
                  {inv.subject && <><div className="info-label mt-2">Subject</div><div className="small">{inv.subject}</div></>}
                </div>
              </div>

              <div className="table-responsive mb-4">
                <table className="items-table w-100" style={{ borderCollapse: 'collapse' }}>
                  <thead><tr><th>#</th><th>Service</th><th className="text-end">Qty</th><th className="text-end">Rate</th><th className="text-end">Amount</th></tr></thead>
                  <tbody>
                    {inv.items.map((it, i) => (
                      <tr key={it.id}>
                        <td>{i + 1}</td>
                        <td><div>{it.service_name}</div>{it.description && <div className="text-muted" style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>{it.description}</div>}</td>
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
                  <div className="summary-line"><span className="text-muted">Sub Total</span><span className="fw-semibold">{formatINR(inv.sub_total)}</span></div>
                  {inv.discount_amount > 0 && <div className="summary-line"><span className="text-muted">Discount{inv.discount_type === 'percent' && ` (${inv.discount}%)`}</span><span className="fw-semibold" style={{ color: 'var(--inf-danger)' }}>-{formatINR(inv.discount_amount)}</span></div>}
                  {inv.gst_amount > 0 && <div className="summary-line"><span className="text-muted">GST ({inv.gst_percent}%)</span><span className="fw-semibold">{formatINR(inv.gst_amount)}</span></div>}
                  <div className="summary-line summary-total mb-2"><span>Total</span><span>{formatINR(inv.total_amount)}</span></div>
                  {inv.advance_amount > 0 && <div className="summary-line"><span className="text-muted">Amount Received</span><span className="fw-semibold">{formatINR(inv.advance_amount)}</span></div>}
                  {inv.balance_due > 0 && <div className="summary-line summary-total mt-2 pt-2 align-items-center" style={{ borderTop: '1px solid var(--inf-border-light)' }}><span>Balance Due</span><span style={{ color: 'var(--inf-danger)' }}>{formatINR(inv.balance_due)}</span></div>}
                </div>
              </div>

              {inv.notes && <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--inf-border-light)' }}>
                <div className="info-label mb-1">Terms &amp; Conditions</div>
                <div className="small text-muted" style={{ whiteSpace: 'pre-wrap' }}>{inv.notes}</div>
              </div>}
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="inf-card mb-3"><div className="card-body p-4">
            <h6 className="fw-bold mb-3">Actions</h6>
            <a href={`/api/invoices/${inv.id}/pdf`} className="btn btn-inf w-100 mb-2" target="_blank" rel="noreferrer"><i className="bi bi-file-earmark-pdf me-1"></i>Download PDF</a>
            {inv.whatsapp_url && <a href={inv.whatsapp_url} target="_blank" rel="noreferrer" className="btn btn-inf-outline w-100 mb-2"><i className="bi bi-whatsapp me-1"></i>WhatsApp</a>}
            {inv.email_url && <a href={inv.email_url} target="_blank" rel="noreferrer" className="btn btn-inf-outline w-100 mb-2"><i className="bi bi-envelope me-1"></i>Email</a>}
            {editable && <Link to={`/invoices/edit/${inv.id}`} className="btn btn-inf-outline w-100 mb-2"><i className="bi bi-pencil me-1"></i>Edit</Link>}
            {inv.is_archived
              ? <button className="btn btn-inf-outline w-100" onClick={unarchive}><i className="bi bi-arrow-counterclockwise me-1"></i>Restore</button>
              : <button className="btn btn-inf-outline text-danger w-100" onClick={archive}><i className="bi bi-archive me-1"></i>Archive</button>}
          </div></div>

          <div className="inf-card mb-3"><div className="card-body p-4">
            <h6 className="fw-bold mb-3">Payment</h6>
            <form onSubmit={updatePayment}>
              <label className="form-label small">Amount Received (₹)</label>
              <input type="number" className="form-control form-control-sm mb-2" value={advance} min="0" step="0.01" onChange={(e) => setAdvance(e.target.value)} />
              <label className="form-label small">Mode</label>
              <select className="form-select form-select-sm mb-3" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                <option value="">Not specified</option><option>Cash</option><option>UPI</option><option>Bank</option>
              </select>
              <button className="btn btn-inf btn-sm w-100">Update Payment</button>
            </form>
          </div></div>

          {inv.qr_base64 && <div className="inf-card"><div className="card-body p-4 text-center">
            <h6 className="fw-bold mb-2">Scan to Pay</h6>
            <img src={`data:image/png;base64,${inv.qr_base64}`} alt="UPI QR" style={{ width: 160 }} />
          </div></div>}
        </div>
      </div>
    </Layout>
  )
}
