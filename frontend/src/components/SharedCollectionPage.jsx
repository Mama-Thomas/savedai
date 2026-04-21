import { useEffect, useState } from 'react'
import BookmarkCard from './BookmarkCard'
import { fetchSharedCollection } from '../api/bookmarks'

/**
 * Unauthenticated, read-only view of a single shared collection.
 * Reads the token out of window.location.pathname (".../shared/<token>").
 */
export default function SharedCollectionPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const token = (() => {
    const m = window.location.pathname.match(/\/shared\/([^/?#]+)/)
    return m ? m[1] : null
  })()

  useEffect(() => {
    if (!token) {
      setError('No share token in URL.')
      setLoading(false)
      return
    }
    fetchSharedCollection(token)
      .then(setData)
      .catch((err) => {
        const detail = err?.response?.data?.detail
        setError(typeof detail === 'string' ? detail : 'This share link is not valid.')
      })
      .finally(() => setLoading(false))
  }, [token])

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
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
            Shared collection
          </span>
          <div className="ml-auto">
            <a
              href="/"
              className="text-xs text-sky-500 hover:text-sky-600 font-semibold"
            >
              Go to SavedAI
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        {loading ? (
          <div className="py-20 flex items-center justify-center text-slate-400 text-sm">
            Loading shared collection...
          </div>
        ) : error ? (
          <div className="py-20 text-center">
            <p className="font-semibold text-slate-700">{error}</p>
            <p className="text-sm text-slate-400 mt-1">
              The owner may have turned sharing off.
            </p>
          </div>
        ) : data ? (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-800">{data.name}</h1>
              <p className="text-xs text-slate-400 mt-1">
                {data.bookmark_count} bookmark{data.bookmark_count !== 1 ? 's' : ''}
              </p>
            </div>
            {data.bookmarks.length === 0 ? (
              <div className="py-20 text-center text-slate-400 text-sm">
                This collection is empty.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.bookmarks.map((bm) => (
                  <BookmarkCard key={bm.id} bookmark={bm} />
                ))}
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  )
}
