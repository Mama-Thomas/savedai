import { useEffect, useRef, useState } from 'react'

// Keep the list of formats in one place so desktop and mobile stay in sync.
// Order matches the desktop <select> so users see the same options in the
// same priority.
export const EXPORT_FORMATS = [
  { value: 'json', label: 'JSON' },
  { value: 'csv', label: 'CSV' },
  { value: 'html', label: 'HTML (browser import)' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'txt', label: 'TXT' },
  { value: 'pdf', label: 'PDF' },
]

/**
 * Compact export control for mobile.
 *
 * The desktop header already has a full format dropdown plus a separate
 * "Export" button. On mobile we used to render just a download icon that
 * silently exported JSON, which left users with no way to pick another
 * format. This component fixes that: tapping the icon opens a small popover
 * of all six formats, tapping one triggers that export and closes the menu.
 *
 * onExport(format) runs the same handler the desktop button uses.
 */
export default function ExportMenu({ onExport, exporting = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const pick = (fmt) => {
    setOpen(false)
    onExport(fmt)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={exporting}
        className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
        title="Export"
        aria-label="Export"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {exporting ? (
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3M4 6h16M4 18h16" />
          </svg>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden"
        >
          <div className="px-3 py-2 text-[11px] font-semibold tracking-wide uppercase text-slate-400 bg-slate-50 border-b border-slate-100">
            Export as
          </div>
          <div className="py-1">
            {EXPORT_FORMATS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="menuitem"
                onClick={() => pick(f.value)}
                disabled={exporting}
                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
