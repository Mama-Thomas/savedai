import { useState } from 'react'
import { askBookmarks } from '../api/bookmarks'

// Markdown link: [label](https://...)
const MD_LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
// Citation-style: [1], [2], etc. Mapped to the sources array by index (N-1).
const CITATION = /\[(\d+)\]/g
// Bare URL anywhere in the text.
const BARE_URL = /(https?:\/\/[^\s)<>"']+)/g

/**
 * Turns a plain-text answer into React children with real links:
 *   - [label](url)   -> <a href=url>label</a>
 *   - [N]            -> <a href=sources[N-1].url>[N]</a>  (if that source exists)
 *   - https://...    -> <a href=url>url</a>
 * The parent still uses whitespace-pre-wrap so newlines are preserved.
 */
function renderAnswerBody(text, sources = []) {
  // First, split by markdown links so we don't double-link the URL inside ().
  const segments = []
  let lastIndex = 0
  let match
  MD_LINK.lastIndex = 0
  while ((match = MD_LINK.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'mdLink', label: match[1], url: match[2] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }

  // Render. For every plain-text segment, linkify bare URLs + citations.
  const nodes = []
  let key = 0
  for (const seg of segments) {
    if (seg.type === 'mdLink') {
      nodes.push(
        <a
          key={`md-${key++}`}
          href={seg.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:text-indigo-700 underline underline-offset-2 break-all"
        >
          {seg.label}
        </a>
      )
    } else {
      nodes.push(...linkifyPlain(seg.value, sources, `t${key++}`))
    }
  }
  return nodes
}

// Inside a plain-text chunk, handle bare URLs first, then citations on the leftovers.
function linkifyPlain(chunk, sources, baseKey) {
  const out = []
  let lastIndex = 0
  let m
  let k = 0
  BARE_URL.lastIndex = 0
  while ((m = BARE_URL.exec(chunk)) !== null) {
    if (m.index > lastIndex) {
      out.push(...linkifyCitations(chunk.slice(lastIndex, m.index), sources, `${baseKey}c${k++}`))
    }
    out.push(
      <a
        key={`${baseKey}u${k++}`}
        href={m[1]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-indigo-600 hover:text-indigo-700 underline underline-offset-2 break-all"
      >
        {m[1]}
      </a>
    )
    lastIndex = m.index + m[1].length
  }
  if (lastIndex < chunk.length) {
    out.push(...linkifyCitations(chunk.slice(lastIndex), sources, `${baseKey}c${k++}`))
  }
  return out
}

// Replaces [N] with a clickable tag that jumps to sources[N-1].url.
function linkifyCitations(chunk, sources, baseKey) {
  if (!sources || sources.length === 0) return [chunk]
  const out = []
  let lastIndex = 0
  let m
  let k = 0
  CITATION.lastIndex = 0
  while ((m = CITATION.exec(chunk)) !== null) {
    const n = parseInt(m[1], 10)
    const src = sources[n - 1]
    if (m.index > lastIndex) out.push(chunk.slice(lastIndex, m.index))
    if (src && src.url) {
      out.push(
        <a
          key={`${baseKey}-${k++}`}
          href={src.url}
          target="_blank"
          rel="noopener noreferrer"
          title={src.title || src.url}
          className="inline-block px-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100 rounded align-baseline no-underline"
        >
          [{n}]
        </a>
      )
    } else {
      // Number doesn't match a source, leave as plain text.
      out.push(m[0])
    }
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < chunk.length) out.push(chunk.slice(lastIndex))
  return out
}

export default function AskModal({
  open,
  onClose,
  collections = [],
  // null = all, 0 = uncategorized, >0 = specific collection
  initialCollectionId = null,
}) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scope, setScope] = useState(
    initialCollectionId === null ? 'all' : String(initialCollectionId)
  )

  if (!open) return null

  const scopeToCollectionId = (s) => {
    if (s === 'all') return null
    if (s === '0') return 0
    return Number(s)
  }

  const scopeLabel = (() => {
    if (scope === 'all') return 'all bookmarks'
    if (scope === '0') return 'Uncategorized'
    const c = collections.find((c) => String(c.id) === scope)
    return c ? c.name : 'collection'
  })()

  const handleAsk = async (e) => {
    e.preventDefault()
    if (!question.trim()) return
    setLoading(true)
    setError('')
    setAnswer('')
    setSources([])
    try {
      const data = await askBookmarks(question, scopeToCollectionId(scope))
      setAnswer(data.answer)
      setSources(data.sources || [])
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mt-12 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-indigo-500 flex items-center justify-center">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h2 className="font-semibold text-slate-800">Ask your bookmarks</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleAsk} className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <label className="text-xs text-slate-500 shrink-0">Ask within:</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
            >
              <option value="all">All bookmarks</option>
              <option value="0">Uncategorized</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={`e.g. "Summarize what I've saved in ${scopeLabel}"`}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="mt-3 w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition cursor-pointer"
          >
            {loading ? 'Thinking...' : `Ask (scope: ${scopeLabel})`}
          </button>
        </form>

        {error && (
          <div className="mx-5 mb-5 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {answer && (
          <div className="px-5 pb-5 max-h-[50vh] overflow-y-auto">
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {renderAnswerBody(answer, sources)}
            </div>
            {sources.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500 mb-2">Sources</p>
                <ul className="space-y-2">
                  {sources.map((bm, i) => (
                    <li key={bm.id} className="text-xs text-slate-500">
                      <span className="text-slate-400 mr-1">[{i + 1}]</span>
                      <a
                        href={bm.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-600 hover:underline"
                      >
                        {bm.title || bm.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
