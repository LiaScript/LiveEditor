import Index from './views/Index'
import Edit from './views/Edit'
import Show from './views/Show'
import Export from './views/Export'

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

const navigateTo = (url) => {
  history.pushState(null, null, url)
  router()
}

const router = async () => {
  if (location.pathname.startsWith('liascript')) {
    return
  }

  const routes = [
    { path: '/', view: Index },
    { path: '/edit', view: Edit },
    { path: '/edit/:id', view: Edit },
    { path: '/show/code/:code', view: Show },
    { path: '/show/file/:file', view: Show },
    {
      path: '/export/github/&code=:code&state=:state',
      view: Export,
      init: 'github',
    },
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

  const view = new match.route.view(getParams(match), match.route.init)

  view.getHtml(document.body)
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
