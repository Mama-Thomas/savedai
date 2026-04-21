import { useEffect, useRef, useState } from 'react'
import { fetchCollectionSummary } from '../api/bookmarks'

// id: null = all (don't show), 0 = uncategorized, >0 = specific
export default function CollectionSummary({ collectionId, label, bookmarkCount }) {
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const lastFetchedKey = useRef('')

  useEffect(() => {
    if (collectionId === null) {
      setSummary('')
      return
    }
    // Refetch when collection changes or count changes.
    const key = `${collectionId}:${bookmarkCount}`
    if (key === lastFetchedKey.current) return
    lastFetchedKey.current = key

    let active = true
    setLoading(true)
    fetchCollectionSummary(collectionId)
      .then((data) => {
        if (active) setSummary(data?.summary || '')
      })
      .catch(() => {
        if (active) setSummary('')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [collectionId, bookmarkCount])

  if (collectionId === null) return null

  return (
    <div className="mb-4 p-3 bg-gradient-to-r from-indigo-50 to-sky-50 border border-indigo-100 rounded-xl flex items-start gap-3">
      <div className="h-7 w-7 rounded-lg bg-white border border-indigo-100 flex items-center justify-center shrink-0">
        <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 2l2.09 6.26L20 9l-5 4.87L16.18 21 12 17.77 7.82 21 9 13.87 4 9l5.91-.74L12 2z" />
        </svg>
      </div>
      <div className="flex-1 text-sm text-slate-700">
        <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-0.5">
          {label}
        </p>
        {loading ? (
          <p className="text-slate-400 italic">Thinking about what's in here...</p>
        ) : summary ? (
          <p className="leading-snug">{summary}</p>
        ) : (
          <p className="text-slate-400 italic">No summary yet.</p>
        )}
      </div>
    </div>
  )
}
