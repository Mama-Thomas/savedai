import { useEffect, useMemo, useState } from 'react'
import { createBookmark, fetchCollections, getMe } from '../lib/api'

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

  // Load active tab and collections in parallel on mount.
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
