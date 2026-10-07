import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// CSRF token issued by GET /api/auth/me and stored in the session cookie.
// Kept in module scope so it survives re-renders; deliberately NOT persisted
// to localStorage, which would leak it to any XSS payload.
let csrfToken = null

export function setCsrfToken(token) {
  csrfToken = token || null
}

export function getCsrfToken() {
  return csrfToken
}

// Single choke point: every state-changing request goes through here, so no
// page needs its own token handling.
api.interceptors.request.use((config) => {
  // FormData must not carry a Content-Type of our own making. The instance
  // default above is application/json, which would make axios JSON.stringify()
  // the FormData (turning the File into {}), and forcing
  // 'multipart/form-data' without a boundary makes Flask unable to parse the
  // body at all. Dropping the header lets the browser build
  // 'multipart/form-data; boundary=...' itself.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers.delete('Content-Type')
  }

  const method = (config.method || 'get').toUpperCase()
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) {
    config.headers = config.headers || {}
    config.headers['X-CSRFToken'] = csrfToken
  }
  return config
})

// Centralized 401 (unauthorized/expired session) handling.
// - Redirects to /app/login on authenticated API 401.
// - Does NOT redirect for /auth/login 401 (invalid credentials) to avoid loops.
// - Does NOT redirect if already on login page.
// - Preserves original error for non-401 responses.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || ''
      const isLoginRequest = requestUrl.includes('/auth/login')
      const isAuthMeRequest = requestUrl.includes('/auth/me')

      // If the login request itself fails with 401, let the login page handle it.
      if (isLoginRequest) {
        return Promise.reject(error)
      }

      // If /auth/me returns 401 during initial load, let AuthContext handle it silently.
      if (isAuthMeRequest) {
        return Promise.reject(error)
      }

      // For other authenticated requests, redirect to login if not already there.
      const currentPath = window.location.pathname
      const isOnLoginPage = currentPath === '/app/login' || currentPath === '/login'

      if (!isOnLoginPage) {
        // Clear any stale CSRF token since session is invalid
        csrfToken = null
        // Redirect to /app/login with the current path as 'from' state
        window.location.href = `/app/login?redirect=${encodeURIComponent(currentPath)}`
        // Return a pending promise to prevent further error handling
        return new Promise(() => {})
      }
    }
    return Promise.reject(error)
  }
)

export default api
