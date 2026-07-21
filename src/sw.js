console.log('service-worker.js')

// advanced config for injectManifest approach
importScripts(
  'https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js',
)

// Detailed logging is very useful during development
workbox.setConfig({
  debug: false,
})

// Updating SW lifecycle to update the app after user triggered refresh
// self.skipWaiting()
workbox.core.clientsClaim()

// Precache the shell/assets. Must run before the nav route so
// createHandlerBoundToURL can resolve the cached index.html.
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST)

// SPA nav fallback: routes live in the query string, so serve the cached shell
// for all navigations. denylist: the same-origin preview iframe navigates to
// liascript/index.html and must get the runtime's own shell, not the editor's.
const shellHandler = workbox.precaching.createHandlerBoundToURL('index.html')
workbox.routing.registerRoute(
  new workbox.routing.NavigationRoute(shellHandler, { denylist: [/liascript\//] })
)

// Same-origin assets: StaleWhileRevalidate so a miss falls through to network
// (CacheFirst throws no-response offline on a miss).
workbox.routing.registerRoute(
  ({url}) => url.origin === self.location.origin,
  new workbox.strategies.StaleWhileRevalidate()
)


workbox.routing.registerRoute(
  /https:\/\/code\.responsivevoice\.org/,
  new workbox.strategies.CacheFirst(),
)

workbox.routing.registerRoute(
  'https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js',
  new workbox.strategies.CacheFirst()
)
