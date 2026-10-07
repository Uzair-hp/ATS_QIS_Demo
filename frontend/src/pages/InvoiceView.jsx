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

  const load = () => {
    api.get(`/invoices/${id}`).then((res) => {
      setInv(res.data)
      setAdvance(res.data.advance_amount)
      setPaymentMode(res.data.payment_mode || '')
    })
  }

  useEffect(() => { load() }, [id])

  const updatePayment = async (e) => {
    e.preventDefault()
    try {
      await api.post(`/invoices/${id}/status`, { advance_amount: advance, payment_mode: paymentMode })
      push('Payment details updated.', 'success')
      load()
    } catch {
      push('Failed to update payment.', 'danger')
    }
  }

  const archive = async () => {
    try {
      await api.post(`/invoices/${id}/archive`)
      push('Invoice archived.', 'success')
      navigate('/invoices')
    } catch {
      push('Failed to archive invoice.', 'danger')
    }
  }

  const unarchive = async () => {
    try {
      await api.post(`/invoices/${id}/unarchive`)
      push('Invoice restored.', 'success')
      load()
    } catch {
      push('Failed to restore invoice.', 'danger')
    }
  }

  if (!inv) {
    return (
      <Layout title="Invoice">
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="text-muted mt-2">Loading invoice details...</p>
        </div>
      </Layout>
    )
  }

  const editable = inv.status === 'Pending' || inv.status === 'Partially Paid'

  return (
    <Layout
      title={inv.invoice_number}
      breadcrumb={
        <>
          <Link to="/">Dashboard</Link>
          <span className="separator">/</span>
          <Link to="/invoices">Invoices</Link>
          <span className="separator">/</span>
          <span className="current">{inv.invoice_number}</span>
        </>
      }
    >
      <div className="row g-4">
        {/* Document Preview Area */}
        <div className="col-12 col-lg-8 animate-in">
          <div className="invoice-preview">
            {/* Subject Banner if available */}
            {inv.subject && (
              <div className="doc-subject-banner">
                <div className="doc-subject-text">{inv.subject}</div>
              </div>
            )}

            {/* Document Header */}
            <div className="invoice-preview-header">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div className="d-flex align-items-center gap-3">
                  {inv.logo_base64 && (
                    <img
                      src={`data:image/png;base64,${inv.logo_base64}`}
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
                    <h4 className="mb-0 fw-bold">{inv.profile?.name || 'ATS Automation'}</h4>
                    <small className="text-primary fw-semibold">{inv.profile?.tagline || 'Security & Systems'}</small>
                    <div className="text-muted mt-1" style={{ fontSize: '0.78rem', lineHeight: 1.4 }}>
                      {inv.profile?.address && <>{inv.profile.address}<br /></>}
                      {inv.profile?.email} {inv.profile?.phone && <>• {inv.profile.phone}</>}
                      {inv.profile?.gst_number && <><br />GSTIN: <strong>{inv.profile.gst_number}</strong></>}
                    </div>
                  </div>
                </div>

                <div className="text-lg-end">
                  <div className="invoice-preview-title">TAX INVOICE</div>
                  <div className="fw-bold" style={{ fontSize: '1rem', color: 'var(--inf-text)' }}>
                    {inv.invoice_number}
                  </div>
                  <span
                    className={`badge-status badge-${
                      inv.status === 'Paid'
                        ? 'paid'
                        : inv.status === 'Pending'
                        ? 'pending'
                        : inv.status === 'Partially Paid'
                        ? 'partial'
                        : 'overdue'
                    } mt-1`}
                  >
                    {inv.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Bill To & Invoice Meta Grid */}
            <div className="row g-3 mb-4">
              <div className="col-12 col-md-6">
                <div className="p-3 rounded-3" style={{ background: 'var(--inf-hover-row)', border: '1px solid var(--inf-border-light)' }}>
                  <div className="info-label">Bill To</div>
                  <div className="fw-bold" style={{ fontSize: '1rem', color: 'var(--inf-text)' }}>
                    {inv.client?.company_name || inv.client?.name}
                  </div>
                  {inv.client?.company_name && inv.client?.name && (
                    <div className="small text-muted mb-1">
                      <strong>Attn:</strong> {inv.client.name}
                    </div>
                  )}
                  {inv.client?.address && <div className="small text-muted">{inv.client.address}</div>}
                  {inv.client?.phone && <div className="small text-muted">Phone: {inv.client.phone}</div>}
                  {inv.client?.email && <div className="small text-muted">Email: {inv.client.email}</div>}
                  {inv.client?.gst_number && (
                    <div className="small text-primary fw-bold mt-1">
                      GST NO: {inv.client.gst_number}
                    </div>
                  )}
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="p-3 rounded-3" style={{ background: 'var(--inf-hover-row)', border: '1px solid var(--inf-border-light)' }}>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="info-label mb-0">Invoice Date:</span>
                    <span className="small fw-semibold">{formatDate(inv.date_created)}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="info-label mb-0">Due Date:</span>
                    <span className="small fw-semibold">{formatDate(inv.due_date)}</span>
                  </div>
                  {inv.voucher_number && (
                    <div className="d-flex justify-content-between mb-1">
                      <span className="info-label mb-0">Voucher No:</span>
                      <span className="small fw-semibold">{inv.voucher_number}</span>
                    </div>
                  )}
                  {inv.payment_terms && (
                    <div className="d-flex justify-content-between mb-1">
                      <span className="info-label mb-0">Payment Terms:</span>
                      <span className="small fw-semibold">{inv.payment_terms}</span>
                    </div>
                  )}
                  {inv.delivery_address && (
                    <div className="mt-2 pt-2" style={{ borderTop: '1px dashed var(--inf-border)' }}>
                      <span className="info-label mb-0">Delivery Address:</span>
                      <div className="small text-muted">{inv.delivery_address}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Particulars / Items Table with HSN Code */}
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
                  {inv.items.map((it, i) => (
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

            {/* Bank Details & Financial Summary Block */}
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <div className="p-3 rounded-3" style={{ background: 'var(--inf-hover-row)', border: '1px solid var(--inf-border-light)' }}>
                  <div className="info-label">Bank &amp; Payment Details</div>
                  <div className="small" style={{ lineHeight: 1.6 }}>
                    {inv.profile?.bank_name && <div><strong>Bank:</strong> {inv.profile.bank_name}</div>}
                    {inv.profile?.bank_branch && <div><strong>Branch:</strong> {inv.profile.bank_branch}</div>}
                    {inv.profile?.bank_account && <div><strong>A/C No:</strong> {inv.profile.bank_account}</div>}
                    {inv.profile?.bank_ifsc && <div><strong>IFSC:</strong> {inv.profile.bank_ifsc}</div>}
                    {inv.profile?.msme_number && <div><strong>MSME:</strong> {inv.profile.msme_number}</div>}
                  </div>
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="p-3 rounded-3" style={{ background: 'var(--inf-hover-row)', border: '1px solid var(--inf-border-light)' }}>
                  <div className="summary-line">
                    <span className="text-muted">Sub Total</span>
                    <span className="fw-semibold">{formatINR(inv.sub_total)}</span>
                  </div>
                  {inv.discount_amount > 0 && (
                    <div className="summary-line">
                      <span className="text-muted">
                        Discount {inv.discount_type === 'percent' && `(${inv.discount}%)`}
                      </span>
                      <span className="fw-semibold text-danger">-{formatINR(inv.discount_amount)}</span>
                    </div>
                  )}
                  {inv.gst_amount > 0 && (
                    <div className="summary-line">
                      <span className="text-muted">GST @ {inv.gst_percent}%</span>
                      <span className="fw-semibold">{formatINR(inv.gst_amount)}</span>
                    </div>
                  )}
                  <div className="summary-line summary-total">
                    <span>Grand Total</span>
                    <span>{formatINR(inv.total_amount)}</span>
                  </div>
                  {inv.advance_amount > 0 && (
                    <div className="summary-line mt-2">
                      <span className="text-muted">Amount Received</span>
                      <span className="fw-semibold text-success">{formatINR(inv.advance_amount)}</span>
                    </div>
                  )}
                  {inv.balance_due > 0 && (
                    <div
                      className="summary-line mt-1 pt-2 fw-bold"
                      style={{ borderTop: '1px solid var(--inf-border)', color: 'var(--inf-danger)', fontSize: '1rem' }}
                    >
                      <span>Balance Due</span>
                      <span>{formatINR(inv.balance_due)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Terms and Notes */}
            {inv.notes && (
              <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--inf-border-light)' }}>
                <div className="info-label">Terms &amp; Conditions</div>
                <div className="small text-muted" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {inv.notes}
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
                href={`/api/invoices/${inv.id}/pdf`}
                className="btn btn-inf w-100"
                target="_blank"
                rel="noreferrer"
              >
                <i className="bi bi-file-earmark-pdf"></i>
                <span>Download Branded PDF</span>
              </a>

              {inv.whatsapp_url && (
                <a
                  href={inv.whatsapp_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-inf-outline text-success w-100"
                >
                  <i className="bi bi-whatsapp"></i>
                  <span>Share on WhatsApp</span>
                </a>
              )}

              {inv.email_url && (
                <a
                  href={inv.email_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-inf-outline w-100"
                >
                  <i className="bi bi-envelope"></i>
                  <span>Send via Email</span>
                </a>
              )}

              {editable && (
                <Link to={`/invoices/edit/${inv.id}`} className="btn btn-inf-outline w-100">
                  <i className="bi bi-pencil"></i>
                  <span>Edit Invoice</span>
                </Link>
              )}

              {inv.is_archived ? (
                <button className="btn btn-inf-outline text-success w-100" onClick={unarchive}>
                  <i className="bi bi-arrow-counterclockwise"></i>
                  <span>Restore Invoice</span>
                </button>
              ) : (
                <button className="btn btn-inf-outline text-danger w-100" onClick={archive}>
                  <i className="bi bi-archive"></i>
                  <span>Archive Invoice</span>
                </button>
              )}
            </div>
          </div>

          {/* Payment Tracking Card */}
          <div className="inf-card mb-3">
            <div className="inf-card-header">
              <h6 className="fw-bold mb-0">Record Payment</h6>
            </div>
            <div className="card-body p-3">
              <form onSubmit={updatePayment}>
                <div className="mb-2">
                  <label className="form-label">Amount Received (₹)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={advance}
                    min="0"
                    step="0.01"
                    onChange={(e) => setAdvance(e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Payment Mode</label>
                  <select
                    className="form-select"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                  >
                    <option value="">Not Specified</option>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / Online</option>
                    <option value="Bank">Bank Transfer / Cheque</option>
                  </select>
                </div>
                <button className="btn btn-inf w-100">
                  <i className="bi bi-check2-circle"></i>
                  <span>Update Payment</span>
                </button>
              </form>
            </div>
          </div>

          {/* UPI QR Code if available */}
          {inv.qr_base64 && (
            <div className="inf-card text-center p-3">
              <h6 className="fw-bold mb-2">Scan to Pay via UPI</h6>
              <img
                src={`data:image/png;base64,${inv.qr_base64}`}
                alt="Scan to Pay UPI QR"
                style={{ width: 160, height: 160, borderRadius: 12, margin: '0 auto' }}
              />
              <div className="text-muted mt-2" style={{ fontSize: '0.75rem' }}>
                Instant UPI Payment for Balance: <strong>{formatINR(inv.balance_due)}</strong>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
