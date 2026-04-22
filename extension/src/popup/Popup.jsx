import { useEffect, useState } from 'react'
import { clearAuth, getToken, getUserEmail } from '../lib/storage'
import SignIn from './SignIn'
import SavePanel from './SavePanel'
import SettingsPanel from './SettingsPanel'

/**
 * Popup root. Reads auth state from chrome.storage.local once on open and
 * swaps between SignIn, SavePanel, and SettingsPanel. View state lives here
 * so the gear icon in the header can flip it.
 */
export default function Popup() {
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState(null)
  const [view, setView] = useState('save') // 'save' | 'settings'

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
    setView('save')
  }

  const toggleSettings = () =>
    setView((v) => (v === 'settings' ? 'save' : 'settings'))

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
            onClick={toggleSettings}
            className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 -m-1"
            title={view === 'settings' ? 'Close settings' : 'Settings'}
            aria-label={view === 'settings' ? 'Close settings' : 'Settings'}
          >
            {view === 'settings' ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        )}
      </header>

      {!ready ? (
        <div className="py-6 text-center text-xs text-slate-400">Loading...</div>
      ) : email ? (
        view === 'settings' ? (
          <SettingsPanel
            email={email}
            onSignOut={handleSignOut}
            onBack={() => setView('save')}
          />
        ) : (
          <SavePanel onSignOut={handleSignOut} />
        )
      ) : (
        <SignIn onAuthed={(em) => setEmail(em)} />
      )}

      <p className="mt-4 text-[10px] text-slate-300 text-center">v0.1.0 . MV3</p>
    </div>
  )
}
