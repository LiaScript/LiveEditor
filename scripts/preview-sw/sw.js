// Service worker for the isolated LiaScript preview origin.
//
// Purpose: make the cross-origin preview render offline. The editor's own SW
// cannot cache this origin, so the preview host caches its own runtime here.

const VERSION = 'lia-preview-v1'
const CORE_CACHE = VERSION + '-core'
const RUNTIME_CACHE = VERSION + '-runtime'

// The token below is replaced by build.mjs with a JSON array of relative paths.
const CORE_ASSETS = /* @core-assets */ null

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // only handle our own origin

  // Navigations -> serve the cached shell (index.html) so the preview boots offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('index.html').then((cached) => cached || fetch(req))
    )
    return
  }

  // Assets: cache-first, then network, and cache anything new for next time.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached
      return fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone()
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy))
          }
          return res
        })
        .catch(() => cached) // offline + uncached -> undefined (normal failure)
    })
  )
})
