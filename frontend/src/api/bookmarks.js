import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

// Attach stored JWT to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('savedai_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const fetchBookmarks = () => api.get('/bookmarks').then(r => r.data)

export const createBookmark = (url, collection_id = null) =>
  api.post('/bookmarks', { url, collection_id }).then(r => r.data)

export const updateBookmark = (id, payload) =>
  api.patch(`/bookmarks/${id}`, payload).then(r => r.data)

export const deleteBookmark = (id) => api.delete(`/bookmarks/${id}`)

export const searchBookmarks = (q) =>
  api.get('/search', { params: { q } }).then(r => r.data)

// Collections
export const fetchCollections = () => api.get('/collections').then(r => r.data)

export const createCollection = (name, { force = false } = {}) =>
  api.post('/collections', { name, force }).then(r => r.data)

export const renameCollection = (id, name, { force = false } = {}) =>
  api.patch(`/collections/${id}`, { name, force }).then(r => r.data)

// id = 0 means uncategorized
export const fetchCollectionSummary = (id) =>
  api.get(`/collections/${id}/summary`).then(r => r.data)

export const deleteCollection = (id) => api.delete(`/collections/${id}`)

// RAG chat. collection_id: null = all, 0 = uncategorized, >0 = specific
export const askBookmarks = (question, collection_id = null) =>
  api.post('/ask', { question, collection_id }).then(r => r.data)

// Ask the backend which existing collection (if any) looks like a good home
// for a freshly-added bookmark, or what to name a new one.
export const suggestCollection = (bookmarkId) =>
  api.get(`/collections/suggest/${bookmarkId}`).then(r => r.data)

// Export (authenticated download via axios so JWT is attached)
export const downloadExport = async (format = 'json') => {
  try {
    const response = await api.get('/export', {
      params: { format },
      responseType: 'blob',
    })
    const blobUrl = URL.createObjectURL(response.data)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `savedai-bookmarks.${format}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(blobUrl)
  } catch (err) {
    // Error bodies come back as a Blob when responseType is 'blob'. Unwrap so
    // the UI can show the real message.
    if (err?.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text()
        try {
          const parsed = JSON.parse(text)
          err.response.data = parsed
        } catch {
          err.response.data = { detail: text }
        }
      } catch {
        // fall through
      }
    }
    throw err
  }
}
