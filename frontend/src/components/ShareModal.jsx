import { useEffect, useState } from 'react'
import { shareCollection, unshareCollection } from '../api/bookmarks'

/**
 * Small modal for turning a collection's public share link on or off.
 * Props:
 *   collection: the collection being shared
 *   onClose: () => void
 *   onUpdate: (updatedCollection) => void  (so parent can refresh state)
 */
export default function ShareModal({ collection, onClose, onUpdate }) {
  const [shareToken, setShareToken] = useState(collection?.share_token || null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setShareToken(collection?.share_token || null)
  }, [collection])

  const shareUrl = shareToken
    ? `${window.location.origin}/shared/${shareToken}`
    : ''

  const enable = async () => {
    setBusy(true); setError('')
    try {
      const res = await shareCollection(collection.id)
      setShareToken(res.share_token)
      onUpdate?.({ ...collection, share_token: res.share_token })
    } catch (e) {
      setError(e?.response?.data?.detail || 'Could not create share link.')
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    setBusy(true); setError('')
    try {
      await unshareCollection(collection.id)
      setShareToken(null)
      onUpdate?.({ ...collection, share_token: null })
    } catch (e) {
      setError(e?.response?.data?.detail || 'Could not disable share link.')
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setError('Could not copy to clipboard.')
    }
  }

  if (!collection) return null

  return (
    <div
      className="fixed inset-0 z-30 bg-slate-900/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-800 text-sm">
            Share "{collection.name}"
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          Anyone with the link will be able to view this collection and open
          its bookmarks. They won't see your other collections, and they can't
          edit anything.
        </p>

        {shareToken ? (
          <>
            <label className="block text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-1">
              Public link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                onFocus={(e) => e.target.select()}
                className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50
                           focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-300"
              />
              <button
                onClick={copy}
                className={`px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer
                            ${copied
                              ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                              : 'bg-sky-500 hover:bg-sky-600 text-white'}`}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div className="flex justify-between items-center mt-5">
              <button
                onClick={disable}
                disabled={busy}
                className="text-xs text-red-500 hover:text-red-600 font-semibold cursor-pointer disabled:opacity-50"
              >
                {busy ? 'Working...' : 'Stop sharing'}
              </button>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-sky-500 hover:text-sky-600 font-semibold"
              >
                Preview link
              </a>
            </div>
          </>
        ) : (
          <button
            onClick={enable}
            disabled={busy}
            className="w-full px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-50
                       text-white text-sm font-semibold cursor-pointer"
          >
            {busy ? 'Creating link...' : 'Create public link'}
          </button>
        )}

        {error && (
          <p className="mt-3 text-xs text-red-500">{error}</p>
        )}
      </div>
    </div>
  )
}
