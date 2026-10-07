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
      push(`Quotation marked as ${status}.`, 'success')
      load()
    } catch (err) {
      push(err.response?.data?.error || 'Failed to update status.', 'danger')
    }
  }

  const duplicate = async () => {
    try {
      const res = await api.post(`/quotations/${id}/duplicate`)
      push('Quotation revision created.', 'success')
      navigate(`/quotations/edit/${res.data.id}`)
    } catch {
      push('Failed to create revision.', 'danger')
    }
  }

  const convert = async () => {
    try {
      const res = await api.post(`/quotations/${id}/convert`)
      push('Converted to invoice successfully!', 'success')
      navigate(`/invoices/${res.data.invoice_id}`)
    } catch (err) {
      push(err.response?.data?.error || 'Failed to convert.', 'danger')
      if (err.response?.data?.invoice_id) navigate(`/invoices/${err.response.data.invoice_id}`)
    }
  }

  const archive = async () => {
    try {
      await api.post(`/quotations/${id}/archive`)
      push('Quotation archived.', 'success')
      navigate('/quotations')
    } catch {
      push('Failed to archive quotation.', 'danger')
    }
  }

  const unarchive = async () => {
    try {
      await api.post(`/quotations/${id}/unarchive`)
      push('Quotation restored.', 'success')
      load()
    } catch {
      push('Failed to restore quotation.', 'danger')
    }
  }

  if (!q) {
    return (
      <Layout title="Quotation">
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="text-muted mt-2">Loading quotation details...</p>
        </div>
      </Layout>
    )
  }

  const editable = q.status !== 'Accepted' && q.status !== 'Invoiced'

  return (
    <Layout
      title={q.quotation_number}
      breadcrumb={
        <>
          <Link to="/">Dashboard</Link>
          <span className="separator">/</span>
          <Link to="/quotations">Quotations</Link>
          <span className="separator">/</span>
          <span className="current">{q.quotation_number}</span>
        </>
      }
    >
      <div className="row g-4">
        {/* Document Preview */}
        <div className="col-12 col-lg-8 animate-in">
          <div className="invoice-preview">
            {/* Subject Banner */}
            {q.subject && (
              <div className="doc-subject-banner">
                <div className="doc-subject-text">{q.subject}</div>
              </div>
            )}

            {/* Document Header */}
            <div className="invoice-preview-header">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div className="d-flex align-items-center gap-3">
                  {q.logo_base64 && (
                    <img
                      src={`data:image/png;base64,${q.logo_base64}`}
                      alt="ATS Logo"
                      style={{
                        width: 48,
                        height: 48,
                        objectFit: 'contain',
                        borderRadius: 10,
                        background: '#ffffff',
                        padding: 4,
                        boxShadow: 'var(--inf-shadow-sm)',
                      }}
                    />
                  )}
                  <div>
                    <h4 className="mb-0 fw-bold">{q.profile?.name || 'ATS Automation'}</h4>
                    <small className="text-primary fw-semibold">{q.profile?.tagline || 'Security & Systems'}</small>
                    <div className="text-muted mt-1" style={{ fontSize: '0.78rem', lineHeight: 1.4 }}>
                      {q.profile?.address && <>{q.profile.address}<br /></>}
                      {q.profile?.email} {q.profile?.phone && <>• {q.profile.phone}</>}
                    </div>
                  </div>
                </div>

                <div className="text-lg-end">
                  <div className="invoice-preview-title">QUOTATION</div>
                  <div className="fw-bold" style={{ fontSize: '1rem', color: 'var(--inf-text)' }}>
                    {q.quotation_number}
                  </div>
                  <span
                    className={`badge-status badge-${
                      q.status === 'Accepted' || q.status === 'Invoiced'
                        ? 'paid'
                        : q.status === 'Sent'
                        ? 'partial'
                        : q.status === 'Declined' || q.status === 'Expired'
                        ? 'overdue'
                        : 'draft'
                    } mt-1`}
                  >
                    {q.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Client Info & Quotation Meta Grid */}
            <div className="row g-3 mb-4">
              <div className="col-12 col-md-6">
                <div className="p-3 rounded-3" style={{ background: 'var(--inf-hover-row)', border: '1px solid var(--inf-border-light)' }}>
                  <div className="info-label">Prepared For</div>
                  <div className="fw-bold" style={{ fontSize: '1rem', color: 'var(--inf-text)' }}>
                    {q.client?.company_name || q.client?.name}
                  </div>
                  {q.client?.company_name && q.client?.name && (
                    <div className="small text-muted mb-1">
                      <strong>Attn:</strong> {q.client.name}
                    </div>
                  )}
                  {q.client?.address && <div className="small text-muted">{q.client.address}</div>}
                  {q.client?.phone && <div className="small text-muted">Phone: {q.client.phone}</div>}
                  {q.client?.email && <div className="small text-muted">Email: {q.client.email}</div>}
                  {q.client?.gst_number && (
                    <div className="small text-primary fw-bold mt-1">
                      GST NO: {q.client.gst_number}
                    </div>
                  )}
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="p-3 rounded-3" style={{ background: 'var(--inf-hover-row)', border: '1px solid var(--inf-border-light)' }}>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="info-label mb-0">Quotation Date:</span>
                    <span className="small fw-semibold">{formatDate(q.date_created)}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="info-label mb-0">Valid Until:</span>
                    <span className="small fw-semibold">{formatDate(q.valid_until)}</span>
                  </div>
                  {q.estimated_timeline && (
                    <div className="d-flex justify-content-between mb-1">
                      <span className="info-label mb-0">Timeline:</span>
                      <span className="small fw-semibold">{q.estimated_timeline}</span>
                    </div>
                  )}
                  {q.payment_terms && (
                    <div className="d-flex justify-content-between mb-1">
                      <span className="info-label mb-0">Payment Terms:</span>
                      <span className="small fw-semibold">{q.payment_terms}</span>
                    </div>
                  )}
                  {q.delivery_address && (
                    <div className="mt-2 pt-2" style={{ borderTop: '1px dashed var(--inf-border)' }}>
                      <span className="info-label mb-0">Delivery Address:</span>
                      <div className="small text-muted">{q.delivery_address}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Items Table with HSN Code */}
            <div className="table-responsive mb-4">
              <table className="items-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Particulars</th>
                    <th style={{ width: 100 }} className="text-center">HSN No.</th>
                    <th style={{ width: 70 }} className="text-end">Qty</th>
                    <th style={{ width: 110 }} className="text-end">Rate</th>
                    <th style={{ width: 130 }} className="text-end">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {q.items.map((it, i) => (
                    <tr key={it.id || i}>
                      <td>{i + 1}.</td>
                      <td>
                        <div className="fw-bold" style={{ color: 'var(--inf-text)' }}>{it.service_name}</div>
                        {it.description && (
                          <div className="text-muted" style={{ fontSize: '0.78rem', whiteSpace: 'pre-wrap', marginTop: 2 }}>
                            {it.description}
                          </div>
                        )}
                      </td>
                      <td className="text-center text-muted" style={{ fontSize: '0.82rem' }}>
                        {it.hsn_code || '—'}
                      </td>
                      <td className="text-end">{it.quantity}</td>
                      <td className="text-end">{formatINR(it.rate)}</td>
                      <td className="text-end fw-bold">{formatINR(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            <div className="row justify-content-end">
              <div className="col-12 col-md-6">
                <div className="p-3 rounded-3" style={{ background: 'var(--inf-hover-row)', border: '1px solid var(--inf-border-light)' }}>
                  <div className="summary-line">
                    <span className="text-muted">Sub Total</span>
                    <span className="fw-semibold">{formatINR(q.sub_total)}</span>
                  </div>
                  {q.discount_amount > 0 && (
                    <div className="summary-line">
                      <span className="text-muted">
                        Discount {q.discount_type === 'percent' && `(${q.discount}%)`}
                      </span>
                      <span className="fw-semibold text-danger">-{formatINR(q.discount_amount)}</span>
                    </div>
                  )}
                  {q.gst_amount > 0 && (
                    <div className="summary-line">
                      <span className="text-muted">GST @ {q.gst_percent}%</span>
                      <span className="fw-semibold">{formatINR(q.gst_amount)}</span>
                    </div>
                  )}
                  <div className="summary-line summary-total">
                    <span>Grand Total</span>
                    <span>{formatINR(q.total_amount)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes & Terms */}
            {q.notes && (
              <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--inf-border-light)' }}>
                <div className="info-label">Terms &amp; Conditions</div>
                <div className="small text-muted" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {q.notes}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Panel / Sidebar */}
        <div className="col-12 col-lg-4 animate-in">
          {/* Quick Actions Card */}
          <div className="inf-card mb-3">
            <div className="inf-card-header">
              <h6 className="fw-bold mb-0">Actions</h6>
            </div>
            <div className="card-body p-3 d-flex flex-column gap-2">
              <a
                href={`/api/quotations/${q.id}/pdf`}
                className="btn btn-inf w-100"
                target="_blank"
                rel="noreferrer"
              >
                <i className="bi bi-file-earmark-pdf"></i>
                <span>Download Branded PDF</span>
              </a>

              {q.status !== 'Invoiced' && (
                <button className="btn btn-inf-success w-100" onClick={convert}>
                  <i className="bi bi-receipt"></i>
                  <span>Convert to Invoice</span>
                </button>
              )}

              {q.whatsapp_url && (
                <a
                  href={q.whatsapp_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-inf-outline text-success w-100"
                >
                  <i className="bi bi-whatsapp"></i>
                  <span>Share on WhatsApp</span>
                </a>
              )}

              {q.email_url && (
                <a
                  href={q.email_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-inf-outline w-100"
                >
                  <i className="bi bi-envelope"></i>
                  <span>Send via Email</span>
                </a>
              )}

              {editable && (
                <Link to={`/quotations/edit/${q.id}`} className="btn btn-inf-outline w-100">
                  <i className="bi bi-pencil"></i>
                  <span>Edit Quotation</span>
                </Link>
              )}

              <button className="btn btn-inf-outline w-100" onClick={duplicate}>
                <i className="bi bi-copy"></i>
                <span>Create New Revision</span>
              </button>

              {q.is_archived ? (
                <button className="btn btn-inf-outline text-success w-100" onClick={unarchive}>
                  <i className="bi bi-arrow-counterclockwise"></i>
                  <span>Restore Quotation</span>
                </button>
              ) : (
                <button className="btn btn-inf-outline text-danger w-100" onClick={archive}>
                  <i className="bi bi-archive"></i>
                  <span>Archive Quotation</span>
                </button>
              )}
            </div>
          </div>

          {/* Status Workflow Selector */}
          <div className="inf-card">
            <div className="inf-card-header">
              <h6 className="fw-bold mb-0">Update Status</h6>
            </div>
            <div className="card-body p-3">
              <div className="d-flex flex-wrap gap-2">
                {statuses.map((s) => (
                  <button
                    key={s}
                    className={`btn btn-sm ${q.status === s ? 'btn-inf' : 'btn-inf-outline'}`}
                    onClick={() => setStatus(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
