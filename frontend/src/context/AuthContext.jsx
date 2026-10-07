import { createContext, useContext, useEffect, useState } from 'react'
import api, { setCsrfToken } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // GET /auth/me is also where the CSRF token comes from, so it runs on mount
  // whether or not anyone is logged in yet.
  const syncSession = () =>
    api.get('/auth/me')
      .then((res) => {
        setCsrfToken(res.data.csrf_token)
        if (res.data.authenticated) setUser(res.data.user)
        else setUser(null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))

  useEffect(() => {
    syncSession()
  }, [])

  const login = async (username, password, remember) => {
    const res = await api.post('/auth/login', { username, password, remember })
    setUser(res.data.user)
    // login_user() rewrites the session, so re-read it to get a token bound to
    // the post-login session.
    await syncSession()
    return res.data.user
  }

  const logout = async () => {
    await api.post('/auth/logout').catch(() => {})
    setUser(null)
    // logout_user() clears the session, which drops the old token.
    await syncSession()
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
