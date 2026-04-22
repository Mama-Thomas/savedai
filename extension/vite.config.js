import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config.js'

// CRXJS wires MV3 for us: it rewrites manifest paths, injects HMR, and emits
// a clean dist/ we can load unpacked. Port is pinned for consistent HMR ws.
export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  server: {
    port: 5174,
    strictPort: true,
    hmr: { port: 5174 },
    // The MV3 service worker and the popup run under a chrome-extension://
    // origin, so Vite's dev server needs to CORS-allow them. Otherwise Chrome
    // fails service-worker registration with "Status code: 3" the first time
    // the extension boots. Wide-open is fine because this is a local dev port.
    cors: {
      origin: [/^chrome-extension:\/\//, /^http:\/\/localhost/, /^http:\/\/127\.0\.0\.1/],
      credentials: true,
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
