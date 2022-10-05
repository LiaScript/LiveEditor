import { createApp } from 'vue'
import Index from './views/Index.vue'
import LiaScript from './views/LiaScript.vue'
import Edit from './views/Edit.vue'
import File from './views/File.vue'

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

const navigateTo = (url: string) => {
  history.pushState(null, undefined, url)
  router()
}

const router = async () => {
  if (location.pathname.startsWith('liascript')) {
    return
  }

  const routes = [
    { path: '/', view: Index },
    { path: '/edit', view: LiaScript },
    { path: '/edit/:storageId', view: Edit },
    { path: '/show/code/:zipCode', view: LiaScript },
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

  const params = getParams(match)
  const view = match.route.view

  const app = createApp(view, params)

  app.mount(document.body)
}

window.addEventListener('popstate', router)

document.addEventListener('DOMContentLoaded', () => {
  document.body.addEventListener('click', (e) => {
    if (e.target.matches('[data-link]')) {
      e.preventDefault()
      navigateTo(e.target.href)
    }
  })

  router()
})