# SavedAI Chrome Extension

One-click save from any web page straight into your SavedAI library, with
AI-assisted categorization, duplicate detection, and a green check mark on
pages you've already saved.

## Features

- Email + password sign in, token stored in `chrome.storage.local`.
- Save the current tab from the popup. The backend generates title, tags,
  and summary in the background.
- AI suggestion after save. If the tab fits an existing collection the
  popup offers "Move to X"; if it looks like a new bucket, offers
  "Create 'X'".
- Green check mark on the toolbar icon for pages already in your library.
  Updates on tab switch, URL change, sign in / out, and after every save.
- Right-click "Save this page to SavedAI" and "Save this link to SavedAI"
  context menus. Auto-applies high-confidence AI categorization;
  new-collection suggestions stay in Uncategorized and are surfaced in
  the system notification so you can confirm them later.
- In-popup settings: override the API base URL for staging or self-hosted
  backends, deep-link to Chrome's shortcut customization page, and sign
  out.
- Keyboard shortcut (Ctrl+Shift+S, Cmd+Shift+S on Mac) opens the popup on
  the active tab. Rebindable from the settings panel.

## Stack

Same bones as the web app so we can share styling tokens and patterns:

- Vite 8 + React 19 + Tailwind CSS v4
- [`@crxjs/vite-plugin`](https://crxjs.dev/vite-plugin) for MV3 builds and HMR
- `chrome.storage.local` for the auth token and API base (popup and
  service worker are separate JS contexts, so `localStorage` is unreliable)

## Develop

```bash
cd extension
npm install
npm run dev
```

Vite watches for changes and writes into `dist/`. Load it once, the dev
server hot-reloads the popup on save.

The CRXJS beta prints a harmless `Unknown input options: platform` warning
on Vite 8. It's a cosmetic mismatch waiting on the stable 2.0 release.

## Load unpacked into Chrome

1. Open `chrome://extensions`.
2. Toggle Developer mode on (top right).
3. Click "Load unpacked".
4. Pick the `extension/dist/` folder.
5. Pin the SavedAI icon to the toolbar so the badge is visible.

Each time you change code, the popup refreshes automatically. If the
service worker gets stuck, hit the "Reload" button on the extension card.
Chrome occasionally disables unpacked extensions on a Safety Check; flip
Developer mode back on and the extension returns.

## Ship a packed build

```bash
npm run pack
```

That runs a fresh build and zips `dist/` into
`savedai-extension-v<version>.zip` at the extension root, ready to upload
to the Chrome Web Store. The script prefers the Unix `zip` binary and
falls back to PowerShell `Compress-Archive` on Windows.

The Chrome Web Store developer dashboard is at
https://chrome.google.com/webstore/devconsole. The first listing needs
a promo tile, screenshots, a privacy policy URL, and a short
description; review takes a few business days. Bump `package.json`'s
`version` on every resubmission.

## Project layout

```
extension/
|-- manifest.config.js       # MV3 manifest (CRXJS reads this)
|-- vite.config.js
|-- package.json
|-- scripts/
|   +-- pack.mjs             # zero-dep zip-for-distribution script
|-- public/
|   +-- icons/               # 16/48/128 PNGs
|-- src/
|   |-- popup/
|   |   |-- index.html       # popup entry
|   |   |-- main.jsx
|   |   |-- Popup.jsx        # view switcher (save / settings)
|   |   |-- SignIn.jsx       # email + password
|   |   |-- SavePanel.jsx    # current tab + AI suggestion flow
|   |   |-- SettingsPanel.jsx  # API base, shortcut, sign out
|   |   +-- popup.css        # @import "tailwindcss"
|   |-- background/
|   |   +-- service_worker.js  # badge + context menus
|   +-- lib/
|       |-- api.js           # fetch client, bearer auth, 401 clear
|       +-- storage.js       # chrome.storage.local helpers
+-- README.md
```

## Permissions in use

| Permission | Why |
|---|---|
| `storage` | Persist auth token and API base across popup and service worker |
| `activeTab` | Read the current tab's URL and title when the user saves |
| `tabs` | Watch tab activation and URL changes to badge already-saved pages |
| `contextMenus` | Right-click "Save this page / link to SavedAI" entries |
| `notifications` | Toast after context menu saves and errors |
| `host_permissions` | Talk to the SavedAI backend over HTTP(S) |

No content scripts, no broad page access, no reading of page content
beyond URL and title.

## Backend it talks to

Default API base is `http://localhost:8001` (the FastAPI dev server
under `backend/`). Override from the in-popup settings or by editing
`DEFAULT_API_BASE` in `src/lib/storage.js`. When swapping to a
production host, also update `host_permissions` in
`manifest.config.js`; Chrome refuses requests to origins it was not
granted at install time.
