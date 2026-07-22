// Assembles a deployable preview site (with offline service worker) from the
// third-party @liascript/editor runtime. Output: scripts/preview-sw/preview/

import { cp, readFile, writeFile, rm, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const RUNTIME_SRC = join(root, 'node_modules', '@liascript', 'editor', 'dist')
const OUT = join(here, 'preview')

// 1. Fresh copy of the runtime.
await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })
await cp(RUNTIME_SRC, OUT, { recursive: true })

// 2. Core assets to precache = index.html itself + everything it references
//    eagerly (js/css/png/fonts via src/href="./...").
const indexPath = join(OUT, 'index.html')
let html = await readFile(indexPath, 'utf8')

const refs = new Set(['index.html'])
for (const m of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)) refs.add(m[1])
const coreAssets = [...refs]

// 3. Write sw.js with the core list injected.
const swTemplate = await readFile(join(here, 'sw.js'), 'utf8')
const sw = swTemplate.replace('/* @core-assets */ null', JSON.stringify(coreAssets, null, 2))
await writeFile(join(OUT, 'sw.js'), sw)

// 4. Inline the SW registration into index.html (relative scope -> works at any base path).
const registerScript = `<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    var base = new URL('.', window.location.href)
    navigator.serviceWorker
      .register(base.href + 'sw.js', { scope: base.pathname })
      .catch(function (err) { console.warn('preview SW registration failed:', err) })
  })
}
</script>`
if (!html.includes('serviceWorker')) {
  html = html.replace('</body>', `  ${registerScript}\n</body>`)
  await writeFile(indexPath, html)
}

console.log(`preview site built at ${OUT}`)
console.log(`precached ${coreAssets.length} core assets; rest cached on demand`)
