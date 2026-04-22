// Thin promise wrapper around chrome.storage.local. The popup and the service
// worker both live under the extension origin but are separate JS contexts, so
// localStorage is unreliable here. chrome.storage.local is the right tool.

const TOKEN_KEY = 'savedai.token'
const TOKEN_EXP_KEY = 'savedai.token_expires_at'
const USER_EMAIL_KEY = 'savedai.user_email'
const API_BASE_KEY = 'savedai.api_base'

export const DEFAULT_API_BASE = 'http://localhost:8001'

async function get(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve))
}
async function set(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve))
}
async function remove(keys) {
  return new Promise((resolve) => chrome.storage.local.remove(keys, resolve))
}

export async function getApiBase() {
  const { [API_BASE_KEY]: v } = await get([API_BASE_KEY])
  return v || DEFAULT_API_BASE
}

export async function setApiBase(url) {
  await set({ [API_BASE_KEY]: url })
}

export async function saveToken(token, expiresInSeconds) {
  const expiresAt = Date.now() + (expiresInSeconds || 3600) * 1000
  await set({ [TOKEN_KEY]: token, [TOKEN_EXP_KEY]: expiresAt })
}

export async function getToken() {
  const { [TOKEN_KEY]: token, [TOKEN_EXP_KEY]: exp } = await get([TOKEN_KEY, TOKEN_EXP_KEY])
  if (!token) return null
  if (exp && Date.now() > exp) {
    await clearAuth()
    return null
  }
  return token
}

export async function saveUserEmail(email) {
  await set({ [USER_EMAIL_KEY]: email })
}

export async function getUserEmail() {
  const { [USER_EMAIL_KEY]: v } = await get([USER_EMAIL_KEY])
  return v || null
}

export async function clearAuth() {
  await remove([TOKEN_KEY, TOKEN_EXP_KEY, USER_EMAIL_KEY])
}
