import { useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function proxyIfNeeded(imageUrl) {
  if (!imageUrl) return imageUrl
  // Instagram and TikTok CDNs block cross-origin image loads from the browser,
  // so route those through our backend image proxy.
  if (/cdninstagram\.com|fbcdn\.net|tiktokcdn/i.test(imageUrl)) {
    return `${API_URL}/proxy-image?url=${encodeURIComponent(imageUrl)}`
  }
  return imageUrl
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

function getFaviconUrl(url) {
  try {
    const { protocol, hostname } = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
  } catch {
    return null
  }
}

export default function BookmarkCard({
  bookmark,
  onDelete,
  onTagClick,
  collections = [],
  onMove,
  onCreateCollection,
}) {
  const [deleting, setDeleting] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [moving, setMoving] = useState(false)
  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [moveError, setMoveError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(bookmark.url)
      } else {
        // Fallback for non-secure contexts
        const ta = document.createElement('textarea')
        ta.value = bookmark.url
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Silent failure; user can still use the title link.
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await onDelete(bookmark.id)
    } catch {
      setDeleting(false)
    }
  }

  const handleMove = async (e) => {
    if (!onMove) return
    const value = e.target.value
    if (value === '__new__') {
      setCreatingNew(true)
      return
    }
    const newCid = value === '' ? 0 : Number(value)
    setMoving(true)
    setMoveError('')
    try {
      await onMove(bookmark.id, newCid)
    } finally {
      setMoving(false)
    }
  }

  const handleConfirmNew = async () => {
    const trimmed = newName.trim()
    if (!trimmed || !onCreateCollection) return
    setCreating(true)
    setMoveError('')
    try {
      const created = await onCreateCollection(trimmed)
      if (created?.id && onMove) {
        await onMove(bookmark.id, created.id)
      }
      setCreatingNew(false)
      setNewName('')
    } catch (err) {
      setMoveError(err?.response?.data?.detail || 'Could not create collection.')
    } finally {
      setCreating(false)
    }
  }

  const domain = getDomain(bookmark.url)
  const favicon = getFaviconUrl(bookmark.url)
  const currentCollectionValue = bookmark.collection_id ?? ''

  return (
    <article
      className={`group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md
                  transition-all duration-200 overflow-hidden flex flex-col
                  ${deleting ? 'opacity-40 pointer-events-none scale-95' : ''}`}
    >
      {/* Thumbnail */}
      {bookmark.image_url && !imgError ? (
        <div className="w-full h-44 overflow-hidden bg-slate-50 shrink-0">
          <img
            src={proxyIfNeeded(bookmark.image_url)}
            alt={bookmark.title || 'Bookmark thumbnail'}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      ) : (
        <div className="w-full h-44 bg-gradient-to-br from-sky-50 to-indigo-100 flex items-center justify-center shrink-0">
          <svg className="h-12 w-12 text-sky-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        {/* Source */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          {favicon && (
            <img src={favicon} alt="" className="h-3.5 w-3.5 rounded-sm" />
          )}
          <span className="truncate">{domain}</span>
        </div>

        {/* Title */}
        <a
          href={bookmark.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-slate-800 text-sm leading-snug line-clamp-2 hover:text-sky-600 transition-colors"
        >
          {bookmark.title || bookmark.url}
        </a>

        {/* AI Summary */}
        {bookmark.summary && (
          <p className="text-xs text-slate-500 leading-relaxed">
            {bookmark.summary}
          </p>
        )}

        {/* Tags */}
        {bookmark.tags && bookmark.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
            {bookmark.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick && onTagClick(tag)}
                className="px-2 py-0.5 bg-sky-50 text-sky-600 text-xs rounded-full font-medium border border-sky-100 hover:bg-sky-100 hover:border-sky-200 transition cursor-pointer"
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {/* Collection selector */}
        {onMove && (
          <div className="flex items-center gap-2 pt-2">
            <svg className="h-3.5 w-3.5 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 7a2 2 0 012-2h4l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
            {creatingNew ? (
              <div className="flex flex-1 gap-1">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New collection"
                  disabled={creating}
                  autoFocus
                  className="flex-1 text-xs px-2 py-1 rounded-lg border border-sky-300 bg-white text-slate-700
                             focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400"
                />
                <button
                  type="button"
                  onClick={handleConfirmNew}
                  disabled={creating || !newName.trim()}
                  className="px-2 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-[10px] font-semibold cursor-pointer"
                >
                  {creating ? '...' : 'OK'}
                </button>
                <button
                  type="button"
                  onClick={() => { setCreatingNew(false); setNewName(''); setMoveError('') }}
                  disabled={creating}
                  className="px-1 text-slate-400 hover:text-slate-600 text-[10px] cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ) : (
              <select
                value={currentCollectionValue}
                onChange={handleMove}
                disabled={moving}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-600
                           hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-300
                           cursor-pointer disabled:opacity-50"
                title="Move to collection"
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
          </div>
        )}
        {moveError && (
          <p className="text-[11px] text-red-500">{moveError}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 mt-auto">
          <span className="text-xs text-slate-300">
            {new Date(bookmark.created_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric'
            })}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              title={copied ? 'Copied!' : 'Copy link'}
              className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all cursor-pointer
                          ${copied
                            ? 'text-emerald-500 bg-emerald-50 opacity-100'
                            : 'text-slate-300 hover:text-sky-500 hover:bg-sky-50'}`}
            >
              {copied ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                    d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13.828 10.172a4 4 0 015.656 0 4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656M10.172 13.828a4 4 0 01-5.656 0 4 4 0 010-5.656l3-3a4 4 0 015.656 5.656" />
                </svg>
              )}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              title="Delete bookmark"
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-300
                         hover:text-red-400 hover:bg-red-50 transition-all cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
