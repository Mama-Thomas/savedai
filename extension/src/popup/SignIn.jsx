import { useState } from 'react'
import { login, register } from '../lib/api'

/**
 * Minimal email+password form. No "forgot password" link here because that
 * flow lives on the web app; extension users tap "Open web app" to recover.
 */
export default function SignIn({ onAuthed }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isRegister = mode === 'register'

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isRegister) await register(email, password)
      else await login(email, password)
      onAuthed?.(email)
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <h2 className="text-sm font-bold text-slate-800">
        {isRegister ? 'Create your account' : 'Sign in to SavedAI'}
      </h2>

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
        autoComplete="email"
        disabled={loading}
        className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent disabled:opacity-60"
      />

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={isRegister ? '8+ chars, a letter and a number' : 'Your password'}
        required
        autoComplete={isRegister ? 'new-password' : 'current-password'}
        disabled={loading}
        className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent disabled:opacity-60"
      />

      {error && (
        <div className="p-2 bg-red-50 border border-red-100 rounded-lg text-[11px] text-red-600">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !email || !password}
        className="py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition cursor-pointer disabled:cursor-not-allowed"
      >
        {loading ? '...' : isRegister ? 'Create account' : 'Sign in'}
      </button>

      <p className="text-center text-[11px] text-slate-400">
        {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button
          type="button"
          onClick={() => {
            setMode(isRegister ? 'login' : 'register')
            setError('')
          }}
          className="text-sky-500 hover:text-sky-600 font-medium cursor-pointer"
        >
          {isRegister ? 'Sign in' : 'Sign up'}
        </button>
      </p>

      <p className="text-center text-[10px] text-slate-300">
        Forgot password? Open the web app to reset.
      </p>
    </form>
  )
}
