import * as Utils from './utils'

function proxy(url: string) {
  if (process.env.PROXY) {
    return process.env.PROXY + encodeURIComponent(url)
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
  if (
    params.startsWith(
      'data:application/x-www-form-urlencoded; charset=utf-8;base64,'
    )
  ) {
    params = params.split(',')[1]
    params = atob(params)
  }
  return Object.fromEntries(params.split('&').map((e) => e.split('=')))
}

export function authorize(documentId) {
  const URL = 'https://github.com/login/oauth/authorize/'

  window.location.href = addParams(URL, [
    ['client_id', process.env.GITHUB_CLIENT_ID],
    ['scope', 'gist'],
    ['redirect_uri', Utils.urlPath(['export', 'github']) + '/'],
    ['state', documentId],
  ])
}

export async function access_token(code: string) {
  try {
    const response = await fetch(
      proxy(
        addParams('https://github.com/login/oauth/access_token', [
          ['client_id', process.env.GITHUB_CLIENT_ID || ''],
          ['client_secret', process.env.GITHUB_CLIENT_SECRET || ''],
          ['code', code],
        ])
      ),
      { method: 'post' }
    )

    const json = await response.json()

    // headers not working that is why contents has to be split manually
    const credentials = getParams(json.contents)

    return credentials
  } catch (e) {
    console.warn(e)
    return
  }
}

export async function gistUpload(
  credentials: any,
  title: string,
  comment: string,
  content: string,
  gist_id?: string
) {
  const gist = {
    description: comment,
    public: true,
    files: {},
  }

  const filename = title + '.md'

  gist.files[filename] = {
    content: content,
  }

  if (gist_id) {
    gist_id = '/' + gist_id
  } else {
    gist_id = ''
  }

  const response = await fetch('https://api.github.com/gists' + gist_id, {
    headers: {
      'User-Agent': 'LiaScript',
      Authorization: credentials.token_type + ' ' + credentials.access_token,
      Accept: 'application/vnd.github+json',
    },
    method: 'post',
    body: JSON.stringify(gist),
  })

  const json = await response.json()

  // the gist does not exist anymore (has been deleted)
  if (json.message == 'Not Found') {
    return await gistUpload(credentials, title, comment, content)
  }
  // probably the user has revoked the credentials,
  // need to revoke ...
  else if (json.message == 'Bad credentials') {
    return {
      error: 'Bad credentials',
      message: json.message,
    }
  }

  return {
    url: json.html_url,
    id: json.id,
    raw_url: json.files[filename]?.raw_url,
    message: json.message,
  }
}
