import { createApp } from 'vue'
import Index from './views/Index.vue'
import Edit from './views/Edit.vue'
import File from './views/File.vue'
import Zip from './views/Zip.vue'
import { randomString } from './ts/utils'

var app

const pathToRegex = (path) =>
  new RegExp('^' + path.replace(/\//g, '\\/').replace(/:\w+/g, '(.+)') + '$')

const getParams = (match) => {
  const values = match.result.slice(1)
  const keys = Array.from(match.route.path.matchAll(/:(\w+)/g)).map(
    (result) => result[1]
  )

  return Object.fromEntries(
    keys.map((key, i) => {
      return [key, values[i]]
    })
  )
}

const navigateTo = (url: string, replace?: boolean) => {
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

  const routes = [
    { path: '/', view: Index },
    { path: '/edit', redirect: '?/edit/' + randomString(24) },
    { path: '/edit/:storageId', view: Edit },
    { path: '/show/code/:zipCode', view: Zip },
    { path: '/show/file/:fileUrl', view: File },
    /*  {
      path: '/export/github/&code=:code&state=:state',
      view: Export,
      init: 'github',
    },
    {
      path: '/export/github/:exportid',
      view: Export,
      init: 'github',
    },
    */
  ]

  const potentialMatches = routes.map((route) => {
    return {
      route: route,
      result: location.search.slice(1).match(pathToRegex(route.path)),
      redirect: route.redirect,
    }
  })

  let match = potentialMatches.find(
    (potentialMatches) => potentialMatches.result !== null
  )

  if (!match) {
    match = {
      route: routes[0],
      result: [location.search],
    }
  }

  if (match.redirect) {
    navigateTo(match.redirect, true)
    return
  }

  const params = getParams(match)
  const view = match.route.view

  app?.unmount()

  app = createApp(view, params)

  app.mount(document.body)
}

window.addEventListener('popstate', router)

document.addEventListener('DOMContentLoaded', () => {
  document.body.addEventListener('click', (e) => {
    if (e.target && e.target.matches('[data-link]')) {
      e.preventDefault()
      navigateTo(e.target.href)
    }
  })

  router()
})
