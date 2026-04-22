import { useEffect, useState } from 'react'
import { clearAuth, getToken, getUserEmail } from '../lib/storage'
import SignIn from './SignIn'

/**
 * Popup root. Reads auth state from chrome.storage.local once on open and
 * swaps between the sign-in form and the signed-in placeholder (which will
 * become the Save Current Tab form in step 3.3).
 */
export default function Popup() {
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState(null)

  useEffect(() => {
    ;(async () => {
      const token = await getToken()
      const em = await getUserEmail()
      setEmail(token ? em : null)
      setReady(true)
    })()
  }, [])

  const handleSignOut = async () => {
    await clearAuth()
    setEmail(null)
  }

  return (
    <div className="w-full p-5">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-sky-500 flex items-center justify-center shadow-sm">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-800 leading-none">SavedAI</h1>
            <p className="text-[11px] text-slate-400">Save smarter with AI</p>
          </div>
        </div>
        {email && (
          <button
            onClick={handleSignOut}
            className="text-[11px] text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
            title={email}
          >
            Sign out
          </button>
        )}
      </header>

      {!ready ? (
        <div className="py-6 text-center text-xs text-slate-400">Loading...</div>
      ) : email ? (
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-semibold text-slate-700 mb-1">
            Signed in as {email}
          </p>
          <p className="text-[11px] leading-relaxed text-slate-500">
            Save Current Tab, collections, and tags land in Step 3.3.
          </p>
        </div>
      ) : (
        <SignIn onAuthed={(em) => setEmail(em)} />
      )}

      <p className="mt-4 text-[10px] text-slate-300 text-center">v0.1.0 . MV3</p>
    </div>
  )
}
