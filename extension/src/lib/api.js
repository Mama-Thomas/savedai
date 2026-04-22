// Fetch-based API client for the SavedAI backend. Injects the bearer token,
// auto-clears auth on 401, and normalizes errors.
import { clearAuth, getApiBase, getToken, saveToken, saveUserEmail } from './storage'

async function apiFetch(path, { method = 'GET', body, auth = true } = {}) {
  const base = await getApiBase()
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = await getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401 && auth) {
    await clearAuth()
  }
  let data = null
  try {
    data = await res.json()
  } catch {
    // Body was empty or not JSON. Fine for 204s.
  }
  if (!res.ok) {
    const detail = data?.detail
    const msg = Array.isArray(detail) ? detail.map((d) => d.msg).join('. ') : detail || `Request failed (${res.status})`
    const err = new Error(msg)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

export async function login(email, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    auth: false,
    body: { email, password },
  })
  await saveToken(data.access_token, data.expires_in)
  await saveUserEmail(email)
  return data
}

export async function register(email, password) {
  const data = await apiFetch('/auth/register', {
    method: 'POST',
    auth: false,
    body: { email, password },
  })
  await saveToken(data.access_token, data.expires_in)
  await saveUserEmail(email)
  return data
}

export async function getMe() {
  return apiFetch('/auth/me')
}
