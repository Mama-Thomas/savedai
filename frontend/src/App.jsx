import { useCallback, useEffect, useMemo, useState } from 'react'
import AddBookmark from './components/AddBookmark'
import AskModal from './components/AskModal'
import AuthPage from './components/AuthPage'
import BookmarkCard from './components/BookmarkCard'
import CollectionSummary from './components/CollectionSummary'
import CollectionsSidebar from './components/CollectionsSidebar'
import DateControls from './components/DateControls'
import ExportMenu, { EXPORT_FORMATS } from './components/ExportMenu'
import LandingPage from './components/LandingPage'
import SearchBar from './components/SearchBar'
import ShareModal from './components/ShareModal'
import TagFilter from './components/TagFilter'
import { useAuth } from './contexts/AuthContext'
import {
  createBookmark,
  createCollection,
  deleteBookmark,
  deleteCollection,
  downloadExport,
  fetchBookmarks,
  fetchCollections,
  renameCollection,
  searchBookmarks,
  suggestCollection,
  updateBookmark,
} from './api/bookmarks'

export default function App() {
  const { user, loading: authLoading, logout } = useAuth()

  const [bookmarks, setBookmarks] = useState([])
  const [collections, setCollections] = useState([])
  const [activeCollectionId, setActiveCollectionId] = useState(null) // null=all, 0=uncategorized, id=specific
  const [activeTag, setActiveTag] = useState(null) // exact-match tag filter
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState('')
  const [askOpen, setAskOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState('json')
  // { bookmarkId, type: 'existing'|'new', collection_id, name, reason } | null
  const [suggestion, setSuggestion] = useState(null)
  // Browse-by-date controls.
  const [sortOrder, setSortOrder] = useState('newest') // 'newest' | 'oldest'
  const [groupBy, setGroupBy] = useState('none') // 'none' | 'day' | 'week' | 'month'
  const [startDate, setStartDate] = useState(null) // 'YYYY-MM-DD' | null
  const [endDate, setEndDate] = useState(null)
  // Share modal state: holds the collection being shared, or null.
  const [sharingCollection, setSharingCollection] = useState(null)
  // Mobile sidebar drawer open/closed.
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    Promise.all([fetchBookmarks(), fetchCollections()])
      .then(([bms, cols]) => {
        setBookmarks(bms)
        setCollections(cols)
      })
      .catch(() => setError('Could not load bookmarks.'))
      .finally(() => setLoading(false))
  }, [user])

  const handleSearch = useCallback(async (query) => {
    setActiveTag(null) // typing a search clears tag filter
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

  const handleAdd = async (url, collection_id) => {
    // Explicit collection_id from AddBookmark takes priority.
    // Fall back to whatever sidebar collection is active.
    let cid = collection_id
    if (cid === undefined) {
      cid = typeof activeCollectionId === 'number' && activeCollectionId > 0
        ? activeCollectionId
        : null
    }
    const newBm = await createBookmark(url, cid || null)
    setBookmarks((prev) => [newBm, ...prev])
    setSearchQuery('')
    setActiveTag(null)

    // Ask backend for a smart suggestion regardless of where it landed.
    try {
      const s = await suggestCollection(newBm.id)
      if (!s) return
      const savedCid = newBm.collection_id || null
      // Case A: saved uncategorized -> always surface suggestion.
      if (!savedCid) {
        setSuggestion({ ...s, bookmarkId: newBm.id, mode: 'uncategorized' })
        return
      }
      // Case B: saved into a specific collection, but the AI thinks it belongs
      // somewhere else. Surface a mismatch banner in two sub-cases:
      //   - suggestion is an existing collection different from where it was saved
      //   - suggestion is a new collection (AI couldn't match anywhere existing)
      const savedColl = collections.find((c) => c.id === savedCid)
      const savedCollName = savedColl?.name || 'that collection'
      if (
        s.type === 'existing' &&
        s.collection_id &&
        s.collection_id !== savedCid
      ) {
        setSuggestion({
          ...s,
          bookmarkId: newBm.id,
          mode: 'mismatch',
          savedCollectionName: savedCollName,
        })
      } else if (s.type === 'new') {
        setSuggestion({
          ...s,
          bookmarkId: newBm.id,
          mode: 'mismatch',
          savedCollectionName: savedCollName,
        })
      }
    } catch {
      // Suggestion is best effort, ignore failures.
    }
  }

  const handleDelete = async (id) => {
    await deleteBookmark(id)
    setBookmarks((prev) => prev.filter((bm) => bm.id !== id))
  }

  const handleCreateCollection = async (name, opts = {}) => {
    const c = await createCollection(name, opts)
    setCollections((prev) => [...prev, c])
    return c
  }

  const handleRenameCollection = async (id, name, opts = {}) => {
    const c = await renameCollection(id, name, opts)
    setCollections((prev) => prev.map((col) => (col.id === id ? c : col)))
    return c
  }

  const acceptSuggestion = async () => {
    if (!suggestion) return
    try {
      let targetId = suggestion.collection_id
      if (suggestion.type === 'new') {
        // User explicitly accepted creating this name, so force past any
        // similar-name guard the backend might flag.
        const c = await handleCreateCollection(suggestion.name, { force: true })
        targetId = c.id
      }
      if (targetId) {
        const updated = await updateBookmark(suggestion.bookmarkId, { collection_id: targetId })
        setBookmarks((prev) => prev.map((bm) => (bm.id === suggestion.bookmarkId ? updated : bm)))
      }
    } catch {
      setError('Could not move bookmark into that collection.')
    } finally {
      setSuggestion(null)
    }
  }

  const handleDeleteCollection = async (id) => {
    if (!confirm('Delete this collection? Bookmarks will move to Uncategorized.')) return
    await deleteCollection(id)
    setCollections((prev) => prev.filter((c) => c.id !== id))
    // Any bookmarks that pointed here are now orphaned
    setBookmarks((prev) =>
      prev.map((bm) => (bm.collection_id === id ? { ...bm, collection_id: null } : bm))
    )
    if (activeCollectionId === id) setActiveCollectionId(null)
  }

  // Exact-match tag filter on the client. Bypasses semantic/keyword search
  // so every bookmark carrying the exact tag is shown.
  const handleTagClick = async (tag) => {
    // Make sure we're working against the full list, not a search result set.
    if (searchQuery) {
      setSearchQuery('')
      try {
        const data = await fetchBookmarks()
        setBookmarks(data)
      } catch {
        // ignore
      }
    }
    setActiveTag(tag)
  }

  const clearTagFilter = () => setActiveTag(null)

  const handleMoveBookmark = async (bookmarkId, collectionId) => {
    const updated = await updateBookmark(bookmarkId, { collection_id: collectionId || 0 })
    setBookmarks((prev) => prev.map((bm) => (bm.id === bookmarkId ? updated : bm)))
  }

  const handleExport = async (format = 'json') => {
    setExporting(true)
    try {
      await downloadExport(format)
    } catch (err) {
      const detail = err?.response?.data?.detail
      setError(
        detail
          ? `Export failed: ${detail}`
          : 'Export failed. Please try again.'
      )
    } finally {
      setExporting(false)
    }
  }

  // Filter bookmarks by active collection + active tag + date range + sort.
  const visibleBookmarks = useMemo(() => {
    let list = bookmarks

    // Collection / quick view scope.
    if (activeCollectionId === 0) {
      list = list.filter((bm) => !bm.collection_id)
    } else if (activeCollectionId === -1) {
      // 'Recently saved' quick view: last 30 days across all collections.
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
      list = list.filter((bm) => new Date(bm.created_at).getTime() >= cutoff)
    } else if (typeof activeCollectionId === 'number' && activeCollectionId > 0) {
      list = list.filter((bm) => bm.collection_id === activeCollectionId)
    }

    // Tag filter.
    if (activeTag) {
      const target = activeTag.toLowerCase()
      list = list.filter(
        (bm) => Array.isArray(bm.tags) && bm.tags.some((t) => (t || '').toLowerCase() === target)
      )
    }

    // Date range. Both inclusive; end date is interpreted as end-of-day.
    if (startDate) {
      const startMs = new Date(startDate + 'T00:00:00').getTime()
      list = list.filter((bm) => new Date(bm.created_at).getTime() >= startMs)
    }
    if (endDate) {
      const endMs = new Date(endDate + 'T23:59:59').getTime()
      list = list.filter((bm) => new Date(bm.created_at).getTime() <= endMs)
    }

    // Sort. If a search query is active we keep the relevance order the server
    // returned; otherwise we apply the chosen chronological sort.
    if (!searchQuery.trim()) {
      const dir = sortOrder === 'oldest' ? 1 : -1
      list = [...list].sort(
        (a, b) =>
          (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir
      )
    }
    return list
  }, [bookmarks, activeCollectionId, activeTag, startDate, endDate, sortOrder, searchQuery])

  // Compute grouped buckets when grouping is enabled. Shape: [{ label, items }]
  const groupedBookmarks = useMemo(() => {
    if (groupBy === 'none') return null
    const buckets = new Map()
    for (const bm of visibleBookmarks) {
      const d = new Date(bm.created_at)
      let key = ''
      let label = ''
      if (groupBy === 'day') {
        key = d.toISOString().slice(0, 10)
        label = d.toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
        })
      } else if (groupBy === 'week') {
        // Key by ISO week start (Monday).
        const day = d.getDay() || 7
        const monday = new Date(d)
        monday.setHours(0, 0, 0, 0)
        monday.setDate(d.getDate() - (day - 1))
        key = monday.toISOString().slice(0, 10)
        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)
        label = `Week of ${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      }
      if (!buckets.has(key)) buckets.set(key, { label, items: [] })
      buckets.get(key).items.push(bm)
    }
    const sorted = Array.from(buckets.entries())
    sorted.sort(([a], [b]) => (sortOrder === 'oldest' ? a.localeCompare(b) : b.localeCompare(a)))
    return sorted.map(([, v]) => v)
  }, [visibleBookmarks, groupBy, sortOrder])

  const clearDateRange = () => { setStartDate(null); setEndDate(null) }

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

  // Route logged-out users:
  //   /auth or /auth?mode=signup or /login or /signup  -> AuthPage
  //   everything else                                  -> LandingPage
  if (!user) {
    const path = window.location.pathname
    const mode =
      new URLSearchParams(window.location.search).get('mode') === 'signup'
        ? 'register'
        : path === '/signup'
        ? 'register'
        : 'login'
    if (path === '/auth' || path === '/login' || path === '/signup') {
      return <AuthPage initialMode={mode} />
    }
    return <LandingPage />
  }

  const collectionLabel = (() => {
    if (activeCollectionId === null) return 'All bookmarks'
    if (activeCollectionId === -1) return 'Recently saved'
    if (activeCollectionId === 0) return 'Uncategorized'
    return collections.find((c) => c.id === activeCollectionId)?.name || 'Collection'
  })()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-2 sm:gap-3">
          {/* Mobile-only hamburger to open the collections drawer */}
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="sm:hidden -ml-1 p-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
            aria-label="Open collections"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <div className="h-8 w-8 rounded-lg bg-sky-500 flex items-center justify-center shadow-sm">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <span className="font-bold text-slate-800 text-base sm:text-lg tracking-tight">SavedAI</span>
          </div>
          <span className="hidden md:inline text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
            AI-powered bookmarks
          </span>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setAskOpen(true)}
              className="text-xs font-medium text-white bg-indigo-500 hover:bg-indigo-600 px-2.5 sm:px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              Ask AI
            </button>
            {/* Full export picker on tablet+; popover menu on mobile */}
            <div className="hidden sm:flex items-stretch rounded-lg border border-slate-200 overflow-hidden">
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                disabled={exporting}
                className="text-xs text-slate-600 bg-white px-2 py-1.5 border-r border-slate-200 focus:outline-none cursor-pointer disabled:opacity-50"
                title="Export format"
              >
                {EXPORT_FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <button
                onClick={() => handleExport(exportFormat)}
                disabled={exporting}
                className="text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-50 px-3 py-1.5 transition cursor-pointer disabled:opacity-50"
                title={`Export as ${exportFormat.toUpperCase()}`}
              >
                {exporting ? 'Exporting...' : 'Export'}
              </button>
            </div>
            <div className="sm:hidden">
              <ExportMenu
                onExport={(fmt) => {
                  setExportFormat(fmt)
                  handleExport(fmt)
                }}
                exporting={exporting}
              />
            </div>
            <span className="hidden md:inline text-xs text-slate-400 truncate max-w-[160px]">
              {user.email}
            </span>
            <button
              onClick={logout}
              className="text-xs text-slate-400 hover:text-slate-700 px-2 sm:px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition cursor-pointer"
            >
              <span className="hidden sm:inline">Sign out</span>
              <svg className="sm:hidden h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile sidebar drawer: full-height panel sliding in from the left */}
      {mobileSidebarOpen && (
        <div
          className="sm:hidden fixed inset-0 z-30 bg-slate-900/40"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <div
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-slate-50 border-r border-slate-200 shadow-xl p-3 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-2 py-2 mb-2">
              <span className="text-sm font-semibold text-slate-700">Your library</span>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <CollectionsSidebar
              collections={collections}
              activeCollectionId={activeCollectionId}
              onSelect={(id) => {
                setActiveCollectionId(id)
                setActiveTag(null)
                setMobileSidebarOpen(false)
              }}
              onCreate={handleCreateCollection}
              onRename={handleRenameCollection}
              onDelete={handleDeleteCollection}
              onShare={(c) => { setSharingCollection(c); setMobileSidebarOpen(false) }}
            />
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-5 sm:py-8 flex flex-col sm:flex-row gap-4 sm:gap-6">
        {/* Desktop sidebar (hidden on mobile in favor of the drawer above) */}
        <div className="hidden sm:block">
          <CollectionsSidebar
            collections={collections}
            activeCollectionId={activeCollectionId}
            onSelect={(id) => {
              setActiveCollectionId(id)
              setActiveTag(null)
            }}
            onCreate={handleCreateCollection}
            onRename={handleRenameCollection}
            onDelete={handleDeleteCollection}
            onShare={(c) => setSharingCollection(c)}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="flex-1">
              <AddBookmark
                onAdd={handleAdd}
                collections={collections}
                defaultCollectionId={
                  typeof activeCollectionId === 'number' && activeCollectionId > 0
                    ? activeCollectionId
                    : null
                }
                onCreateCollection={handleCreateCollection}
              />
            </div>
            <div className="sm:w-72 flex items-center gap-2">
              <div className="flex-1">
                <SearchBar onSearch={handleSearch} loading={searching} />
              </div>
              <TagFilter
                bookmarks={bookmarks}
                activeTag={activeTag}
                onSelect={(tag) => {
                  if (tag === null) {
                    setActiveTag(null)
                    return
                  }
                  handleTagClick(tag)
                }}
              />
            </div>
          </div>

          {activeTag && (
            <div className="mb-4 flex items-center gap-2">
              <span className="text-xs text-slate-500">Filtering by tag:</span>
              <button
                onClick={clearTagFilter}
                className="group inline-flex items-center gap-1 px-2 py-0.5 bg-sky-100 text-sky-700 text-xs font-medium rounded-full border border-sky-200 hover:bg-sky-200 transition cursor-pointer"
                title="Clear tag filter"
              >
                #{activeTag}
                <svg className="h-3 w-3 opacity-60 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Cutesy per-collection summary (shown when a specific collection
              or Uncategorized is selected). Hidden for 'Recently saved'. */}
          <CollectionSummary
            collectionId={activeCollectionId === -1 ? null : activeCollectionId}
            label={collectionLabel}
            bookmarkCount={
              bookmarks.filter((bm) => {
                if (activeCollectionId === 0) return !bm.collection_id
                if (activeCollectionId === null) return true
                if (activeCollectionId === -1) return true
                return bm.collection_id === activeCollectionId
              }).length
            }
          />

          {suggestion && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3 text-sm">
              <div className="flex items-start sm:items-center gap-2 flex-1 min-w-0">
                <svg className="h-5 w-5 text-amber-500 shrink-0 mt-0.5 sm:mt-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
                </svg>
                <div className="flex-1 text-slate-700">
                  {suggestion.mode === 'mismatch' && suggestion.type === 'existing' ? (
                    <>This doesn't look like <span className="font-semibold">{suggestion.savedCollectionName}</span>. It fits <span className="font-semibold">{suggestion.name}</span> better. Move it?</>
                  ) : suggestion.mode === 'mismatch' && suggestion.type === 'new' ? (
                    <>This doesn't look like <span className="font-semibold">{suggestion.savedCollectionName}</span>. Create a new <span className="font-semibold">{suggestion.name}</span> collection and move it there?</>
                  ) : suggestion.type === 'existing' ? (
                    <>Looks like this bookmark belongs in <span className="font-semibold">{suggestion.name}</span>. Move it there?</>
                  ) : (
                    <>No matching collection. Create a new one called <span className="font-semibold">{suggestion.name}</span>?</>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 sm:shrink-0">
                <button
                  onClick={acceptSuggestion}
                  className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold cursor-pointer"
                >
                  {suggestion.type === 'existing' ? 'Move it' : 'Create and move'}
                </button>
                <button
                  onClick={() => setSuggestion(null)}
                  className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  {suggestion.mode === 'mismatch' ? 'Keep here' : 'Dismiss'}
                </button>
              </div>
            </div>
          )}

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
          ) : visibleBookmarks.length === 0 ? (
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
              ) : activeTag ? (
                <>
                  <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <svg className="h-7 w-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M7 7h.01M7 3h5a1.994 1.994 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-600">No bookmarks tagged #{activeTag}</p>
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
                    <p className="font-semibold text-slate-600">
                      {activeCollectionId === null ? 'No bookmarks yet' : `No bookmarks in ${collectionLabel}`}
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                      Paste any URL above to get started. SavedAI will summarize it automatically.
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-400 mb-4">
                {searchQuery
                  ? `${visibleBookmarks.length} result${visibleBookmarks.length !== 1 ? 's' : ''} for "${searchQuery}"`
                  : activeTag
                    ? `${visibleBookmarks.length} tagged #${activeTag}`
                    : `${visibleBookmarks.length} in ${collectionLabel}`}
              </p>

              {/* Date / sort / group controls — hidden while the user is searching
                  because search results come back in relevance order. */}
              {!searchQuery.trim() && (
                <DateControls
                  sortOrder={sortOrder}
                  setSortOrder={setSortOrder}
                  groupBy={groupBy}
                  setGroupBy={setGroupBy}
                  startDate={startDate}
                  setStartDate={setStartDate}
                  endDate={endDate}
                  setEndDate={setEndDate}
                  onClearRange={clearDateRange}
                />
              )}

              {groupedBookmarks && !searchQuery.trim() ? (
                <div className="space-y-6">
                  {groupedBookmarks.map((bucket) => (
                    <section key={bucket.label}>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        {bucket.label}
                        <span className="ml-2 text-slate-300 font-normal normal-case">
                          {bucket.items.length}
                        </span>
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {bucket.items.map((bm) => (
                          <BookmarkCard
                            key={bm.id}
                            bookmark={bm}
                            onDelete={handleDelete}
                            onTagClick={handleTagClick}
                            collections={collections}
                            onMove={handleMoveBookmark}
                            onCreateCollection={handleCreateCollection}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleBookmarks.map((bm) => (
                    <BookmarkCard
                      key={bm.id}
                      bookmark={bm}
                      onDelete={handleDelete}
                      onTagClick={handleTagClick}
                      collections={collections}
                      onMove={handleMoveBookmark}
                      onCreateCollection={handleCreateCollection}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <AskModal
        open={askOpen}
        onClose={() => setAskOpen(false)}
        collections={collections}
        initialCollectionId={activeCollectionId}
      />

      {sharingCollection && (
        <ShareModal
          collection={sharingCollection}
          onClose={() => setSharingCollection(null)}
          onUpdate={(updated) => {
            setCollections((prev) =>
              prev.map((c) => (c.id === updated.id ? updated : c))
            )
            setSharingCollection(updated)
          }}
        />
      )}

      <footer className="mt-16 pb-8 text-center text-xs text-slate-300">
        SavedAI, save smarter with AI
      </footer>
    </div>
  )
}
