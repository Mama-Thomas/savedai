import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({ baseURL })

// A stored 401 handler that the AuthContext registers on mount. We call
// this from the response interceptor so any expired-token response from any
// api.* call also wipes local state instead of looping on a dead JWT.
let onUnauthorized = null
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && onUnauthorized) {
      try { onUnauthorized() } catch { /* ignore */ }
    }
    return Promise.reject(err)
  }
)

export const register = (email, password) =>
  api.post('/auth/register', { email, password }).then((r) => r.data)

export const login = (email, password) =>
  api.post('/auth/login', { email, password }).then((r) => r.data)

export const getMe = (token) =>
  api
    .get('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => r.data)

export const forgotPassword = (email) =>
  api.post('/auth/forgot-password', { email }).then((r) => r.data)

export const resetPassword = (token, password) =>
  api.post('/auth/reset-password', { token, password }).then((r) => r.data)
