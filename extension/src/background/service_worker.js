// Extension background service worker. MV3 requires this as a module.
// Kept intentionally thin in step 3.1; later steps will:
//   - watch active tab changes and badge the icon when the URL is already saved
//   - create and handle context menus (right-click -> Save to SavedAI)
//   - handle `commands` for the keyboard shortcut
self.addEventListener('install', () => {
  // Take over immediately so dev reloads aren't held back by the old worker.
  self.skipWaiting()
})

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[SavedAI] extension installed:', details.reason)
})
