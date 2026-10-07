import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../logo.png'
import '../styles/login.css'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const toggleTheme = () => {
    const current = document.documentElement.getAttribute('data-theme')
    const next = current === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('inf-theme', next)
    const icon = document.querySelector('#themeToggle i')
    if (icon) icon.className = next === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(username, password, remember)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button type="button" className="login-theme-toggle" id="themeToggle" onClick={toggleTheme} aria-label="Toggle theme">
        <i className="bi bi-moon-fill"></i>
      </button>

      <div className="login-card" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
        <div className="login-header">
          <img src={logo} alt="ATS Logo" className="brand-logo" />
          <div className="brand-name">ATS Automation</div>
          <h1 className="login-title">Welcome Back</h1>
          <p className="login-subtitle">Sign in to manage your invoices</p>
        </div>

        {error && (
          <div className="alert alert-danger alert-dismissible fade show border-0 rounded-3 mb-4" style={{ fontSize: '0.88rem' }} role="alert">
            <i className="bi bi-info-circle me-2"></i> {error}
            <button type="button" className="btn-close" onClick={() => setError('')} aria-label="Close"></button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="username" className="form-label">Username</label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-person"></i></span>
              <input type="text" className="form-control" id="username" placeholder="Enter your username"
                value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="form-label">Password</label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-lock"></i></span>
              <input type="password" className="form-control" id="password" placeholder="Enter your password"
                value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>

          <div className="mb-4 d-flex justify-content-between align-items-center">
            <div className="form-check">
              <input type="checkbox" className="form-check-input" id="remember" checked={remember}
                onChange={(e) => setRemember(e.target.checked)} />
              <label className="form-check-label text-muted small" htmlFor="remember">Remember me</label>
            </div>
          </div>

          <button type="submit" className="btn-login" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign In'} <i className="bi bi-arrow-right"></i>
          </button>
        </form>
      </div>
    </>
  )
}
