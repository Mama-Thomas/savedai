import { useState } from 'react'
import { login, register } from '../api/auth'
import { useAuth } from '../contexts/AuthContext'

export default function AuthPage() {
  const { saveToken } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isRegister = mode === 'register'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const fn = isRegister ? register : login
      const data = await fn(email, password)
      saveToken(data.access_token)
    } catch (err) {
      const detail = err?.response?.data?.detail
      if (Array.isArray(detail)) {
        setError(detail.map(d => d.msg).join(' · '))
      } else {
        setError(detail || (isRegister ? 'Registration failed.' : 'Invalid email or password.'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <div className="h-10 w-10 rounded-xl bg-sky-500 flex items-center justify-center shadow-md">
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </div>
        <span className="font-bold text-slate-800 text-2xl tracking-tight">SavedAI</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
        <h1 className="text-xl font-bold text-slate-800 mb-1">
          {isRegister ? 'Create an account' : 'Welcome back'}
        </h1>
        <p className="text-sm text-slate-400 mb-6">
          {isRegister
            ? 'Start saving and summarizing links with AI.'
            : 'Sign in to access your bookmarks.'}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              disabled={loading}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white
                         text-slate-800 placeholder-slate-300 text-sm
                         focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent
                         disabled:opacity-60 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isRegister ? 'At least 8 characters' : '••••••••'}
              required
              autoComplete={isRegister ? 'new-password' : 'current-password'}
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
            disabled={loading}
            className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50
                       text-white font-semibold text-sm rounded-xl shadow-sm
                       transition cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                {isRegister ? 'Creating account…' : 'Signing in…'}
              </span>
            ) : (
              isRegister ? 'Create account' : 'Sign in'
            )}
          </button>
        </form>

        {/* Toggle mode */}
        <p className="mt-5 text-center text-sm text-slate-400">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setMode(isRegister ? 'login' : 'register'); setError('') }}
            className="text-sky-500 hover:text-sky-600 font-medium transition cursor-pointer"
          >
            {isRegister ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>

      <p className="mt-8 text-xs text-slate-300">SavedAI — save smarter with AI</p>
    </div>
  )
}
