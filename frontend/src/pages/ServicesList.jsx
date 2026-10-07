import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import Layout from '../components/Layout'
import { useToast } from '../context/ToastContext'

const formatINR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
      push(editId ? 'Service updated successfully.' : 'Service added to catalog.', 'success')
      setForm(empty)
      setEditId(null)
      setShowForm(false)
      load()
    } catch (err) {
      push(err.response?.data?.error || 'Failed to save service.', 'danger')
    }
  }

  const edit = (s) => {
    setForm({ name: s.name, description: s.description || '', hsn_code: s.hsn_code || '', base_price: s.base_price })
    setEditId(s.id)
    setShowForm(true)
  }

  const del = async (id) => {
    if (!window.confirm('Are you sure you want to delete this service from the catalog?')) return
    try {
      await api.delete(`/services/${id}`)
      push('Service deleted.', 'success')
      load()
    } catch {
      push('Failed to delete service.', 'danger')
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  return (
    <Layout
      title="Services"
      breadcrumb={
        <>
          <Link to="/">Dashboard</Link>
          <span className="separator">/</span>
          <span className="current">Services Catalog</span>
        </>
      }
    >
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h2 className="mb-1" style={{ fontSize: '1.45rem', fontWeight: 800 }}>Services Catalog</h2>
          <p className="text-muted mb-0" style={{ fontSize: '0.85rem' }}>
            Catalog of products, services, HSN/SAC codes, and standard pricing
          </p>
        </div>
        <button
          className="btn btn-inf btn-sm"
          onClick={() => {
            setShowForm(!showForm)
            setForm(empty)
            setEditId(null)
          }}
        >
          <i className="bi bi-plus-lg"></i>
          <span>{showForm ? 'Close Form' : 'Add Service'}</span>
        </button>
      </div>

      {/* Add / Edit Form Card */}
      {showForm && (
        <div className="inf-card mb-4 animate-in">
          <div className="inf-card-header">
            <h6 className="fw-bold mb-0">{editId ? 'Edit Service' : 'Add New Service to Catalog'}</h6>
            <button type="button" className="btn-close" onClick={() => setShowForm(false)}></button>
          </div>
          <div className="card-body p-4">
            <form onSubmit={save} className="row g-3">
              <div className="col-12 col-md-5">
                <label className="form-label">Service / Product Name *</label>
                <input
                  className="form-control"
                  required
                  placeholder="e.g. Boom Barrier Installation"
                  value={form.name}
                  onChange={set('name')}
                />
              </div>
              <div className="col-12 col-sm-6 col-md-3">
                <label className="form-label">HSN / SAC Code</label>
                <input
                  className="form-control"
                  placeholder="e.g. 998719"
                  value={form.hsn_code}
                  onChange={set('hsn_code')}
                />
              </div>
              <div className="col-12 col-sm-6 col-md-4">
                <label className="form-label">Base Price (₹) *</label>
                <input
                  className="form-control"
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={form.base_price}
                  onChange={set('base_price')}
                />
              </div>
              <div className="col-12">
                <label className="form-label">Description / Specifications</label>
                <textarea
                  className="form-control"
                  rows="2"
                  placeholder="Service details, warranty terms, or material specs..."
                  value={form.description}
                  onChange={set('description')}
                />
              </div>
              <div className="col-12 d-flex gap-2">
                <button type="submit" className="btn btn-inf">
                  <i className="bi bi-check-lg"></i>
                  <span>{editId ? 'Update Service' : 'Save Service'}</span>
                </button>
                <button type="button" className="btn btn-inf-outline" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main List Card */}
      <div className="inf-card animate-in">
        <div className="p-3" style={{ borderBottom: '1px solid var(--inf-border-light)' }}>
          <div className="row g-2 align-items-center">
            <div className="col-12 col-md-5 col-lg-4">
              <form onSubmit={handleSearch} className="search-bar">
                <i className="bi bi-search"></i>
                <input
                  className="form-control"
                  placeholder="Search service name, HSN..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </form>
            </div>
            <div className="col-12 col-md-7 col-lg-8 text-md-end text-muted" style={{ fontSize: '0.82rem' }}>
              Showing {services.length} service{services.length !== 1 ? 's' : ''} in catalog
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="text-muted mt-2">Loading catalog...</p>
          </div>
        ) : services.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <i className="bi bi-box-seam"></i>
            </div>
            <h5>No services in catalog</h5>
            <p>Add services to auto-populate prices and HSN codes when generating quotations and invoices.</p>
            <button
              className="btn btn-inf"
              onClick={() => {
                setShowForm(true)
                setForm(empty)
                setEditId(null)
              }}
            >
              <i className="bi bi-plus-lg"></i>
              <span>Add First Service</span>
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="inf-table">
              <thead>
                <tr>
                  <th>Service / Product</th>
                  <th>HSN / SAC</th>
                  <th>Description</th>
                  <th className="text-end">Base Price</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className="fw-bold">{s.name}</span>
                    </td>
                    <td>
                      {s.hsn_code ? (
                        <span className="badge bg-light text-dark border px-2 py-1" style={{ fontSize: '0.78rem' }}>
                          {s.hsn_code}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <div className="text-muted" style={{ fontSize: '0.82rem', whiteSpace: 'pre-wrap', maxWidth: 360 }}>
                        {s.description || '—'}
                      </div>
                    </td>
                    <td className="text-end fw-bold">{formatINR(s.base_price)}</td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-1">
                        <button
                          className="btn btn-sm btn-inf-outline py-1 px-2"
                          onClick={() => edit(s)}
                          title="Edit"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-inf-outline py-1 px-2 text-danger"
                          onClick={() => del(s.id)}
                          title="Delete"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
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
