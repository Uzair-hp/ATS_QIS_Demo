import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../api/client'
import Layout from '../components/Layout'
import { useToast } from '../context/ToastContext'

const empty = { name: '', company_name: '', email: '', phone: '', address: '', gst_number: '' }

export default function ClientForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { push } = useToast()
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')

  useEffect(() => {
    if (id) api.get(`/clients/${id}`).then((res) => setForm({ ...empty, ...res.data }))
  }, [id])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      if (id) {
        await api.put(`/clients/${id}`, form)
        push('Client updated.', 'success')
      } else {
        await api.post('/clients/', form)
        push('Client added.', 'success')
      }
      navigate('/clients')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save client.')
    }
  }

  return (
    <Layout title={id ? 'Edit Client' : 'Add Client'} breadcrumb={<><Link to="/">Dashboard</Link><span className="separator">/</span><Link to="/clients">Clients</Link><span className="separator">/</span><span className="current">{id ? 'Edit' : 'Add'}</span></>}>
      <div className="inf-card"><div className="card-body p-4">
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="row g-3">
            <div className="col-md-6"><label className="form-label">Name *</label><input className="form-control" required value={form.name} onChange={set('name')} /></div>
            <div className="col-md-6"><label className="form-label">Company Name</label><input className="form-control" value={form.company_name || ''} onChange={set('company_name')} /></div>
            <div className="col-md-6"><label className="form-label">Email</label><input className="form-control" type="email" value={form.email || ''} onChange={set('email')} /></div>
            <div className="col-md-6"><label className="form-label">Phone</label><input className="form-control" value={form.phone || ''} onChange={set('phone')} /></div>
            <div className="col-md-6"><label className="form-label">GST Number</label><input className="form-control" value={form.gst_number || ''} onChange={set('gst_number')} /></div>
            <div className="col-12"><label className="form-label">Address</label><textarea className="form-control" rows="3" value={form.address || ''} onChange={set('address')} /></div>
          </div>
          <div className="mt-4 d-flex gap-2">
            <button className="btn btn-inf">{id ? 'Update Client' : 'Add Client'}</button>
            <Link to="/clients" className="btn btn-inf-outline">Cancel</Link>
          </div>
        </form>
      </div></div>
    </Layout>
  )
}
