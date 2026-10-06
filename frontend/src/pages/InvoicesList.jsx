import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'
import Layout from '../components/Layout'
import { useToast } from '../context/ToastContext'

const formatINR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const formatDate = (s) => (s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

export default function InvoicesList() {
  const [invoices, setInvoices] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const { push } = useToast()
  const navigate = useNavigate()

  const load = () => {
    setLoading(true)
    api.get('/invoices/', { params: { q: search, status } })
      .then((res) => setInvoices(res.data.invoices))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [status])

  const handleSearch = (e) => { e.preventDefault(); load() }

  const archive = async (id) => { await api.post(`/invoices/${id}/archive`); push('Invoice archived.', 'success'); load() }
  const unarchive = async (id) => { await api.post(`/invoices/${id}/unarchive`); push('Invoice restored.', 'success'); load() }

  return (
    <Layout>
      {/* Breadcrumbs + Title + Description + Actions */}
      <div className="mb-4">
        <nav style={{ fontSize: '0.8rem', color: 'var(--inf-text-muted)', fontWeight: 600 }} className="mb-2">
          <Link to="/" style={{ color: 'var(--inf-primary)', textDecoration: 'none' }}>Dashboard</Link>
          <span className="mx-1">/</span>
          <span>Invoices</span>
        </nav>
        <div className="d-flex flex-wrap align-items-end justify-content-between gap-3">
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>Invoices</h1>
            <p className="text-muted mb-0" style={{ fontSize: '0.9rem', fontWeight: 500 }}>All generated invoices</p>
          </div>
          <div className="d-flex gap-2">
            <a className="btn btn-inf-outline btn-sm bg-white" href={`/api/invoices/export?q=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`}>
              <i className="bi bi-download me-1"></i>Export
            </a>
            <button className="btn btn-inf btn-sm" onClick={() => navigate('/invoices/create')}>
              <i className="bi bi-plus-lg me-1"></i>New Invoice
            </button>
          </div>
        </div>
      </div>

      {/* Main white card */}
      <div className="inf-card">
        <div className="card-body p-0">
          {/* Search / Filter bar */}
          <div className="d-flex align-items-center gap-2 p-3" style={{ borderBottom: '1px solid var(--inf-border)' }}>
            <form onSubmit={handleSearch} className="search-bar" style={{ width: 300, flex: '0 1 320px' }}>
              <i className="bi bi-search"></i>
              <input
                className="form-control"
                placeholder="Search invoice # or client..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </form>
            <select className="form-select" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Paid">Paid</option>
              <option value="Archived">Archived</option>
            </select>
          </div>

          {/* Content */}
          {loading ? (
            <div className="text-center py-5"><div className="spinner-border"></div></div>
          ) : invoices.length === 0 ? (
            <div className="d-flex flex-column align-items-center justify-content-center text-center" style={{ minHeight: 380, padding: '3rem 1rem' }}>
              <div
                className="d-flex align-items-center justify-content-center"
                style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: 'var(--inf-bg)', color: 'var(--inf-text-muted)',
                  fontSize: '2rem', marginBottom: '1rem',
                }}
              >
                <i className="bi bi-file-earmark-text"></i>
              </div>
              <h6 className="fw-bold mb-1" style={{ fontSize: '1.05rem' }}>No invoices found</h6>
              <p className="text-muted mb-0" style={{ fontSize: '0.9rem', maxWidth: 420 }}>
                Create your first invoice to get started.
              </p>
            </div>
          ) : (
            <div className="table-responsive p-3">
              <table className="table mb-0">
                <thead>
                  <tr><th>Invoice</th><th>Client</th><th>Date</th><th>Due</th><th className="text-end">Total</th><th className="text-end">Balance</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td><Link to={`/invoices/${inv.id}`} className="fw-semibold text-decoration-none">{inv.invoice_number}</Link></td>
                      <td>{inv.client_name}</td>
                      <td>{formatDate(inv.date_created)}</td>
                      <td>{formatDate(inv.due_date)}</td>
                      <td className="text-end">{formatINR(inv.total_amount)}</td>
                      <td className="text-end">{formatINR(inv.balance_due)}</td>
                      <td><span className={`badge bg-${inv.status === 'Paid' ? 'success' : inv.status === 'Pending' ? 'warning' : 'info'}`}>{inv.status}</span></td>
                      <td className="text-end">
                        {inv.is_archived
                          ? <button className="btn btn-inf-outline btn-sm" onClick={() => unarchive(inv.id)}><i className="bi bi-arrow-counterclockwise"></i></button>
                          : <button className="btn btn-inf-outline btn-sm" onClick={() => archive(inv.id)}><i className="bi bi-archive"></i></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
