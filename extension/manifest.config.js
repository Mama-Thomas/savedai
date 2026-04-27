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
  // Backends the extension is allowed to call. Production is first; the
  // localhost entries are kept so devs can point at a local backend via the
  // in-popup settings page without touching this file.
  host_permissions: [
    'https://savedai-api.onrender.com/*',
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
