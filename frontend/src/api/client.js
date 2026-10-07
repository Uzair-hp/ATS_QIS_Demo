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

export default api
