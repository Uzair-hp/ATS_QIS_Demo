import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'
import Layout from '../components/Layout'
import { useToast } from '../context/ToastContext'

const formatINR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ClientsList() {
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('active') // 'active' | 'archived'
  const [loading, setLoading] = useState(true)
  const { push } = useToast()
  const navigate = useNavigate()

  const load = () => {
    setLoading(true)
    api.get('/clients/', { params: { q: search, archived: filter === 'archived' ? '1' : '' } })
      .then((res) => setClients(res.data.clients))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  const handleSearch = (e) => { e.preventDefault(); load() }

  const archive = async (id) => {
    try {
      await api.post(`/clients/${id}/archive`)
      push('Client archived.', 'success')
      load()
    } catch {
      push('Failed to archive client.', 'danger')
    }
  }

  const unarchive = async (id) => {
    try {
      await api.post(`/clients/${id}/unarchive`)
      push('Client restored.', 'success')
      load()
    } catch {
      push('Failed to restore client.', 'danger')
    }
  }

  return (
    <Layout
      title="Clients"
      breadcrumb={
        <>
          <Link to="/">Dashboard</Link>
          <span className="separator">/</span>
          <span className="current">Clients</span>
        </>
      }
    >
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h2 className="mb-1" style={{ fontSize: '1.45rem', fontWeight: 800 }}>Clients</h2>
          <p className="text-muted mb-0" style={{ fontSize: '0.85rem' }}>
            Manage client directory, GST numbers, contact info, and billing balance
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <a
            className="btn btn-inf-outline btn-sm"
            href={`/api/clients/export?q=${encodeURIComponent(search)}&archived=${filter === 'archived' ? '1' : ''}`}
          >
            <i className="bi bi-download"></i>
            <span>Export CSV</span>
          </a>
          <button className="btn btn-inf btn-sm" onClick={() => navigate('/clients/add')}>
            <i className="bi bi-person-plus"></i>
            <span>Add Client</span>
          </button>
        </div>
      </div>

      <div className="inf-card animate-in">
        <div className="p-3" style={{ borderBottom: '1px solid var(--inf-border-light)' }}>
          <div className="row g-2 align-items-center">
            <div className="col-12 col-md-5 col-lg-4">
              <form onSubmit={handleSearch} className="search-bar">
                <i className="bi bi-search"></i>
                <input
                  className="form-control"
                  placeholder="Search client name, company, GST..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </form>
            </div>
            <div className="col-12 col-md-4 col-lg-3">
              <select
                className="form-select"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="active">Active Clients</option>
                <option value="archived">Archived Clients</option>
              </select>
            </div>
            <div className="col-12 col-md-3 col-lg-5 text-md-end text-muted" style={{ fontSize: '0.82rem' }}>
              Showing {clients.length} client{clients.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="text-muted mt-2">Loading client directory...</p>
          </div>
        ) : clients.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <i className="bi bi-people"></i>
            </div>
            <h5>No clients found</h5>
            <p>
              {search
                ? 'No clients found matching your query.'
                : 'Add clients to start generating customized quotations and tax invoices.'}
            </p>
            {!search && (
              <button className="btn btn-inf" onClick={() => navigate('/clients/add')}>
                <i className="bi bi-person-plus"></i>
                <span>Add First Client</span>
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="inf-table">
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Company</th>
                  <th>Phone / Email</th>
                  <th>GST Number</th>
                  <th className="text-end">Total Billed</th>
                  <th className="text-end">Outstanding</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/clients/${c.id}`} className="fw-bold text-primary">
                        {c.name}
                      </Link>
                    </td>
                    <td>
                      <div className="fw-semibold">{c.company_name || '—'}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>{c.phone || '—'}</div>
                      {c.email && <div className="text-muted" style={{ fontSize: '0.78rem' }}>{c.email}</div>}
                    </td>
                    <td>
                      {c.gst_number ? (
                        <span className="badge bg-light text-dark border px-2 py-1" style={{ fontSize: '0.78rem' }}>
                          {c.gst_number}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="text-end fw-bold">{formatINR(c.total_billed)}</td>
                    <td className="text-end">
                      {c.outstanding > 0 ? (
                        <span className="text-danger fw-bold">{formatINR(c.outstanding)}</span>
                      ) : (
                        <span className="text-success fw-semibold">₹0.00</span>
                      )}
                    </td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-1">
                        <Link to={`/clients/${c.id}`} className="btn btn-sm btn-inf-outline py-1 px-2" title="View Profile">
                          <i className="bi bi-eye"></i>
                        </Link>
                        <Link to={`/clients/edit/${c.id}`} className="btn btn-sm btn-inf-outline py-1 px-2" title="Edit">
                          <i className="bi bi-pencil"></i>
                        </Link>
                        {c.is_archived ? (
                          <button
                            className="btn btn-sm btn-inf-outline py-1 px-2 text-success"
                            onClick={() => unarchive(c.id)}
                            title="Restore"
                          >
                            <i className="bi bi-arrow-counterclockwise"></i>
                          </button>
                        ) : (
                          <button
                            className="btn btn-sm btn-inf-outline py-1 px-2 text-muted"
                            onClick={() => archive(c.id)}
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
