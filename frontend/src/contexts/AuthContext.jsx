import { createContext, useContext, useEffect, useState } from 'react'
import { getMe, setUnauthorizedHandler } from '../api/auth'

const AuthContext = createContext(null)

const TOKEN_KEY = 'savedai_token'
const TOKEN_EXPIRES_AT_KEY = 'savedai_token_expires_at'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(true)

  // If any axios call comes back 401 (token expired / revoked), wipe local
  // state so the UI bounces to the auth screen instead of looping.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(TOKEN_EXPIRES_AT_KEY)
      setToken(null)
      setUser(null)
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  // Passive session timeout. Tokens expire after a fixed lifetime; we also
  // proactively clear the local session when the stored expiry time passes.
  useEffect(() => {
    if (!token) return
    const expiresAtRaw = localStorage.getItem(TOKEN_EXPIRES_AT_KEY)
    if (!expiresAtRaw) return
    const expiresAt = Number(expiresAtRaw)
    if (!Number.isFinite(expiresAt)) return
    const ms = expiresAt - Date.now()
    if (ms <= 0) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(TOKEN_EXPIRES_AT_KEY)
      setToken(null)
      setUser(null)
      return
    }
    const t = setTimeout(() => {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(TOKEN_EXPIRES_AT_KEY)
      setToken(null)
      setUser(null)
    }, ms)
    return () => clearTimeout(t)
  }, [token])

  // On mount (or token change), validate the stored token with the server.
  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    getMe(token)
      .then(setUser)
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(TOKEN_EXPIRES_AT_KEY)
        setToken(null)
      })
      .finally(() => setLoading(false))
  }, [token])

  const saveToken = (newToken, expiresInSeconds) => {
    localStorage.setItem(TOKEN_KEY, newToken)
    if (expiresInSeconds && Number.isFinite(expiresInSeconds)) {
      const expiresAt = Date.now() + expiresInSeconds * 1000
      localStorage.setItem(TOKEN_EXPIRES_AT_KEY, String(expiresAt))
    } else {
      localStorage.removeItem(TOKEN_EXPIRES_AT_KEY)
    }
    setToken(newToken)
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_EXPIRES_AT_KEY)
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, saveToken, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
