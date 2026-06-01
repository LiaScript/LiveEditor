// Vue compile-time feature flags — required by the esm-bundler build of Vue.
// Parcel has no built-in DefinePlugin equivalent, so we set them on globalThis
// before Vue runs so the typeof-checks in vue/dist/vue.esm-bundler.js resolve.
(globalThis as any).__VUE_OPTIONS_API__ = true;
(globalThis as any).__VUE_PROD_DEVTOOLS__ = false;
(globalThis as any).__VUE_PROD_HYDRATION_MISMATCH_DETAILS__ = false;

import { createApp } from 'vue'

// Configure Monaco Editor web workers for Parcel bundler.
// getWorker (not getWorkerUrl) is required so Parcel recognises the
// new Worker(new URL(...)) pattern and bundles all deps inline into the
// worker chunk, avoiding shared-chunk require() failures at runtime.
(window as any).MonacoEnvironment = {
  getWorker: function (_moduleId: string, _label: string) {
    return new Worker(new URL('./editor.worker.ts', import.meta.url), { type: 'module' })
  },
}

import AudioRecorder from 'vue3-mic-recorder'
import { randomString } from './ts/utils'

var app

const pathToRegex = (path) =>
  new RegExp('^' + path.replace(/\//g, '\\/').replace(/:\w+/g, '(.+)') + '$')

const getParams = (match) => {
  const values = match.result.slice(1)
  const keys = Array.from(match.route.path.matchAll(/:(\w+)/g)).map(
    (result) => (result as RegExpMatchArray)[1]
  )

  let params = Object.fromEntries(
    keys.map((key, i) => {
      return [key, values[i]]
    })
  )

  if (match.params) {
    params = {
      ...params,
      ...match.params,
      redirect: undefined,
      params: undefined,
    }
  }

  return params
}

export const navigateTo = (url: string, replace?: boolean) => {
  if (replace) {
    history.replaceState(null, '', url)
  } else {
    history.pushState(null, '', url)
  }
  router()
}

const router = async () => {
  if (location.pathname.startsWith('liascript')) {
    return
  }

  if (window.location.search.startsWith('?%2F')) {
    window.location.search = decodeURIComponent(window.location.search)
    return
  }

  const routes = [
    { path: '/', view: () => import('./views/Index.vue') },
    { path: '/edit', redirect: '?/edit/' + randomString(24) },
    { path: '/edit/:storageId/:connection', view: () => import('./views/Edit.vue') },
    { path: '/edit/:storageId', view: () => import('./views/Edit.vue') },
    {
      path: '/embed/code/edit/:zipCode',
      view: () => import('./views/Zip.vue'),
      params: { embed: true, mode: -1 },
    },
    {
      path: '/embed/code/preview/:zipCode',
      view: () => import('./views/Zip.vue'),
      params: { embed: true, mode: 1 },
    },
    { path: '/embed/code/:zipCode', view: () => import('./views/Zip.vue'), params: { embed: true } },
    { path: '/embed/file/:fileUrl', view: () => import('./views/File.vue'), params: { embed: true } },

    { path: '/show/code/:zipCode', view: () => import('./views/Zip.vue') },
    { path: '/show/file/:fileUrl', view: () => import('./views/File.vue') },
    {
      path: '/export/github/&code=:code&state=:stepId2',
      view: () => import('./views/Export/GitHub.vue'),
    },
    {
      path: '/export/github/:stepId1',
      view: () => import('./views/Export/GitHub.vue'),
    },
  ]

  const potentialMatches = routes.map((route) => {
    return {
      route: route,
      result: location.search.slice(1).match(pathToRegex(route.path)),
      redirect: route.redirect,
      params: route.params,
    }
  })

  let match = potentialMatches.find(
    (potentialMatches) => potentialMatches.result !== null
  )

  if (!match) {
    match = {
      route: routes[0],
      result: [location.search],
      redirect: undefined,
      params: undefined,
    }
  }

  if (match && match.redirect) {
    navigateTo(match.redirect, true)
    return
  }

  const params = getParams(match)
  const loader = match.route.view as () => Promise<{ default: any }>

  app?.unmount()

  const ViewModule = await loader()
  app = createApp(ViewModule.default, params)
  app.use(AudioRecorder)

  app.mount(document.body)
}

window.addEventListener('popstate', router)

document.addEventListener('DOMContentLoaded', () => {
  document.body.addEventListener('click', (e) => {
    const target = e.target as Element
    if (target && target.matches('[data-link]')) {
      e.preventDefault()

      // Try to retrieve the href attribute
      let destination = (target as HTMLAnchorElement).getAttribute('href')

      // If href doesn't exist, fallback to the data-link attribute
      if (!destination) {
        destination = target.getAttribute('data-link')
      }

      // If a destination was found, navigate to it
      if (destination) {
        navigateTo(destination)
      } else {
        console.warn('No navigation destination found on the clicked element.')
      }
    }
  })

  router()
})
