import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'
import Layout from '../components/Layout'
import { invoicePdfHref } from '../lib/pdfHref'

const formatINR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
const formatDate = (s) => (s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/dashboard')
      .then((res) => setData(res.data))
      .catch(() => setError('Failed to load dashboard data.'))
      .finally(() => setLoading(false))
  }, [])

  if (error) {
    return (
      <Layout title="Dashboard">
        <div className="alert alert-danger d-flex align-items-center gap-2">
          <i className="bi bi-exclamation-octagon-fill"></i>
          <div>{error}</div>
        </div>
      </Layout>
    )
  }

  if (loading || !data) {
    return (
      <Layout title="Dashboard">
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="text-muted mt-2">Loading financial metrics...</p>
        </div>
      </Layout>
    )
  }

  const primaryStats = [
    {
      label: 'Total Revenue',
      value: formatINR(data.total_revenue),
      icon: 'bi-graph-up-arrow',
      color: 'var(--inf-primary)',
      bg: 'var(--inf-primary-subtle)',
      desc: 'Billed amount',
    },
    {
      label: 'Collected Amount',
      value: formatINR(data.paid_revenue),
      icon: 'bi-check2-circle',
      color: 'var(--inf-success)',
      bg: 'var(--inf-success-subtle)',
      desc: 'Received in bank/cash',
    },
    {
      label: 'Pending Balance',
      value: formatINR(data.pending_revenue),
      icon: 'bi-clock-history',
      color: 'var(--inf-warning)',
      bg: 'var(--inf-warning-subtle)',
      desc: 'Awaiting clearance',
    },
    {
      label: 'Overdue Invoices',
      value: data.overdue_count,
      icon: 'bi-exclamation-triangle-fill',
      color: 'var(--inf-danger)',
      bg: 'var(--inf-danger-subtle)',
      desc: `${data.pending_count || 0} pending total`,
    },
  ]

  const secondaryStats = [
    { label: 'Invoices', value: data.total_invoices, icon: 'bi-receipt', link: '/invoices' },
    { label: 'Quotations', value: data.total_quotations, icon: 'bi-file-earmark-text', link: '/quotations' },
    { label: 'Clients', value: data.total_clients, icon: 'bi-people', link: '/clients' },
    { label: 'Services', value: data.total_services, icon: 'bi-box-seam', link: '/services' },
  ]

  return (
    <Layout title="Dashboard">
      {/* Hero Welcome Banner */}
      <div className="dashboard-hero animate-in">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h2>ATS Automation Overview</h2>
            <p>Gate Automation &amp; Security Solutions · Quotation &amp; Invoice Center</p>
          </div>
          <div className="d-flex gap-2">
            <Link to="/invoices/create" className="btn btn-inf btn-sm">
              <i className="bi bi-receipt-cutoff"></i>
              <span>Create Invoice</span>
            </Link>
            <Link to="/quotations/create" className="btn btn-inf-outline btn-sm">
              <i className="bi bi-file-earmark-text"></i>
              <span>New Quotation</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Primary Financial Metric Cards */}
      <div className="row g-3 mb-4">
        {primaryStats.map((stat, i) => (
          <div className="col-12 col-sm-6 col-xl-3 animate-in" key={stat.label} style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="stat-card h-100">
              <div className="stat-icon" style={{ background: stat.bg, color: stat.color }}>
                <i className={`bi ${stat.icon}`}></i>
              </div>
              <div className="stat-info">
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
                <div className="text-muted" style={{ fontSize: '0.72rem', marginTop: '2px' }}>{stat.desc}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary Quick Counts Bar */}
      <div className="row g-3 mb-4">
        {secondaryStats.map((item) => (
          <div className="col-6 col-md-3" key={item.label}>
            <Link to={item.link} style={{ textDecoration: 'none' }}>
              <div className="inf-card p-3 d-flex align-items-center justify-content-between" style={{ cursor: 'pointer' }}>
                <div className="d-flex align-items-center gap-2">
                  <i className={`bi ${item.icon} text-primary`} style={{ fontSize: '1.2rem' }}></i>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--inf-text)' }}>{item.label}</span>
                </div>
                <span className="badge bg-secondary rounded-pill px-2 py-1" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                  {item.value}
                </span>
              </div>
            </Link>
          </div>
        ))}
      </div>

      {/* Recent Invoices Table */}
      <div className="inf-card animate-in">
        <div className="inf-card-header">
          <div>
            <h5 className="fw-bold mb-0" style={{ fontSize: '1.05rem' }}>Recent Invoices</h5>
            <small className="text-muted">Latest billing records generated</small>
          </div>
          <div className="d-flex gap-2">
            <Link to="/invoices" className="btn btn-inf-outline btn-sm">
              <span>View All</span>
              <i className="bi bi-arrow-right"></i>
            </Link>
          </div>
        </div>

        <div className="card-body p-0">
          {data.recent_invoices && data.recent_invoices.length > 0 ? (
            <div className="table-responsive">
              <table className="inf-table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Client</th>
                    <th>Date</th>
                    <th className="text-end">Amount</th>
                    <th className="text-end">Balance Due</th>
                    <th>Status</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_invoices.map((inv) => (
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
                      <td className="text-end fw-bold">{formatINR(inv.total_amount)}</td>
                      <td className="text-end">
                        {inv.balance_due > 0 ? (
                          <span className="text-danger fw-semibold">{formatINR(inv.balance_due)}</span>
                        ) : (
                          <span className="text-success fw-semibold">₹0</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge-status badge-${inv.status === 'Paid' ? 'paid' : inv.status === 'Pending' ? 'pending' : inv.status === 'Partially Paid' ? 'partial' : 'overdue'}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="text-end">
                        <div className="d-inline-flex gap-1">
                          <Link to={`/invoices/${inv.id}`} className="btn btn-sm btn-inf-outline py-1 px-2" title="View Details">
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">
                <i className="bi bi-receipt"></i>
              </div>
              <h5>No invoices generated yet</h5>
              <p>Create your first invoice to start billing clients with automated GST calculation and branded PDF invoices.</p>
              <Link to="/invoices/create" className="btn btn-inf">
                <i className="bi bi-plus-lg"></i>
                <span>Create First Invoice</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
