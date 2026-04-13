import { useState } from 'react'

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

export default function BookmarkCard({ bookmark, onDelete }) {
  const [deleting, setDeleting] = useState(false)
  const [imgError, setImgError] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await onDelete(bookmark.id)
    } catch {
      setDeleting(false)
    }
  }

  const domain = getDomain(bookmark.url)
  const favicon = getFaviconUrl(bookmark.url)

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
            src={bookmark.image_url}
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
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
            {bookmark.summary}
          </p>
        )}

        {/* Tags */}
        {bookmark.tags && bookmark.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
            {bookmark.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-sky-50 text-sky-600 text-xs rounded-full font-medium border border-sky-100"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 mt-auto">
          <span className="text-xs text-slate-300">
            {new Date(bookmark.created_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric'
            })}
          </span>
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
    </article>
  )
}
