import { useEffect, useState } from 'react'

export default function AddBookmark({
  onAdd,
  collections = [],
  defaultCollectionId = null,
  onCreateCollection,
}) {
  const [url, setUrl] = useState('')
  const [collectionId, setCollectionId] = useState(defaultCollectionId ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Rich duplicate-bookmark info returned by the API
  const [duplicate, setDuplicate] = useState(null)

  // Inline "create new collection" state
  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  // Keep the dropdown in sync when the active sidebar collection changes.
  useEffect(() => {
    setCollectionId(defaultCollectionId ?? '')
    setCreatingNew(false)
    setNewName('')
  }, [defaultCollectionId])

  const handleSelectChange = (e) => {
    const v = e.target.value
    if (v === '__new__') {
      setCreatingNew(true)
      return
    }
    setCollectionId(v)
  }

  const handleConfirmNew = async () => {
    const trimmed = newName.trim()
    if (!trimmed || !onCreateCollection) return
    setCreating(true)
    setError('')
    try {
      const created = await onCreateCollection(trimmed)
      if (created?.id) {
        setCollectionId(String(created.id))
      }
      setCreatingNew(false)
      setNewName('')
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not create collection.')
    } finally {
      setCreating(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return

    setLoading(true)
    setError('')
    setDuplicate(null)
    try {
      const cid = collectionId === '' ? null : Number(collectionId)
      await onAdd(trimmed, cid)
      setUrl('')
    } catch (err) {
      const detail = err?.response?.data?.detail
      if (detail && typeof detail === 'object' && detail.code === 'duplicate_bookmark') {
        setDuplicate(detail)
        setError('')
      } else {
        setError(
          (typeof detail === 'string' && detail) ||
          'Failed to save bookmark. Please try again.'
        )
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste any URL, TikTok, YouTube, X, Instagram, articles..."
          required
          disabled={loading}
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white shadow-sm
                     text-slate-800 placeholder-slate-400 text-sm
                     focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent
                     disabled:opacity-60 transition"
        />
        {creatingNew ? (
          <div className="flex sm:w-60 gap-1">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New collection name"
              disabled={creating}
              autoFocus
              className="flex-1 px-3 py-3 rounded-xl border border-sky-300 bg-white shadow-sm
                         text-slate-800 placeholder-slate-400 text-sm
                         focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent
                         disabled:opacity-60 transition"
            />
            <button
              type="button"
              onClick={handleConfirmNew}
              disabled={creating || !newName.trim()}
              className="px-3 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50
                         text-white text-xs font-semibold cursor-pointer"
              title="Create collection"
            >
              {creating ? '...' : 'OK'}
            </button>
            <button
              type="button"
              onClick={() => { setCreatingNew(false); setNewName('') }}
              disabled={creating}
              className="px-2 rounded-xl text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              title="Cancel"
            >
              ✕
            </button>
          </div>
        ) : (
          <select
            value={collectionId}
            onChange={handleSelectChange}
            disabled={loading}
            className="sm:w-44 px-3 py-3 rounded-xl border border-slate-200 bg-white shadow-sm
                       text-slate-700 text-sm cursor-pointer
                       focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent
                       disabled:opacity-60 transition"
            title="Save into collection"
          >
            <option value="">Uncategorized</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            {onCreateCollection && (
              <option value="__new__">+ Create new...</option>
            )}
          </select>
        )}
        <button
          type="submit"
          disabled={loading || !url.trim() || creatingNew}
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
              Saving...
            </span>
          ) : (
            '+ Save'
          )}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}
      {duplicate && (
        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-slate-700 flex items-center gap-3 flex-wrap">
          <span>{duplicate.message}</span>
          <a
            href={duplicate.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2 py-1 rounded-lg bg-white border border-amber-300 text-amber-700 hover:bg-amber-100 font-semibold"
          >
            Open saved link
          </a>
          <button
            type="button"
            onClick={() => setDuplicate(null)}
            className="ml-auto text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}
    </form>
  )
}
