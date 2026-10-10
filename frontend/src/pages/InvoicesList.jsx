import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'
import Layout from '../components/Layout'
import { invoicePdfHref } from '../lib/pdfHref'
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

  const archive = async (id) => {
    try {
      await api.post(`/invoices/${id}/archive`)
      push('Invoice archived.', 'success')
      load()
    } catch {
      push('Failed to archive invoice.', 'danger')
    }
  }

  const unarchive = async (id) => {
    try {
      await api.post(`/invoices/${id}/unarchive`)
      push('Invoice restored.', 'success')
      load()
    } catch {
      push('Failed to restore invoice.', 'danger')
    }
  }

  return (
    <Layout
      title="Invoices"
      breadcrumb={
        <>
          <Link to="/">Dashboard</Link>
          <span className="separator">/</span>
          <span className="current">Invoices</span>
        </>
      }
    >
      {/* Header bar with actions */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h2 className="mb-1" style={{ fontSize: '1.45rem', fontWeight: 800 }}>Invoices</h2>
          <p className="text-muted mb-0" style={{ fontSize: '0.85rem' }}>
            Manage client billing, payment balances, and GST invoices
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <a
            className="btn btn-inf-outline btn-sm"
            href={`/api/invoices/export?q=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`}
          >
            <i className="bi bi-download"></i>
            <span>Export CSV</span>
          </a>
          <button className="btn btn-inf btn-sm" onClick={() => navigate('/invoices/create')}>
            <i className="bi bi-plus-lg"></i>
            <span>New Invoice</span>
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
                  placeholder="Search invoice number, client..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </form>
            </div>
            <div className="col-12 col-md-4 col-lg-3">
              <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Paid">Paid</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
            <div className="col-12 col-md-3 col-lg-5 text-md-end text-muted" style={{ fontSize: '0.82rem' }}>
              Showing {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* List Content */}
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="text-muted mt-2">Loading invoices...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <i className="bi bi-receipt"></i>
            </div>
            <h5>No invoices found</h5>
            <p>
              {search || status
                ? 'No invoices match your search filters. Try clearing the filters.'
                : 'Get started by creating your first invoice for a client.'}
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
              <button className="btn btn-inf" onClick={() => navigate('/invoices/create')}>
                <i className="bi bi-plus-lg"></i>
                <span>Create Invoice</span>
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="inf-table">
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th>Due Date</th>
                  <th className="text-end">Total Amount</th>
                  <th className="text-end">Balance Due</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <Link to={`/invoices/${inv.id}`} className="fw-bold text-primary">
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td>
                      <div className="fw-semibold">{inv.client_name || '—'}</div>
                    </td>
                    <td className="text-muted">{formatDate(inv.date_created)}</td>
                    <td className="text-muted">{formatDate(inv.due_date)}</td>
                    <td className="text-end fw-bold">{formatINR(inv.total_amount)}</td>
                    <td className="text-end">
                      {inv.balance_due > 0 ? (
                        <span className="text-danger fw-semibold">{formatINR(inv.balance_due)}</span>
                      ) : (
                        <span className="text-success fw-semibold">₹0.00</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge-status badge-${
                          inv.is_archived
                            ? 'archived'
                            : inv.status === 'Paid'
                            ? 'paid'
                            : inv.status === 'Pending'
                            ? 'pending'
                            : inv.status === 'Partially Paid'
                            ? 'partial'
                            : 'overdue'
                        }`}
                      >
                        {inv.is_archived ? 'Archived' : inv.status}
                      </span>
                    </td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-1">
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="btn btn-sm btn-inf-outline py-1 px-2"
                          title="View"
                        >
                          <i className="bi bi-eye"></i>
                        </Link>
                        <a
                          href={invoicePdfHref(inv)}
                          className="btn btn-sm btn-inf-outline py-1 px-2 text-danger"
                          title="Download PDF"
                          target="_blank"
                          rel="noreferrer"
                        >
                          <i className="bi bi-file-earmark-pdf"></i>
                        </a>
                        <Link
                          to={`/invoices/edit/${inv.id}`}
                          className="btn btn-sm btn-inf-outline py-1 px-2"
                          title="Edit"
                        >
                          <i className="bi bi-pencil"></i>
                        </Link>
                        {inv.is_archived ? (
                          <button
                            className="btn btn-sm btn-inf-outline py-1 px-2 text-success"
                            onClick={() => unarchive(inv.id)}
                            title="Restore"
                          >
                            <i className="bi bi-arrow-counterclockwise"></i>
                          </button>
                        ) : (
                          <button
                            className="btn btn-sm btn-inf-outline py-1 px-2 text-muted"
                            onClick={() => archive(inv.id)}
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
