import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import SharedCollectionPage from './components/SharedCollectionPage.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'

// Tiny pathname-based router. If the URL is /shared/<token>, render the
// public read-only viewer and skip auth entirely. Anything else goes through
// the authenticated app.
const isSharedRoute = /^\/shared\/[^/?#]+/.test(window.location.pathname)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isSharedRoute ? (
      <SharedCollectionPage />
    ) : (
      <AuthProvider>
        <App />
      </AuthProvider>
    )}
  </StrictMode>,
)
