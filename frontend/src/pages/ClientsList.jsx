import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'
import Layout from '../components/Layout'
import { useToast } from '../context/ToastContext'

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
    await api.post(`/clients/${id}/archive`)
    push('Client archived.', 'success')
    load()
  }

  const unarchive = async (id) => {
    await api.post(`/clients/${id}/unarchive`)
    push('Client restored.', 'success')
    load()
  }

  return (
    <Layout>
      {/* Breadcrumbs + Title + Description + Actions */}
      <div className="mb-4">
        <nav style={{ fontSize: '0.8rem', color: 'var(--inf-text-muted)', fontWeight: 600 }} className="mb-2">
          <Link to="/" style={{ color: 'var(--inf-primary)', textDecoration: 'none' }}>Dashboard</Link>
          <span className="mx-1">/</span>
          <span>Clients</span>
        </nav>
        <div className="d-flex flex-wrap align-items-end justify-content-between gap-3">
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>Clients</h1>
            <p className="text-muted mb-0" style={{ fontSize: '0.9rem', fontWeight: 500 }}>Manage your client database</p>
          </div>
          <div className="d-flex gap-2">
            <a
              className="btn btn-inf-outline btn-sm bg-white"
              href={`/api/clients/export?q=${encodeURIComponent(search)}&archived=${filter === 'archived' ? '1' : ''}`}
            >
              <i className="bi bi-download me-1"></i>Export
            </a>
            <button className="btn btn-inf btn-sm" onClick={() => navigate('/clients/add')}>
              <i className="bi bi-plus-lg me-1"></i>Add Client
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
                placeholder="Search clients..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </form>
            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="active">Active Clients</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Content */}
          {loading ? (
            <div className="text-center py-5"><div className="spinner-border"></div></div>
          ) : clients.length === 0 ? (
            <div className="d-flex flex-column align-items-center justify-content-center text-center" style={{ minHeight: 380, padding: '3rem 1rem' }}>
              <div
                className="d-flex align-items-center justify-content-center"
                style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: 'var(--inf-bg)', color: 'var(--inf-text-muted)',
                  fontSize: '2rem', marginBottom: '1rem',
                }}
              >
                <i className="bi bi-people"></i>
              </div>
              <h6 className="fw-bold mb-1" style={{ fontSize: '1.05rem' }}>No clients yet</h6>
              <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>Add your first client to start creating invoices.</p>
            </div>
          ) : (
            <div className="table-responsive p-3">
              <table className="table mb-0">
                <thead>
                  <tr><th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th className="text-end">Total Billed</th><th className="text-end">Outstanding</th><th></th></tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id}>
                      <td><Link to={`/clients/${c.id}`} className="fw-semibold text-decoration-none">{c.name}</Link></td>
                      <td>{c.company_name || '—'}</td>
                      <td>{c.email || '—'}</td>
                      <td>{c.phone || '—'}</td>
                      <td className="text-end">₹{Number(c.total_billed || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="text-end">₹{Number(c.outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="text-end">
                        <Link to={`/clients/edit/${c.id}`} className="btn btn-inf-outline btn-sm me-1"><i className="bi bi-pencil"></i></Link>
                        {c.is_archived
                          ? <button className="btn btn-inf-outline btn-sm" onClick={() => unarchive(c.id)}><i className="bi bi-arrow-counterclockwise"></i></button>
                          : <button className="btn btn-inf-outline btn-sm" onClick={() => archive(c.id)}><i className="bi bi-archive"></i></button>}
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
