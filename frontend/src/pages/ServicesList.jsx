import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import Layout from '../components/Layout'
import { useToast } from '../context/ToastContext'

const empty = { name: '', description: '', hsn_code: '', base_price: '' }

export default function ServicesList() {
  const [services, setServices] = useState([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const { push } = useToast()

  const load = () => {
    setLoading(true)
    api.get('/services/', { params: { q: search } })
      .then((res) => setServices(res.data.services))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleSearch = (e) => { e.preventDefault(); load() }

  const save = async (e) => {
    e.preventDefault()
    const payload = { ...form, base_price: parseFloat(form.base_price) || 0 }
    try {
      if (editId) await api.put(`/services/${editId}`, payload)
      else await api.post('/services/', payload)
      push(editId ? 'Service updated.' : 'Service added.', 'success')
      setForm(empty); setEditId(null); setShowForm(false)
      load()
    } catch (err) {
      push(err.response?.data?.error || 'Failed to save.', 'danger')
    }
  }

  const edit = (s) => { setForm({ name: s.name, description: s.description, hsn_code: s.hsn_code, base_price: s.base_price }); setEditId(s.id); setShowForm(true) }

  const del = async (id) => {
    if (!window.confirm('Delete this service?')) return
    await api.delete(`/services/${id}`)
    push('Service deleted.', 'success')
    load()
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  return (
    <Layout>
      {/* Breadcrumbs + Title + Description + Action */}
      <div className="mb-4">
        <nav style={{ fontSize: '0.8rem', color: 'var(--inf-text-muted)', fontWeight: 600 }} className="mb-2">
          <Link to="/" style={{ color: 'var(--inf-primary)', textDecoration: 'none' }}>Dashboard</Link>
          <span className="mx-1">/</span>
          <span>Services</span>
        </nav>
        <div className="d-flex flex-wrap align-items-end justify-content-between gap-3">
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>Services</h1>
            <p className="text-muted mb-0" style={{ fontSize: '0.9rem', fontWeight: 500 }}>Manage your service offerings, HSN codes, and pricing</p>
          </div>
          <button className="btn btn-inf btn-sm" onClick={() => { setShowForm(!showForm); setForm(empty); setEditId(null) }}>
            <i className="bi bi-plus-lg me-1"></i>Add Service
          </button>
        </div>
      </div>

      {showForm && (
        <div className="inf-card mb-3"><div className="card-body p-4">
          <h6 className="fw-bold mb-3">{editId ? 'Edit Service' : 'New Service'}</h6>
          <form onSubmit={save} className="row g-3">
            <div className="col-md-4"><label className="form-label">Name *</label><input className="form-control" required value={form.name} onChange={set('name')} /></div>
            <div className="col-md-2"><label className="form-label">HSN Code</label><input className="form-control" value={form.hsn_code} onChange={set('hsn_code')} /></div>
            <div className="col-md-3"><label className="form-label">Base Price (₹)</label><input className="form-control" type="number" step="0.01" value={form.base_price} onChange={set('base_price')} /></div>
            <div className="col-md-3 d-flex align-items-end gap-2">
              <button className="btn btn-inf">{editId ? 'Update' : 'Add'}</button>
              <button type="button" className="btn btn-inf-outline" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
            <div className="col-12"><label className="form-label">Description</label><input className="form-control" value={form.description} onChange={set('description')} /></div>
          </form>
        </div></div>
      )}

      {/* Main white card */}
      <div className="inf-card">
        <div className="card-body p-0">
          {/* Search bar */}
          <div className="p-3" style={{ borderBottom: '1px solid var(--inf-border)' }}>
            <form onSubmit={handleSearch} className="search-bar" style={{ width: 300, flex: '0 1 320px' }}>
              <i className="bi bi-search"></i>
              <input
                className="form-control"
                placeholder="Search services..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </form>
          </div>

          {/* Content */}
          {loading ? (
            <div className="text-center py-5"><div className="spinner-border"></div></div>
          ) : services.length === 0 ? (
            <div className="d-flex flex-column align-items-center justify-content-center text-center" style={{ minHeight: 380, padding: '3rem 1rem' }}>
              <div
                className="d-flex align-items-center justify-content-center"
                style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: 'var(--inf-bg)', color: 'var(--inf-text-muted)',
                  fontSize: '2rem', marginBottom: '1rem',
                }}
              >
                <i className="bi bi-box"></i>
              </div>
              <h6 className="fw-bold mb-1" style={{ fontSize: '1.05rem' }}>No services yet</h6>
              <p className="text-muted mb-0" style={{ fontSize: '0.9rem', maxWidth: 420 }}>
                Add services to your catalog to use them in invoices and quotations.
              </p>
            </div>
          ) : (
            <div className="table-responsive p-3">
              <table className="table mb-0">
                <thead><tr><th>Name</th><th>HSN</th><th>Description</th><th className="text-end">Base Price</th><th></th></tr></thead>
                <tbody>
                  {services.map((s) => (
                    <tr key={s.id}>
                      <td className="fw-semibold">{s.name}</td>
                      <td>{s.hsn_code || '—'}</td>
                      <td className="small text-muted">{s.description || '—'}</td>
                      <td className="text-end">₹{Number(s.base_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="text-end">
                        <button className="btn btn-inf-outline btn-sm me-1" onClick={() => edit(s)}><i className="bi bi-pencil"></i></button>
                        <button className="btn btn-inf-outline btn-sm text-danger" onClick={() => del(s.id)}><i className="bi bi-trash"></i></button>
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
