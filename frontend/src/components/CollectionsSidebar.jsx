import { useState } from 'react'

export default function CollectionsSidebar({
  collections,
  activeCollectionId, // null = all, 0 = uncategorized, number = specific collection
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onShare,
}) {
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [createError, setCreateError] = useState('')
  // { message, existing_name, attempted_name } when API flags a similar name
  const [similarWarning, setSimilarWarning] = useState(null)

  // Per-collection rename state
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState('')
  const [renameSimilar, setRenameSimilar] = useState(null)
  const [renaming, setRenaming] = useState(false)

  const tryCreate = async (force = false) => {
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    setCreateError('')
    try {
      await onCreate(name, { force })
      setNewName('')
      setSimilarWarning(null)
    } catch (err) {
      const detail = err?.response?.data?.detail
      if (detail && typeof detail === 'object' && detail.code === 'similar_collection') {
        setSimilarWarning(detail)
      } else if (detail && typeof detail === 'object' && detail.message) {
        setCreateError(detail.message)
      } else {
        setCreateError(typeof detail === 'string' ? detail : 'Could not create collection.')
      }
    } finally {
      setAdding(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    await tryCreate(false)
  }

  const startRename = (c) => {
    setRenamingId(c.id)
    setRenameValue(c.name)
    setRenameError('')
    setRenameSimilar(null)
  }

  const cancelRename = () => {
    setRenamingId(null)
    setRenameValue('')
    setRenameError('')
    setRenameSimilar(null)
  }

  const tryRename = async (id, force = false) => {
    const name = renameValue.trim()
    if (!name) return
    setRenaming(true)
    setRenameError('')
    try {
      await onRename(id, name, { force })
      cancelRename()
    } catch (err) {
      const detail = err?.response?.data?.detail
      if (detail && typeof detail === 'object' && detail.code === 'similar_collection') {
        setRenameSimilar(detail)
      } else if (detail && typeof detail === 'object' && detail.message) {
        setRenameError(detail.message)
      } else {
        setRenameError(typeof detail === 'string' ? detail : 'Could not rename collection.')
      }
    } finally {
      setRenaming(false)
    }
  }

  const item = (key, label, onClick, onRemove, onEdit, collection, onShareItem) => {
    const active = activeCollectionId === key
    if (collection && renamingId === collection.id) {
      return (
        <li key={key}>
          <div className="px-2 py-1.5 rounded-lg bg-slate-50">
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              disabled={renaming}
              autoFocus
              className="w-full px-2 py-1 text-xs border border-sky-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
            <div className="flex items-center gap-1 mt-1">
              <button
                onClick={() => tryRename(collection.id, false)}
                disabled={renaming || !renameValue.trim()}
                className="text-[10px] px-2 py-1 rounded-md bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-semibold cursor-pointer"
              >
                {renaming ? '...' : 'Save'}
              </button>
              <button
                onClick={cancelRename}
                disabled={renaming}
                className="text-[10px] px-2 py-1 text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
            </div>
            {renameError && (
              <p className="mt-1 text-[11px] text-red-500">{renameError}</p>
            )}
            {renameSimilar && (
              <div className="mt-1 p-2 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-[11px] text-slate-700">{renameSimilar.message}</p>
                <div className="flex gap-1 mt-1">
                  <button
                    onClick={() => tryRename(collection.id, true)}
                    disabled={renaming}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-semibold cursor-pointer"
                  >
                    Rename anyway
                  </button>
                  <button
                    onClick={cancelRename}
                    className="text-[10px] px-2 py-0.5 text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </li>
      )
    }
    return (
      <li key={key ?? 'all'}>
        <div
          className={`group flex items-center justify-between px-3 py-1.5 rounded-lg text-sm cursor-pointer transition
            ${active ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:bg-slate-100'}`}
          onClick={onClick}
        >
          <span className="truncate flex items-center gap-1">
            {label}
            {collection?.share_token && (
              <span
                title="Shared publicly"
                className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400"
              />
            )}
          </span>
          <div className="flex items-center gap-1">
            {onShareItem && (
              <button
                onClick={(e) => { e.stopPropagation(); onShareItem() }}
                className={`${collection?.share_token ? 'text-emerald-500 opacity-100' : 'text-slate-300 opacity-0 group-hover:opacity-100'} hover:text-emerald-500 cursor-pointer`}
                title={collection?.share_token ? 'Manage share link' : 'Share collection'}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7M16 6l-4-4m0 0L8 6m4-4v13" />
                </svg>
              </button>
            )}
            {onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit() }}
                className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-sky-500 cursor-pointer"
                title="Rename collection"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
            {onRemove && (
              <button
                onClick={(e) => { e.stopPropagation(); onRemove() }}
                className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 cursor-pointer"
                title="Delete collection"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </li>
    )
  }

  return (
    <aside className="w-full sm:w-56 shrink-0">
      <div className="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 px-3 pt-1 pb-2">
          Collections
        </p>
        <ul className="space-y-0.5">
          {item(null, 'All bookmarks', () => onSelect(null))}
          {item(-1, 'Recently saved', () => onSelect(-1))}
          {item(0, 'Uncategorized', () => onSelect(0))}
          {collections.map((c) =>
            item(
              c.id,
              c.name,
              () => onSelect(c.id),
              () => onDelete(c.id),
              onRename ? () => startRename(c) : undefined,
              c,
              onShare ? () => onShare(c) : undefined
            )
          )}
        </ul>

        <form onSubmit={handleCreate} className="mt-3 pt-3 border-t border-slate-100">
          <input
            type="text"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value)
              setCreateError('')
              setSimilarWarning(null)
            }}
            placeholder="+ New collection"
            disabled={adding}
            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
          {createError && (
            <p className="mt-1.5 text-xs text-red-500">{createError}</p>
          )}
          {similarWarning && (
            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-slate-700">{similarWarning.message}</p>
              <div className="flex gap-1 mt-1.5">
                <button
                  type="button"
                  onClick={() => tryCreate(true)}
                  disabled={adding}
                  className="text-[11px] px-2 py-1 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-semibold cursor-pointer"
                >
                  Create anyway
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewName(similarWarning.existing_name)
                    setSimilarWarning(null)
                  }}
                  className="text-[11px] px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-600 hover:border-slate-300 cursor-pointer"
                >
                  Use '{similarWarning.existing_name}'
                </button>
                <button
                  type="button"
                  onClick={() => { setSimilarWarning(null); setNewName('') }}
                  className="text-[11px] px-2 py-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </aside>
  )
}
