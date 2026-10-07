import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'
import Layout from '../components/Layout'
import { useToast } from '../context/ToastContext'

const formatINR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const formatDate = (s) => (s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

export default function QuotationsList() {
  const [quotations, setQuotations] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const { push } = useToast()
  const navigate = useNavigate()

  const load = () => {
    setLoading(true)
    api.get('/quotations/', { params: { q: search, status } })
      .then((res) => setQuotations(res.data.quotations))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [status])

  const handleSearch = (e) => { e.preventDefault(); load() }

  const archive = async (id) => {
    try {
      await api.post(`/quotations/${id}/archive`)
      push('Quotation archived.', 'success')
      load()
    } catch {
      push('Failed to archive quotation.', 'danger')
    }
  }

  const unarchive = async (id) => {
    try {
      await api.post(`/quotations/${id}/unarchive`)
      push('Quotation restored.', 'success')
      load()
    } catch {
      push('Failed to restore quotation.', 'danger')
    }
  }

  return (
    <Layout
      title="Quotations"
      breadcrumb={
        <>
          <Link to="/">Dashboard</Link>
          <span className="separator">/</span>
          <span className="current">Quotations</span>
        </>
      }
    >
      {/* Header bar with actions */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h2 className="mb-1" style={{ fontSize: '1.45rem', fontWeight: 800 }}>Quotations</h2>
          <p className="text-muted mb-0" style={{ fontSize: '0.85rem' }}>
            Manage client proposals, validity periods, and quotations
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <a
            className="btn btn-inf-outline btn-sm"
            href={`/api/quotations/export?q=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`}
          >
            <i className="bi bi-download"></i>
            <span>Export CSV</span>
          </a>
          <button className="btn btn-inf btn-sm" onClick={() => navigate('/quotations/create')}>
            <i className="bi bi-plus-lg"></i>
            <span>New Quotation</span>
          </button>
        </div>
      </div>

      {/* Main card */}
      <div className="inf-card animate-in">
        {/* Search & Filter Header */}
        <div className="p-3" style={{ borderBottom: '1px solid var(--inf-border-light)' }}>
          <div className="row g-2 align-items-center">
            <div className="col-12 col-md-5 col-lg-4">
              <form onSubmit={handleSearch} className="search-bar">
                <i className="bi bi-search"></i>
                <input
                  className="form-control"
                  placeholder="Search quotation number, client..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </form>
            </div>
            <div className="col-12 col-md-4 col-lg-3">
              <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Accepted">Accepted</option>
                <option value="Declined">Declined</option>
                <option value="Invoiced">Invoiced</option>
                <option value="Expired">Expired</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
            <div className="col-12 col-md-3 col-lg-5 text-md-end text-muted" style={{ fontSize: '0.82rem' }}>
              Showing {quotations.length} quotation{quotations.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* List Content */}
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="text-muted mt-2">Loading quotations...</p>
          </div>
        ) : quotations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <i className="bi bi-file-earmark-text"></i>
            </div>
            <h5>No quotations found</h5>
            <p>
              {search || status
                ? 'No quotations match your search filters. Try clearing the filters.'
                : 'Create your first proposal/quotation to send to potential clients.'}
            </p>
            {search || status ? (
              <button
                className="btn btn-inf-outline btn-sm"
                onClick={() => {
                  setSearch('')
                  setStatus('')
                }}
              >
                Clear Filters
              </button>
            ) : (
              <button className="btn btn-inf" onClick={() => navigate('/quotations/create')}>
                <i className="bi bi-plus-lg"></i>
                <span>Create Quotation</span>
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="inf-table">
              <thead>
                <tr>
                  <th>Quotation No</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th>Valid Until</th>
                  <th className="text-end">Total Amount</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <Link to={`/quotations/${q.id}`} className="fw-bold text-primary">
                        {q.quotation_number}
                      </Link>
                    </td>
                    <td>
                      <div className="fw-semibold">{q.client_name || '—'}</div>
                    </td>
                    <td className="text-muted">{formatDate(q.date_created)}</td>
                    <td className="text-muted">{formatDate(q.valid_until)}</td>
                    <td className="text-end fw-bold">{formatINR(q.total_amount)}</td>
                    <td>
                      <span
                        className={`badge-status badge-${
                          q.is_archived
                            ? 'archived'
                            : q.status === 'Accepted' || q.status === 'Invoiced'
                            ? 'paid'
                            : q.status === 'Sent'
                            ? 'partial'
                            : q.status === 'Declined' || q.status === 'Expired'
                            ? 'overdue'
                            : 'draft'
                        }`}
                      >
                        {q.is_archived ? 'Archived' : q.status}
                      </span>
                    </td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-1">
                        <Link
                          to={`/quotations/${q.id}`}
                          className="btn btn-sm btn-inf-outline py-1 px-2"
                          title="View"
                        >
                          <i className="bi bi-eye"></i>
                        </Link>
                        <a
                          href={`/api/quotations/${q.id}/pdf`}
                          className="btn btn-sm btn-inf-outline py-1 px-2 text-danger"
                          title="Download PDF"
                          target="_blank"
                          rel="noreferrer"
                        >
                          <i className="bi bi-file-earmark-pdf"></i>
                        </a>
                        <Link
                          to={`/quotations/edit/${q.id}`}
                          className="btn btn-sm btn-inf-outline py-1 px-2"
                          title="Edit"
                        >
                          <i className="bi bi-pencil"></i>
                        </Link>
                        {q.is_archived ? (
                          <button
                            className="btn btn-sm btn-inf-outline py-1 px-2 text-success"
                            onClick={() => unarchive(q.id)}
                            title="Restore"
                          >
                            <i className="bi bi-arrow-counterclockwise"></i>
                          </button>
                        ) : (
                          <button
                            className="btn btn-sm btn-inf-outline py-1 px-2 text-muted"
                            onClick={() => archive(q.id)}
                            title="Archive"
                          >
                            <i className="bi bi-archive"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
