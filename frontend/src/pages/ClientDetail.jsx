import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../api/client'
import Layout from '../components/Layout'
import { useToast } from '../context/ToastContext'

const formatINR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const formatDate = (s) => (s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

export default function ClientDetail() {
  const { id } = useParams()
  const { push } = useToast()
  const [client, setClient] = useState(null)

  useEffect(() => { api.get(`/clients/${id}`).then((res) => setClient(res.data)) }, [id])

  const unarchive = async () => {
    await api.post(`/clients/${id}/unarchive`)
    push('Client restored.', 'success')
    const res = await api.get(`/clients/${id}`)
    setClient(res.data)
  }

  if (!client) return <Layout title="Client"><div className="text-center py-5"><div className="spinner-border"></div></div></Layout>

  return (
    <Layout title={client.name} breadcrumb={<><Link to="/">Dashboard</Link><span className="separator">/</span><Link to="/clients">Clients</Link><span className="separator">/</span><span className="current">{client.name}</span></>}>
      <div className="row g-4">
        <div className="col-lg-4">
          <div className="inf-card"><div className="card-body p-4">
            <h6 className="fw-bold mb-3">Client Information</h6>
            {client.company_name && <p className="mb-1 fw-semibold">{client.company_name}</p>}
            <p className="mb-1 small text-muted">{client.email}</p>
            <p className="mb-1 small text-muted">{client.phone}</p>
            <p className="mb-1 small text-muted">{client.address}</p>
            {client.gst_number && <p className="mb-1 small text-muted">GST: {client.gst_number}</p>}
            <hr />
            <p className="mb-1 small">Total Billed: <strong>{formatINR(client.total_billed)}</strong></p>
            <p className="mb-3 small">Outstanding: <strong>{formatINR(client.outstanding)}</strong></p>
            <div className="d-flex gap-2">
              <Link to={`/clients/edit/${client.id}`} className="btn btn-inf-outline btn-sm"><i className="bi bi-pencil me-1"></i>Edit</Link>
              {client.is_archived && <button className="btn btn-inf-outline btn-sm" onClick={unarchive}><i className="bi bi-arrow-counterclockwise me-1"></i>Restore</button>}
            </div>
          </div></div>
        </div>
        <div className="col-lg-8">
          <div className="inf-card"><div className="card-body p-4">
            <h6 className="fw-bold mb-3">Invoices</h6>
            <table className="table mb-0">
              <thead><tr><th>Number</th><th>Date</th><th className="text-end">Amount</th><th>Status</th></tr></thead>
              <tbody>
                {client.invoices.length === 0 && <tr><td colSpan="4" className="text-center text-muted py-3">No invoices.</td></tr>}
                {client.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td><Link to={`/invoices/${inv.id}`} className="fw-semibold text-decoration-none">{inv.invoice_number}</Link></td>
                    <td>{formatDate(inv.date_created)}</td>
                    <td className="text-end">{formatINR(inv.total_amount)}</td>
                    <td><span className={`badge bg-${inv.status === 'Paid' ? 'success' : inv.status === 'Pending' ? 'warning' : 'info'}`}>{inv.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></div>
        </div>
      </div>
    </Layout>
  )
}
