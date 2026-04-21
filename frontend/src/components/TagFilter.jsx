import { useEffect, useMemo, useRef, useState } from 'react'

export default function TagFilter({ bookmarks = [], activeTag, onSelect }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)

  // Close when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const tagCounts = useMemo(() => {
    const map = new Map()
    for (const bm of bookmarks) {
      for (const t of bm.tags || []) {
        const key = (t || '').trim()
        if (!key) continue
        map.set(key, (map.get(key) || 0) + 1)
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [bookmarks])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tagCounts
    return tagCounts.filter(([t]) => t.toLowerCase().includes(q))
  }, [tagCounts, query])

  const label = activeTag ? `#${activeTag}` : 'All tags'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition cursor-pointer ${
          activeTag
            ? 'bg-sky-50 text-sky-700 border-sky-200'
            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
        }`}
        title="Filter by tag"
      >
        {label}
        <span className="ml-1 text-slate-400">({tagCounts.length})</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tags..."
              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-sky-400"
              autoFocus
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {activeTag && (
              <button
                type="button"
                onClick={() => { onSelect(null); setOpen(false); setQuery('') }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 cursor-pointer"
              >
                Clear filter
              </button>
            )}
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">No tags</p>
            ) : (
              filtered.map(([tag, count]) => {
                const isActive = activeTag && activeTag.toLowerCase() === tag.toLowerCase()
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => { onSelect(tag); setOpen(false); setQuery('') }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs cursor-pointer ${
                      isActive
                        ? 'bg-sky-50 text-sky-700'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">#{tag}</span>
                    <span className="text-slate-400">{count}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
