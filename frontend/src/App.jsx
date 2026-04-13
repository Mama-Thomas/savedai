import { useCallback, useEffect, useState } from 'react'
import AddBookmark from './components/AddBookmark'
import AuthPage from './components/AuthPage'
import BookmarkCard from './components/BookmarkCard'
import SearchBar from './components/SearchBar'
import { useAuth } from './contexts/AuthContext'
import {
  createBookmark,
  deleteBookmark,
  fetchBookmarks,
  searchBookmarks,
} from './api/bookmarks'

export default function App() {
  const { user, loading: authLoading, logout } = useAuth()

  const [bookmarks, setBookmarks] = useState([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState('')

  // Load bookmarks when user is authenticated
  useEffect(() => {
    if (!user) return
    setLoading(true)
    fetchBookmarks()
      .then(setBookmarks)
      .catch(() => setError('Could not load bookmarks.'))
      .finally(() => setLoading(false))
  }, [user])

  const handleSearch = useCallback(async (query) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setSearching(true)
      try {
        const data = await fetchBookmarks()
        setBookmarks(data)
      } finally {
        setSearching(false)
      }
      return
    }
    setSearching(true)
    try {
      const data = await searchBookmarks(query)
      setBookmarks(data)
    } catch {
      // Keep current results on search error
    } finally {
      setSearching(false)
    }
  }, [])

  const handleAdd = async (url) => {
    const newBm = await createBookmark(url)
    setBookmarks((prev) => [newBm, ...prev])
    setSearchQuery('')
  }

  const handleDelete = async (id) => {
    await deleteBookmark(id)
    setBookmarks((prev) => prev.filter((bm) => bm.id !== id))
  }

  // Full-screen spinner while validating stored token
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-sky-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    )
  }

  // Not authenticated — show login/register
  if (!user) {
    return <AuthPage />
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <div className="h-8 w-8 rounded-lg bg-sky-500 flex items-center justify-center shadow-sm">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <span className="font-bold text-slate-800 text-lg tracking-tight">SavedAI</span>
          </div>
          <span className="hidden sm:inline text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
            AI-powered bookmarks
          </span>

          {/* User + logout */}
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-slate-400 truncate max-w-[160px]">
              {user.email}
            </span>
            <button
              onClick={logout}
              className="text-xs text-slate-400 hover:text-slate-700 px-3 py-1.5 rounded-lg
                         border border-slate-200 hover:border-slate-300 transition cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Add + Search row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="flex-1">
            <AddBookmark onAdd={handleAdd} />
          </div>
          <div className="sm:w-72">
            <SearchBar onSearch={handleSearch} loading={searching} />
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <svg className="animate-spin h-8 w-8 text-sky-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-sm text-slate-400">Loading bookmarks…</p>
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            {searchQuery ? (
              <>
                <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <svg className="h-7 w-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-600">No results for "{searchQuery}"</p>
                  <p className="text-sm text-slate-400 mt-1">Try different keywords or clear the search.</p>
                </div>
              </>
            ) : (
              <>
                <div className="h-14 w-14 rounded-2xl bg-sky-50 flex items-center justify-center">
                  <svg className="h-7 w-7 text-sky-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-600">No bookmarks yet</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Paste any URL above to get started — SavedAI will summarize it automatically.
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-400 mb-4">
              {searchQuery
                ? `${bookmarks.length} result${bookmarks.length !== 1 ? 's' : ''} for "${searchQuery}"`
                : `${bookmarks.length} bookmark${bookmarks.length !== 1 ? 's' : ''} saved`}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {bookmarks.map((bm) => (
                <BookmarkCard key={bm.id} bookmark={bm} onDelete={handleDelete} />
              ))}
            </div>
          </>
        )}
      </main>

      <footer className="mt-16 pb-8 text-center text-xs text-slate-300">
        SavedAI — save smarter with AI
      </footer>
    </div>
  )
}
