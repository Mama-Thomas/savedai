import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PrivacyPage from './components/PrivacyPage.jsx'
import ResetPasswordPage from './components/ResetPasswordPage.jsx'
import SharedCollectionPage from './components/SharedCollectionPage.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'

// Tiny pathname-based router. Keeps us out of needing react-router.
//   /shared/<token>          -> public, no auth
//   /reset-password/<token>  -> public password reset form
//   /privacy                 -> public privacy policy (linked from Chrome Web Store)
//   everything else          -> authenticated app (which itself shows either
//                               the landing page or the auth screen depending
//                               on whether the user is signed in).
const path = window.location.pathname
const isSharedRoute = /^\/shared\/[^/?#]+/.test(path)
const isResetRoute = /^\/reset-password\/[^/?#]+/.test(path)
const isPrivacyRoute = path === '/privacy'

function Root() {
  if (isSharedRoute) return <SharedCollectionPage />
  if (isResetRoute) return <ResetPasswordPage />
  if (isPrivacyRoute) return <PrivacyPage />
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
