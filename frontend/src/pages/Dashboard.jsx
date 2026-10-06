import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import Layout from '../components/Layout'

const formatINR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

const iconBox = (bg, color) => ({
  width: 48, height: 48, borderRadius: 14, display: 'flex',
  alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem',
  background: bg, color, flexShrink: 0,
})

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/dashboard').then((res) => setData(res.data)).catch(() => setError('Failed to load dashboard.'))
  }, [])

  if (error) return <Layout title="Dashboard"><div className="alert alert-danger">{error}</div></Layout>
  if (!data) return <Layout title="Dashboard"><div className="text-center py-5"><div className="spinner-border"></div></div></Layout>

  const stats = [
    { icon: 'bi-receipt', bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', value: data.total_invoices, label: 'Total Invoices' },
    { icon: 'bi-currency-rupee', bg: 'rgba(34,197,94,0.12)', color: '#16a34a', value: formatINR(data.paid_revenue), label: 'Collected Revenue' },
    { icon: 'bi-clock', bg: 'rgba(234,179,8,0.15)', color: '#ca8a04', value: formatINR(data.pending_revenue), label: 'Pending Amount' },
    { icon: 'bi-exclamation-circle', bg: 'rgba(239,68,68,0.12)', color: '#dc2626', value: data.overdue_count, label: 'Overdue' },
    { icon: 'bi-people-fill', bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', value: data.total_clients, label: 'Clients' },
    { icon: 'bi-box-seam-fill', bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6', value: data.total_services, label: 'Services' },
    { icon: 'bi-file-earmark-text-fill', bg: 'rgba(236,72,153,0.12)', color: '#ec4899', value: data.total_quotations, label: 'Quotations' },
    { icon: 'bi-graph-up-arrow', bg: 'rgba(34,197,94,0.12)', color: '#16a34a', value: formatINR(data.total_revenue), label: 'Total Revenue' },
  ]

  return (
    <Layout title="Dashboard">
      {/* Metric Cards — 4x2 grid */}
      <div className="row g-3 mb-4">
        {stats.map((s) => (
          <div className="col-6 col-xl-3 animate-in" key={s.label}>
            <div className="inf-card" style={{ borderRadius: 14, boxShadow: 'var(--inf-shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
              <div className="card-body d-flex align-items-center gap-3 p-3">
                <div style={iconBox(s.bg, s.color)}><i className={`bi ${s.icon}`}></i></div>
                <div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, lineHeight: 1.2 }}>{s.value}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--inf-text-muted)', fontWeight: 500 }}>{s.label}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Invoices */}
      <div className="inf-card animate-in">
        <div className="card-body p-4">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h6 className="fw-bold mb-0" style={{ fontSize: '1.1rem' }}>Recent Invoices</h6>
            <Link to="/invoices" className="btn btn-inf-outline btn-sm">View All</Link>
          </div>
          <div
            className="d-flex align-items-center justify-content-center"
            style={{ minHeight: 320, background: 'var(--inf-card, #fff)', borderRadius: 12 }}
          >
            <i
              className="bi bi-file-earmark-text"
              style={{ fontSize: '5rem', color: 'var(--inf-border, #e2e8f0)' }}
            ></i>
          </div>
        </div>
      </div>
    </Layout>
  )
}
