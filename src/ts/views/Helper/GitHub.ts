import * as Config from '../../../config.json'
import * as Utils from '../../utils'

function proxy(url: string) {
  if (Config.proxy) {
    return Config.proxy + encodeURIComponent(url)
  }

  return url
}

function addParams(url: string, params: [key: string, value: string][]) {
  if (params.length > 0) {
    url += '?' + params[0][0] + '=' + params[0][1]

    for (let i = 1; i < params.length; i++) {
      url += '&' + params[i][0] + '=' + params[i][1]
    }
  }

  return url
}

function getParams(params: string) {
  return Object.fromEntries(params.split('&').map((e) => e.split('=')))
}

export function authorization_URL(documentId) {
  const URL = 'https://github.com/login/oauth/authorize/'

  return addParams(URL, [
    ['client_id', Config.github.clientId],
    ['scope', 'gist'],
    ['redirect_uri', Utils.urlPath(['export', 'github']) + '/'],
    ['state', documentId],
  ])
}

export async function gist_Upload(
  code: string,
  title: string,
  comment: string,
  content: string,
  gist_id?: string
) {
  const response = await fetch(
    proxy(
      addParams('https://github.com/login/oauth/access_token', [
        ['client_id', Config.github.clientId],
        ['client_secret', Config.github.clientSecret],
        ['code', code],
      ])
    ),
    { method: 'post' }
  )

  const json = await response.json()

  // headers not working that is why contents has to be split manually
  const contents = getParams(json.contents)

  const gist = {
    description: comment,
    public: true,
    files: {},
  }

  gist.files[`${title}.md`] = {
    content: content,
  }

  if (gist_id) {
    gist_id = '/' + gist_id
  } else {
    gist_id = ''
  }

  const response2 = await fetch('https://api.github.com/gists' + gist_id, {
    headers: {
      'User-Agent': 'LiaScript',
      Authorization: contents.token_type + ' ' + contents.access_token,
      Accept: 'application/vnd.github+json',
    },
    method: 'post',
    body: JSON.stringify(gist),
  })

  const json2 = await response2.json()

  return { url: json2.html_url, id: json2.id }
}
