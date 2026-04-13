import { useState } from 'react'

export default function AddBookmark({ onAdd }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return

    setLoading(true)
    setError('')
    try {
      await onAdd(trimmed)
      setUrl('')
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save bookmark. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex gap-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste any URL — TikTok, YouTube, X, Instagram, articles..."
          required
          disabled={loading}
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white shadow-sm
                     text-slate-800 placeholder-slate-400 text-sm
                     focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent
                     disabled:opacity-60 transition"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="px-5 py-3 bg-sky-500 hover:bg-sky-600 disabled:opacity-50
                     text-white font-semibold text-sm rounded-xl shadow-sm
                     transition cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Saving…
            </span>
          ) : (
            '+ Save'
          )}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}
    </form>
  )
}
