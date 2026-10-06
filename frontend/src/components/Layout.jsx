import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../logo.png'

const navClass = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`

export default function Layout({ title, breadcrumb, children }) {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const toggleSidebar = () => {
    const el = document.getElementById('sidebar')
    const overlay = document.getElementById('sidebarOverlay')
    if (el) el.classList.toggle('open')
    if (overlay) overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none'
  }

  const toggleTheme = () => {
    const current = document.documentElement.getAttribute('data-theme')
    const next = current === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('inf-theme', next)
    const icon = document.querySelector('#themeToggle i')
    if (icon) icon.className = next === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill'
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <>
      <nav className="sidebar" id="sidebar">
        <div className="sidebar-brand">
          <img src={logo} alt="ATS Automation" />
          <div className="brand-text">
            <h6>ATS Automation</h6>
            <small>Security &amp; Systems</small>
          </div>
        </div>
        <div className="sidebar-nav">
          <div className="nav-section"><span className="nav-text">Overview</span></div>
          <NavLink to="/" end className={navClass}>
            <i className="bi bi-grid-1x2-fill"></i> <span className="nav-text">Dashboard</span>
          </NavLink>

          <div className="nav-section"><span className="nav-text">Manage</span></div>
          <NavLink to="/clients" className={navClass}>
            <i className="bi bi-people-fill"></i> <span className="nav-text">Clients</span>
          </NavLink>
          <NavLink to="/services" className={navClass}>
            <i className="bi bi-box-seam-fill"></i> <span className="nav-text">Services</span>
          </NavLink>

          <div className="nav-section"><span className="nav-text">Billing &amp; Proposals</span></div>
          <NavLink to="/quotations" end className={navClass}>
            <i className="bi bi-file-earmark-text-fill"></i> <span className="nav-text">Quotations</span>
          </NavLink>
          <NavLink to="/quotations/create" className={navClass}>
            <i className="bi bi-plus-square-fill"></i> <span className="nav-text">New Quotation</span>
          </NavLink>
          <NavLink to="/invoices" end className={navClass}>
            <i className="bi bi-receipt"></i> <span className="nav-text">Invoices</span>
          </NavLink>
          <NavLink to="/invoices/create" className={navClass}>
            <i className="bi bi-plus-circle-fill"></i> <span className="nav-text">New Invoice</span>
          </NavLink>

          <div className="nav-section"><span className="nav-text">System</span></div>
          <NavLink to="/settings" className={navClass}>
            <i className="bi bi-gear-fill"></i> <span className="nav-text">Settings</span>
          </NavLink>
        </div>
      </nav>

      <div id="sidebarOverlay" onClick={toggleSidebar} style={{ display: 'none', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1045 }}></div>

      <div className="main-content">
        <div className="topbar">
          <div className="d-flex align-items-center gap-2">
            <button className="btn-sidebar-toggle" onClick={toggleSidebar}><i className="bi bi-list"></i></button>
            {title && <h1 className="page-title">{title}</h1>}
          </div>
          <div className="topbar-right">
            <span className="topbar-date"><i className="bi bi-calendar3 me-1"></i>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            <button type="button" className="theme-toggle" id="themeToggle" onClick={toggleTheme}>
              <i className="bi bi-moon-fill"></i>
            </button>
            <div className="dropdown no-print d-inline-block">
              <button className="btn btn-inf btn-sm btn-topbar-new" type="button" id="newDropdown" data-bs-toggle="dropdown" aria-expanded="false">
                <i className="bi bi-plus-lg"></i><span className="d-none d-sm-inline ms-1">New</span>
              </button>
              <ul className="dropdown-menu dropdown-menu-end shadow-md border-0" style={{ borderRadius: 12, marginTop: 8, minWidth: 180 }}>
                <li><Link className="dropdown-item d-flex align-items-center gap-2 py-2" to="/invoices/create">
                  <i className="bi bi-receipt-cutoff" style={{ color: 'var(--inf-primary)', fontSize: '1.05rem' }}></i>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>New Invoice</span>
                </Link></li>
                <li><Link className="dropdown-item d-flex align-items-center gap-2 py-2" to="/quotations/create">
                  <i className="bi bi-file-earmark-text" style={{ color: 'var(--inf-success)', fontSize: '1.05rem' }}></i>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>New Quotation</span>
                </Link></li>
              </ul>
            </div>
            <button onClick={handleLogout} className="btn btn-inf-outline btn-sm no-print ms-2 text-danger border-danger btn-topbar-logout" title="Logout">
              <i className="bi bi-box-arrow-right"></i>
            </button>
          </div>
        </div>

        {breadcrumb && <div className="breadcrumb-bar">{breadcrumb}</div>}

        <div className="page-body">{children}</div>
      </div>
    </>
  )
}
