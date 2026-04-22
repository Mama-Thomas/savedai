// MV3 service worker. Two responsibilities right now:
//   1. Badge the action icon on tabs whose URL is already in the user's
//      SavedAI library (Phase 3.5).
//   2. Expose "Save this page" / "Save this link" context menus that reuse
//      the same save pipeline as the popup (Phase 3.6).
//
// The service worker can be terminated at any time and resurrected when any
// of its listeners fire, so all state lives in chrome.storage.local. Every
// entry point re-reads whatever it needs.

import {
  bookmarkExists,
  createBookmark,
  suggestCollection,
  updateBookmark,
} from '../lib/api'
import { getToken } from '../lib/storage'

// --- badge ---------------------------------------------------------------

const BADGE_COLOR = '#10b981' // emerald-500
const BADGE_TEXT = '✓'

async function setBadgeForTab(tabId, saved) {
  try {
    if (saved) {
      await chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR })
      await chrome.action.setBadgeText({ tabId, text: BADGE_TEXT })
    } else {
      await chrome.action.setBadgeText({ tabId, text: '' })
    }
  } catch {
    // Tab may have closed between the check and the write. Swallow.
  }
}

async function refreshBadgeForTab(tab) {
  if (!tab || typeof tab.id !== 'number') return
  const url = tab.url || ''
  if (!url.startsWith('http')) {
    await setBadgeForTab(tab.id, false)
    return
  }
  const token = await getToken()
  if (!token) {
    await setBadgeForTab(tab.id, false)
    return
  }
  try {
    const r = await bookmarkExists(url)
    await setBadgeForTab(tab.id, !!r?.exists)
  } catch {
    await setBadgeForTab(tab.id, false)
  }
}

async function refreshActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab) await refreshBadgeForTab(tab)
}

// Tab navigation triggers.
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId)
    await refreshBadgeForTab(tab)
  } catch {
    /* tab already closed */
  }
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only re-check when the URL or load state changed to avoid hammering the API.
  if (changeInfo.status === 'complete' || typeof changeInfo.url === 'string') {
    refreshBadgeForTab(tab)
  }
})

// Sign-in/sign-out toggles the badge across all tabs. We listen for storage
// changes on the token and re-check the active tab.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  if ('savedai.token' in changes) refreshActiveTab()
})

// Popup asks us to refresh right after a successful save or move so the badge
// flips immediately without waiting for a tab switch.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'refresh-badge') refreshActiveTab()
})

// --- context menus -------------------------------------------------------

const MENU_PAGE = 'savedai-save-page'
const MENU_LINK = 'savedai-save-link'

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_PAGE,
      title: 'Save this page to SavedAI',
      contexts: ['page', 'selection', 'image', 'video', 'audio'],
    })
    chrome.contextMenus.create({
      id: MENU_LINK,
      title: 'Save this link to SavedAI',
      contexts: ['link'],
    })
  })
}

chrome.runtime.onInstalled.addListener(() => {
  createMenus()
  refreshActiveTab()
})

// onStartup fires when Chrome launches cold. Rebuild menus defensively.
chrome.runtime.onStartup?.addListener(() => {
  createMenus()
  refreshActiveTab()
})

async function notify(title, message) {
  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('public/icons/128.png'),
      title,
      message: message || '',
      priority: 0,
    })
  } catch {
    // Notifications are best-effort; ignore failures.
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const url =
    info.menuItemId === MENU_LINK
      ? info.linkUrl
      : info.pageUrl || tab?.url || ''

  if (!url || !url.startsWith('http')) {
    await notify('SavedAI', 'Only http(s) links can be saved.')
    return
  }

  const token = await getToken()
  if (!token) {
    await notify('Sign in required', 'Open the SavedAI popup and sign in first.')
    return
  }

  try {
    const bm = await createBookmark(url, null)

    // Best-effort AI categorization. The popup shows the user a choice; the
    // context menu has no UI surface, so we auto-apply only high-confidence
    // "existing collection" matches. New-collection suggestions are surfaced
    // in the notification so the user can confirm from the popup or web app.
    let title = 'Saved to SavedAI'
    let message = url.length > 60 ? url.slice(0, 57) + '...' : url
    try {
      const s = await suggestCollection(bm.id)
      if (s?.type === 'existing' && s.collection_id) {
        await updateBookmark(bm.id, { collection_id: s.collection_id })
        title = `Saved to ${s.name}`
      } else if (s?.type === 'new' && s.name) {
        message = `Saved to Uncategorized. AI suggests new collection: ${s.name}`
      }
    } catch {
      // Suggestion flow is optional. Fall back to the plain "Saved" toast.
    }

    await notify(title, message)
    // Bump the badge on the active tab if we just saved its URL.
    if (tab && url === tab.url) await refreshBadgeForTab(tab)
    else await refreshActiveTab()
  } catch (err) {
    if (err?.status === 409) {
      await notify('Already saved', 'This link is already in your library.')
    } else if (err?.status === 401) {
      await notify('Session expired', 'Open the popup and sign in again.')
    } else {
      await notify('Could not save', err?.message || 'Try again from the popup.')
    }
  }
})

// --- install log ---------------------------------------------------------

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[SavedAI] extension installed:', details.reason)
})
