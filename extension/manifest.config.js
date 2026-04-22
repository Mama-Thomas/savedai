// Manifest V3 for Chrome. Kept as a JS module so we can import package.json
// cleanly and pull the version from there. CRXJS reads this as the source of
// truth and rewrites paths during the Vite build.
import pkg from './package.json' with { type: 'json' }

/** @type {chrome.runtime.ManifestV3} */
export default {
  manifest_version: 3,
  name: 'SavedAI',
  version: pkg.version,
  description: pkg.description,
  icons: {
    16: 'public/icons/16.png',
    48: 'public/icons/48.png',
    128: 'public/icons/128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'Save to SavedAI',
    default_icon: {
      16: 'public/icons/16.png',
      48: 'public/icons/48.png',
      128: 'public/icons/128.png',
    },
  },
  background: {
    service_worker: 'src/background/service_worker.js',
    type: 'module',
  },
  permissions: ['storage', 'activeTab', 'tabs', 'contextMenus', 'notifications'],
  // Dev hosts. The user can point the extension at a different backend from
  // the in-popup settings page; any new origin should be added here (or via
  // the browser prompt for optional host permissions if we ever adopt those).
  host_permissions: [
    'http://localhost:8001/*',
    'http://127.0.0.1:8001/*',
  ],
  // _execute_action is the reserved command name MV3 uses to open the popup
  // in response to a keyboard shortcut. No service-worker handler required.
  // Users can rebind from chrome://extensions/shortcuts if this collides.
  commands: {
    _execute_action: {
      suggested_key: {
        default: 'Ctrl+Shift+S',
        mac: 'Command+Shift+S',
      },
      description: 'Open the SavedAI popup',
    },
  },
}
