import { createApp } from 'vue'
import Index from './views/Index.vue'
import Edit from './views/Edit.vue'
import File from './views/File.vue'
import Zip from './views/Zip.vue'
import GitHubExporter from './views/Export/GitHub.vue'
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
    { path: '/', view: Index },
    { path: '/edit', redirect: '?/edit/' + randomString(24) },
    { path: '/edit/:storageId/:connection', view: Edit },
    { path: '/edit/:storageId', view: Edit },
    {
      path: '/embed/code/edit/:zipCode',
      view: Zip,
      params: { embed: true, mode: -1 },
    },
    {
      path: '/embed/code/preview/:zipCode',
      view: Zip,
      params: { embed: true, mode: 1 },
    },
    { path: '/embed/code/:zipCode', view: Zip, params: { embed: true } },
    { path: '/embed/file/:fileUrl', view: File, params: { embed: true } },

    { path: '/show/code/:zipCode', view: Zip },
    { path: '/show/file/:fileUrl', view: File },
    {
      path: '/export/github/&code=:code&state=:stepId2',
      view: GitHubExporter,
    },
    {
      path: '/export/github/:stepId1',
      view: GitHubExporter,
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
  const view = match.route.view as any

  app?.unmount()

  app = createApp(view, params)
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
