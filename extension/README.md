# SavedAI Chrome Extension

One-click save from any web page straight into your SavedAI library.

> Status: Phase 3.1 scaffold. Sign-in, save flow, context menus, and icon badge
> land in later steps. What works right now: loading the unpacked build into
> Chrome and seeing the popup render.

## Stack

Same bones as the web app so we can share styling tokens and patterns:

- Vite 8 + React 19 + Tailwind CSS v4
- [`@crxjs/vite-plugin`](https://crxjs.dev/vite-plugin) for MV3 builds and HMR
- `chrome.storage.local` for the auth token (extensions cannot use localStorage
  across popup and service-worker contexts)

## Develop

```bash
cd extension
npm install
npm run dev
```

Vite watches for changes and writes into `dist/`. Load it once, the dev server
hot-reloads the popup on save.

## Load unpacked into Chrome

1. Open `chrome://extensions`
2. Toggle Developer mode on (top right)
3. Click "Load unpacked"
4. Pick the `extension/dist/` folder
5. Pin the SavedAI icon to the toolbar so you don't have to hunt for it

Each time you change code, the popup refreshes automatically. If the service
worker gets stuck, hit the "Reload" button on the extension card.

## Ship a packed build

```bash
npm run build
```

Produces `dist/` ready to zip and upload to the Chrome Web Store. The first
store review takes a few days, so it's worth getting Phase 3 finished first.

## Project layout

```
extension/
├── manifest.config.js    # MV3 manifest (CRXJS reads this as the source of truth)
├── vite.config.js
├── package.json
├── public/
│   └── icons/            # 16/48/128 PNGs rendered into the built manifest
├── src/
│   ├── popup/
│   │   ├── index.html    # popup entry
│   │   ├── main.jsx
│   │   ├── Popup.jsx
│   │   └── popup.css     # @import "tailwindcss"
│   ├── background/
│   │   └── service_worker.js
│   └── lib/              # shared helpers (API client, storage, config)
└── README.md
```

## Permissions in use

| Permission | Why |
|---|---|
| `storage` | Persist the auth token and API URL across popup and service worker |
| `activeTab` | Read the current tab's URL and title when the user hits save |
| `host_permissions` | Talk to the SavedAI backend over HTTP(S) |

No content scripts, no tabs permission, no broad page access.
