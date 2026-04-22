// Zips the built `dist/` folder into `savedai-extension-vX.Y.Z.zip` at the
// repo root of the extension, ready to upload to the Chrome Web Store.
//
// Zero runtime deps: shells out to the platform zip tool. Prefers the Unix
// `zip` binary (macOS, Linux) and falls back to PowerShell's Compress-Archive
// on Windows. If neither is found, prints a friendly hint and exits.

import { existsSync, readFileSync, rmSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const dist = join(root, 'dist')

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const outName = `savedai-extension-v${pkg.version}.zip`
const out = join(root, outName)

if (!existsSync(dist) || !statSync(dist).isDirectory()) {
  console.error('pack: dist/ is missing. Run `npm run build` first.')
  process.exit(1)
}

// Overwrite any previous artifact so CI and local builds agree.
if (existsSync(out)) rmSync(out)

function which(bin) {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [bin], {
      stdio: 'ignore',
    })
    return true
  } catch {
    return false
  }
}

try {
  if (which('zip')) {
    // -r recurse, -q quiet. cwd=dist so the archive contains dist's contents
    // at the top level, which is what Chrome Web Store expects.
    execFileSync('zip', ['-rq', out, '.'], { cwd: dist, stdio: 'inherit' })
  } else if (process.platform === 'win32') {
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path '${dist}\\*' -DestinationPath '${out}' -Force`,
      ],
      { stdio: 'inherit' },
    )
  } else {
    console.error(
      'pack: no `zip` binary found. Install it (brew install zip / apt install zip) and retry.',
    )
    process.exit(1)
  }
} catch (err) {
  console.error('pack: failed to create archive:', err.message)
  process.exit(1)
}

const size = statSync(out).size
const kb = (size / 1024).toFixed(1)
console.log(`pack: wrote ${outName} (${kb} KB)`)
