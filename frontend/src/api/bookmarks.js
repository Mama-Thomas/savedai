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

export const createBookmark = (url) =>
  api.post('/bookmarks', { url }).then(r => r.data)

export const deleteBookmark = (id) => api.delete(`/bookmarks/${id}`)

export const searchBookmarks = (q) =>
  api.get('/search', { params: { q } }).then(r => r.data)
