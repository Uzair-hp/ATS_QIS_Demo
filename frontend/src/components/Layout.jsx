import { useState, useEffect } from 'react'
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ProfileMenuProvider } from '../context/ProfileMenuContext'
import ProfileMenu from './ProfileMenu'
import logo from '../logo.png'

const navClass = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`

export default function Layout({ title, breadcrumb, children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('inf-theme') || 'light')

  // Auto close mobile drawer on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('inf-theme', next)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <ProfileMenuProvider>
      {/* Mobile Backdrop Overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`}
        onClick={() => setSidebarOpen(false)}
        style={{
          display: sidebarOpen ? 'block' : 'none',
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 1045,
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Sidebar Navigation */}
      <nav className={`sidebar ${sidebarOpen ? 'open' : ''}`} id="sidebar">
        <div className="sidebar-brand">
          <img src={logo} alt="ATS Automation" />
          <div className="brand-text">
            <h6>ATS Automation</h6>
            <small>Security & Systems</small>
          </div>
        </div>

        <div className="sidebar-nav">
          <div className="nav-section">Overview</div>
          <NavLink to="/" end className={navClass}>
            <i className="bi bi-grid-1x2-fill"></i>
            <span className="nav-text">Dashboard</span>
          </NavLink>

          <div className="nav-section">Billing &amp; Proposals</div>
          <NavLink to="/invoices" end className={navClass}>
            <i className="bi bi-receipt"></i>
            <span className="nav-text">Invoices</span>
          </NavLink>
          <NavLink to="/invoices/create" className={navClass}>
            <i className="bi bi-plus-circle-fill"></i>
            <span className="nav-text">Create Invoice</span>
          </NavLink>
          <NavLink to="/quotations" end className={navClass}>
            <i className="bi bi-file-earmark-text-fill"></i>
            <span className="nav-text">Quotations</span>
          </NavLink>
          <NavLink to="/quotations/create" className={navClass}>
            <i className="bi bi-plus-square-fill"></i>
            <span className="nav-text">Create Quotation</span>
          </NavLink>

          <div className="nav-section">Management</div>
          <NavLink to="/clients" className={navClass}>
            <i className="bi bi-people-fill"></i>
            <span className="nav-text">Clients</span>
          </NavLink>
          <NavLink to="/services" className={navClass}>
            <i className="bi bi-box-seam-fill"></i>
            <span className="nav-text">Services Catalog</span>
          </NavLink>

          <div className="nav-section">System</div>
          <NavLink to="/settings" className={navClass}>
            <i className="bi bi-gear-fill"></i>
            <span className="nav-text">Settings</span>
          </NavLink>
          <NavLink to="/help" className={navClass}>
            <i className="bi bi-question-circle-fill"></i>
            <span className="nav-text">Help &amp; Support</span>
          </NavLink>
        </div>

        <div className="sidebar-footer">
          <ProfileMenu />
        </div>
      </nav>

      {/* Main App Content */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="btn-sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle Navigation"
            >
              <i className="bi bi-list"></i>
            </button>
            {title && <h1 className="page-title">{title}</h1>}
          </div>

          <div className="topbar-right">
            <span className="topbar-date">
              <i className="bi bi-calendar3 text-primary"></i>
              {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>

            {/* Quick Action Dropdown */}
            <div className="dropdown">
              <button
                className="btn-topbar-new dropdown-toggle"
                type="button"
                id="newDropdown"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                <i className="bi bi-plus-lg"></i>
                <span>New</span>
              </button>
              <ul className="dropdown-menu dropdown-menu-end shadow-md border-0" style={{ borderRadius: 12, marginTop: 8, minWidth: 190 }}>
                <li>
                  <Link className="dropdown-item d-flex align-items-center gap-2 py-2" to="/invoices/create">
                    <i className="bi bi-receipt-cutoff text-primary" style={{ fontSize: '1.1rem' }}></i>
                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>New Invoice</span>
                  </Link>
                </li>
                <li>
                  <Link className="dropdown-item d-flex align-items-center gap-2 py-2" to="/quotations/create">
                    <i className="bi bi-file-earmark-text text-success" style={{ fontSize: '1.1rem' }}></i>
                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>New Quotation</span>
                  </Link>
                </li>
                <li>
                  <hr className="dropdown-divider my-1" />
                </li>
                <li>
                  <Link className="dropdown-item d-flex align-items-center gap-2 py-2" to="/clients">
                    <i className="bi bi-person-plus text-info" style={{ fontSize: '1.1rem' }}></i>
                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Add Client</span>
                  </Link>
                </li>
              </ul>
            </div>

            {/* Theme Toggle */}
            <button
              type="button"
              className="theme-toggle"
              id="themeToggle"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              aria-label="Toggle theme"
            >
              <i className={theme === 'dark' ? 'bi bi-sun-fill text-warning' : 'bi bi-moon-fill'}></i>
            </button>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="btn-topbar-logout"
              title="Logout"
              aria-label="Logout"
            >
              <i className="bi bi-power"></i>
            </button>
          </div>
        </header>

        {/* Breadcrumb bar */}
        {breadcrumb && <div className="breadcrumb-bar">{breadcrumb}</div>}

        {/* Content Body */}
        <main className="page-body">{children}</main>
      </div>
    </ProfileMenuProvider>
  )
}
