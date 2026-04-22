import { useEffect, useMemo, useState } from 'react'
import {
  bookmarkExists,
  createBookmark,
  createCollection,
  fetchCollections,
  suggestCollection,
  updateBookmark,
} from '../lib/api'

/**
 * Reads the active tab's URL + title, lets the user pick a collection, and
 * hits POST /bookmarks. Title/tags/summary are generated server-side, so this
 * UI stays deliberately thin: one dropdown, one button.
 *
 * Handles the 409 duplicate response by showing a friendly "already saved"
 * message instead of red error text.
 */
export default function SavePanel({ onSignOut }) {
  const [tab, setTab] = useState(null)
  const [collections, setCollections] = useState([])
  const [collectionId, setCollectionId] = useState('') // '' = Uncategorized
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [duplicate, setDuplicate] = useState(false)
  const [saved, setSaved] = useState(null)
  const [suggestion, setSuggestion] = useState(null) // { type, name, collection_id?, bookmarkId, mode, savedCollectionName? }
  const [applying, setApplying] = useState(false)

  // Load active tab and collections in parallel on mount, then check whether
  // the URL is already saved so we can flip straight to the duplicate state.
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [[activeTab], cols] = await Promise.all([
          chrome.tabs.query({ active: true, currentWindow: true }),
          fetchCollections().catch(() => []),
        ])
        if (!alive) return
        setTab(activeTab || null)
        setCollections(Array.isArray(cols) ? cols : [])
        const u = activeTab?.url || ''
        if (u.startsWith('http')) {
          const r = await bookmarkExists(u).catch(() => null)
          if (alive && r?.exists) setDuplicate(true)
        }
      } catch (e) {
        if (!alive) return
        setError(e.message || 'Could not read active tab.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const url = tab?.url || ''
  const title = tab?.title || ''
  const prettyUrl = useMemo(() => {
    try {
      const u = new URL(url)
      return u.host + u.pathname
    } catch {
      return url
    }
  }, [url])

  const canSave = url && url.startsWith('http') && !saving && !saved

  const handleSave = async (e) => {
    e.preventDefault()
    if (!canSave) return
    setSaving(true)
    setError('')
    setDuplicate(false)
    try {
      const cid = collectionId === '' ? null : Number(collectionId)
      const bm = await createBookmark(url, cid)
      setSaved(bm)
      // Ask the service worker to refresh the action-icon badge so the
      // green check shows immediately without waiting for a tab change.
      try { chrome.runtime.sendMessage({ type: 'refresh-badge' }) } catch {}
      // Best-effort suggestion. Same rules as the web app: surface if saved
      // uncategorized, or if AI disagrees with the chosen collection.
      try {
        const s = await suggestCollection(bm.id)
        if (!s) return
        const savedCid = bm.collection_id || null
        if (!savedCid) {
          setSuggestion({ ...s, bookmarkId: bm.id, mode: 'uncategorized' })
        } else if (
          (s.type === 'existing' && s.collection_id && s.collection_id !== savedCid) ||
          s.type === 'new'
        ) {
          const savedName = collections.find((c) => c.id === savedCid)?.name || 'that collection'
          setSuggestion({ ...s, bookmarkId: bm.id, mode: 'mismatch', savedCollectionName: savedName })
        }
      } catch {
        // Suggestions are best-effort, ignore failures.
      }
    } catch (err) {
      if (err.status === 409) {
        setDuplicate(true)
      } else if (err.status === 401) {
        // Token expired or was revoked. api.js already cleared local state.
        onSignOut?.()
      } else {
        setError(err.message || 'Could not save this link.')
      }
    } finally {
      setSaving(false)
    }
  }

  const applySuggestion = async () => {
    if (!suggestion) return
    setApplying(true)
    try {
      let targetCid = suggestion.collection_id
      if (suggestion.type === 'new') {
        const c = await createCollection(suggestion.name, { force: true })
        targetCid = c.id
        // Keep local dropdown in sync so the UI reflects the new collection.
        setCollections((prev) => [...prev, c])
      }
      await updateBookmark(suggestion.bookmarkId, { collection_id: targetCid })
      setCollectionId(String(targetCid))
      setSuggestion(null)
    } catch (err) {
      setError(err.message || 'Could not apply suggestion.')
    } finally {
      setApplying(false)
    }
  }

  if (loading) {
    return <div className="py-6 text-center text-xs text-slate-400">Loading...</div>
  }

  if (!url.startsWith('http')) {
    return (
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <p className="text-xs font-semibold text-slate-700 mb-1">
          Nothing to save on this page
        </p>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          SavedAI only saves http(s) links. Open any article, video, or post
          and click the icon again.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-3">
      {/* Current tab preview */}
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
        <p className="text-[11px] font-semibold text-slate-700 truncate" title={title}>
          {title || 'Untitled page'}
        </p>
        <p className="text-[10px] text-slate-400 truncate mt-0.5" title={url}>
          {prettyUrl}
        </p>
      </div>

      {/* Collection picker */}
      <div>
        <label className="block text-[11px] font-medium text-slate-600 mb-1">
          Collection
        </label>
        <select
          value={collectionId}
          onChange={(e) => setCollectionId(e.target.value)}
          disabled={saving || !!saved}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent disabled:opacity-60"
        >
          <option value="">Uncategorized</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* State banners */}
      {duplicate && (
        <div className="p-2.5 bg-amber-50 border border-amber-100 rounded-lg text-[11px] text-amber-700">
          You already saved this link.
        </div>
      )}
      {error && !duplicate && (
        <div className="p-2.5 bg-red-50 border border-red-100 rounded-lg text-[11px] text-red-600">
          {error}
        </div>
      )}
      {saved && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg text-[11px] text-emerald-700">
          Saved. AI summary + tags are generating in the background.
        </div>
      )}

      {suggestion && (
        <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg text-[11px] text-indigo-800">
          <p className="mb-2 leading-relaxed">
            {suggestion.mode === 'mismatch'
              ? suggestion.type === 'existing'
                ? <>This looks more like <b>{suggestion.name}</b> than <b>{suggestion.savedCollectionName}</b>.</>
                : <>This looks like a new collection called <b>{suggestion.name}</b>, not <b>{suggestion.savedCollectionName}</b>.</>
              : suggestion.type === 'existing'
                ? <>AI suggests the collection <b>{suggestion.name}</b>.</>
                : <>AI suggests a new collection called <b>{suggestion.name}</b>.</>}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={applySuggestion}
              disabled={applying}
              className="px-2.5 py-1 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-[11px] font-semibold rounded-md cursor-pointer"
            >
              {applying ? 'Moving...' : suggestion.type === 'new' ? `Create "${suggestion.name}"` : `Move to ${suggestion.name}`}
            </button>
            <button
              type="button"
              onClick={() => setSuggestion(null)}
              disabled={applying}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-600 text-[11px] font-medium rounded-md border border-slate-200 cursor-pointer"
            >
              Keep as is
            </button>
          </div>
        </div>
      )}

      {/* Primary action */}
      {saved || duplicate ? (
        <a
          href="http://localhost:3000"
          target="_blank"
          rel="noopener noreferrer"
          className="py-2 text-center bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-lg transition cursor-pointer"
        >
          View in SavedAI
        </a>
      ) : (
        <button
          type="submit"
          disabled={!canSave}
          className="py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition cursor-pointer disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save to SavedAI'}
        </button>
      )}
    </form>
  )
}
