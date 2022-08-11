/* This function is only required to generate a random string, that is used
as a personal ID for every peer, since it is not possible at the moment to
get the own peer ID from the beaker browser.
*/
export function randomString(
  length: number = 16,
  chars: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
) {
  // Pick characters randomly
  let str = ''
  for (let i = 0; i < length; i++) {
    str += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return str
}

export function randomColor() {
  return '#' + randomString(6, '0123456789ABCDEF')
}

export function urlPath(path: string[]) {
  return (
    window.location.origin + window.location.pathname + '?/' + path.join('/')
  )
}
