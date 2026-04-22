import { useEffect, useState } from 'react'
import { DEFAULT_API_BASE, getApiBase, setApiBase } from '../lib/storage'

/**
 * Settings view for the popup. Two knobs:
 *   1. API base URL, so the user can point the extension at a staging or
 *      self-hosted backend without rebuilding.
 *   2. The keyboard shortcut, which Chrome only lets us suggest in the
 *      manifest. The actual customization happens on chrome://extensions
 *      /shortcuts, so we just deep-link there.
 *
 * Also surfaces the signed-in email and a Sign out button so users who came
 * here to switch accounts don't have to hunt for it in the header.
 */
export default function SettingsPanel({ email, onSignOut, onBack }) {
  const [apiBase, setApiBaseLocal] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      const v = await getApiBase()
      setApiBaseLocal(v)
      setLoaded(true)
    })()
  }, [])

  const showFlash = (msg) => {
    setFlash(msg)
    setTimeout(() => setFlash(''), 1500)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    // Strip trailing slashes so we don't double them in fetch URLs.
    const trimmed = apiBase.trim().replace(/\/+$/, '')
    if (!/^https?:\/\/.+/.test(trimmed)) {
      setError('API base must start with http:// or https://')
      return
    }
    setSaving(true)
    try {
      await setApiBase(trimmed)
      setApiBaseLocal(trimmed)
      showFlash('Saved.')
    } catch (err) {
      setError(err.message || 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    await setApiBase(DEFAULT_API_BASE)
    setApiBaseLocal(DEFAULT_API_BASE)
    showFlash('Reset to default.')
  }

  const openShortcuts = () => {
    // chrome:// URLs can't be opened from a popup anchor, but tabs.create
    // accepts them just fine.
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })
  }

  if (!loaded) {
    return <div className="py-6 text-center text-xs text-slate-400">Loading...</div>
  }

  return (
    <div className="flex flex-col gap-4">
      {/* API base URL */}
      <form onSubmit={handleSave} className="flex flex-col gap-2">
        <label className="block text-[11px] font-medium text-slate-600">
          API base URL
        </label>
        <input
          type="url"
          value={apiBase}
          onChange={(e) => setApiBaseLocal(e.target.value)}
          placeholder={DEFAULT_API_BASE}
          spellCheck="false"
          autoCapitalize="off"
          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
        />
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Default: {DEFAULT_API_BASE}. Change this to point the extension at
          a staging or self-hosted backend.
        </p>
        {error && (
          <div className="p-2 bg-red-50 border border-red-100 rounded-lg text-[11px] text-red-600">
            {error}
          </div>
        )}
        {flash && (
          <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-lg text-[11px] text-emerald-700">
            {flash}
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium rounded-lg border border-slate-200 cursor-pointer"
          >
            Reset
          </button>
        </div>
      </form>

      {/* Keyboard shortcut */}
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
        <p className="text-[11px] font-semibold text-slate-700 mb-1">
          Keyboard shortcut
        </p>
        <p className="text-[10px] text-slate-500 leading-relaxed mb-2">
          Default: Ctrl+Shift+S (Cmd+Shift+S on Mac). Customize from Chrome's
          extension shortcuts page.
        </p>
        <button
          type="button"
          onClick={openShortcuts}
          className="text-[11px] font-medium text-sky-600 hover:text-sky-700 cursor-pointer"
        >
          Open shortcuts settings
        </button>
      </div>

      {/* Account */}
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
        <p className="text-[11px] font-semibold text-slate-700 mb-1">
          Signed in
        </p>
        <p className="text-[10px] text-slate-500 truncate mb-2" title={email || ''}>
          {email || 'Not signed in'}
        </p>
        <button
          type="button"
          onClick={onSignOut}
          className="text-[11px] font-medium text-red-500 hover:text-red-600 cursor-pointer"
        >
          Sign out
        </button>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="text-[11px] text-slate-400 hover:text-slate-600 text-center cursor-pointer"
      >
        Back to save
      </button>
    </div>
  )
}
