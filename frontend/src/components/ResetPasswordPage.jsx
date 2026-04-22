import { useMemo, useState } from 'react'
import { resetPassword } from '../api/auth'

/**
 * Handles /reset-password/<token>. Pulls the token out of the pathname and
 * shows a simple "set a new password" form. On success we redirect the user
 * to / so they can sign in with the new credentials.
 */
export default function ResetPasswordPage() {
  const token = useMemo(() => {
    const m = window.location.pathname.match(/\/reset-password\/([^/?#]+)/)
    return m ? m[1] : null
  }, [])

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!token) {
      setError('This reset link is missing a token.')
      return
    }
    if (password !== confirm) {
      setError("Those passwords don't match.")
      return
    }
    setLoading(true)
    try {
      await resetPassword(token, password)
      setDone(true)
    } catch (err) {
      const detail = err?.response?.data?.detail
      if (Array.isArray(detail)) {
        setError(detail.map((d) => d.msg).join(' . '))
      } else {
        setError(
          detail ||
            'Could not reset password. The link may be expired or already used.'
        )
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-10">
      <a href="/" className="flex items-center gap-2 mb-8 cursor-pointer">
        <div className="h-10 w-10 rounded-xl bg-sky-500 flex items-center justify-center shadow-md">
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </div>
        <span className="font-bold text-slate-800 text-2xl tracking-tight">SavedAI</span>
      </a>

      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
        <h1 className="text-xl font-bold text-slate-800 mb-1">Set a new password</h1>
        <p className="text-sm text-slate-400 mb-6">
          Pick something at least 8 characters long with a letter and a number.
        </p>

        {done ? (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700">
              Password updated. You can sign in with your new password now.
            </div>
            <a
              href="/"
              className="block text-center w-full py-2.5 bg-sky-500 hover:bg-sky-600
                         text-white font-semibold text-sm rounded-xl shadow-sm transition"
            >
              Go to sign in
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                New password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={loading}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white
                           text-slate-800 placeholder-slate-300 text-sm
                           focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent
                           disabled:opacity-60 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Confirm new password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                disabled={loading}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white
                           text-slate-800 placeholder-slate-300 text-sm
                           focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent
                           disabled:opacity-60 transition"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password || !confirm}
              className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50
                         text-white font-semibold text-sm rounded-xl shadow-sm
                         transition cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save new password'}
            </button>
          </form>
        )}
      </div>

      <p className="mt-8 text-xs text-slate-300">SavedAI, save smarter with AI</p>
    </div>
  )
}
