// GitHub REST API client for repository import / push / pull.
//
// This is the repository counterpart to Gist.ts (which handles the OAuth gist
// export). Public repositories can be read anonymously; a Personal Access Token
// (PAT) is only required once the unauthenticated rate limit is exhausted, for
// private repositories, or for pushing. The PAT is stored separately from the
// OAuth gist credentials (see utils loadConfig -> config.credentials.githubPat).

const API = 'https://api.github.com'

/** Files at/above this size must be fetched via the blob API (the contents API
 *  caps at 1 MB); they get a "large" badge in the import listing. */
export const LARGE_FILE = 1024 * 1024
/** GitHub blobs cannot exceed 100 MB — such files are flagged and skipped. */
export const MAX_BLOB = 100 * 1024 * 1024

export interface RepoRef {
  owner: string
  repo: string
  branch?: string
  path?: string
}

export interface TreeItem {
  path: string
  type: 'blob' | 'tree'
  size?: number
  sha: string
}

export interface GitHubError {
  error: 'rate_limit' | 'auth' | 'not_found' | 'network' | 'other'
  message: string
  resetAt?: number
}

export function isError(value: any): value is GitHubError {
  return value && typeof value === 'object' && typeof value.error === 'string'
}

/**
 * Parse a user supplied repository reference. Accepts:
 *   - "owner/repo"
 *   - "https://github.com/owner/repo"
 *   - "https://github.com/owner/repo/tree/<branch>/<path...>"
 *   - "git@github.com:owner/repo.git"
 * Returns null if no owner/repo could be extracted.
 */
export function parseRepoUrl(input: string): RepoRef | null {
  let s = (input || '').trim()
  if (!s) return null

  // git@github.com:owner/repo.git
  s = s.replace(/^git@github\.com:/, 'https://github.com/')
  // strip protocol + host
  s = s.replace(/^https?:\/\/(www\.)?github\.com\//, '')
  s = s.replace(/^https?:\/\/(www\.)?raw\.githubusercontent\.com\//, '')
  s = s.replace(/\.git$/, '')

  const parts = s.split('/').filter((p) => p.length > 0)
  if (parts.length < 2) return null

  const owner = parts[0]
  const repo = parts[1]
  let branch: string | undefined
  let path: string | undefined

  // owner/repo/tree/<branch>/<path...>  or  owner/repo/blob/<branch>/<path...>
  if (parts.length > 3 && (parts[2] === 'tree' || parts[2] === 'blob')) {
    branch = parts[3]
    if (parts.length > 4) path = parts.slice(4).join('/')
  }

  return { owner, repo, branch, path }
}

function headers(pat?: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (pat) h.Authorization = 'Bearer ' + pat
  return h
}

/**
 * Central request wrapper that maps GitHub's HTTP/JSON errors onto a small set
 * of structured GitHubError values so the UI can react (e.g. show the PAT help
 * on rate_limit / auth). On success it returns the parsed JSON body.
 */
async function request(url: string, pat?: string, init?: RequestInit): Promise<any | GitHubError> {
  let response: Response
  try {
    response = await fetch(url, { ...init, headers: { ...headers(pat), ...(init?.headers || {}) } })
  } catch (e) {
    console.warn(e)
    return { error: 'network', message: 'Could not reach GitHub' }
  }

  if (response.ok) {
    if (response.status === 204) return {}
    try {
      return await response.json()
    } catch (e) {
      return { error: 'other', message: 'Invalid response from GitHub' }
    }
  }

  let body: any = {}
  try {
    body = await response.json()
  } catch {
    /* ignore non-JSON error bodies */
  }
  const message = body?.message || `GitHub request failed (${response.status})`

  // Rate limit: 403/429 with the remaining-quota header at zero.
  const remaining = response.headers.get('x-ratelimit-remaining')
  if ((response.status === 403 || response.status === 429) && remaining === '0') {
    const reset = response.headers.get('x-ratelimit-reset')
    return {
      error: 'rate_limit',
      message,
      resetAt: reset ? parseInt(reset, 10) * 1000 : undefined,
    }
  }

  if (response.status === 401 || /bad credentials/i.test(message)) {
    return { error: 'auth', message }
  }
  // A 403 without exhausted quota usually means missing permissions / private.
  if (response.status === 403) {
    return { error: 'auth', message }
  }
  if (response.status === 404) {
    return { error: 'not_found', message }
  }
  return { error: 'other', message }
}

// -----------------------------------------------------------------------------
// read
// -----------------------------------------------------------------------------

export async function getRepoInfo(owner: string, repo: string, pat?: string) {
  return request(`${API}/repos/${owner}/${repo}`, pat)
}

/**
 * Fetch the full recursive tree for `ref` (a branch name, tag or commit sha —
 * GitHub resolves branch names here). Returns only blob/tree entries.
 */
export async function getTree(
  owner: string,
  repo: string,
  ref: string,
  pat?: string
): Promise<{ items: TreeItem[]; truncated: boolean } | GitHubError> {
  const json = await request(
    `${API}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    pat
  )
  if (isError(json)) return json
  const items: TreeItem[] = (json.tree || []).map((t: any) => ({
    path: t.path,
    type: t.type,
    size: t.size,
    sha: t.sha,
  }))
  return { items, truncated: !!json.truncated }
}

export interface RepoTree {
  branch: string
  // head commit sha; "" when the repository is empty (no commits yet)
  commitSha: string
  items: TreeItem[]
  truncated: boolean
  empty: boolean
}

/**
 * Resolve a repository's branch + recursive file tree in one call. An *empty*
 * repository (no commits/branch yet) is reported as `empty: true` with an empty
 * item list rather than as an error, so callers can seed an empty README.md
 * instead of failing.
 */
export async function loadRepoTree(
  owner: string,
  repo: string,
  branchHint: string | undefined,
  pat?: string
): Promise<RepoTree | GitHubError> {
  let branch = branchHint
  if (!branch) {
    const info = await getRepoInfo(owner, repo, pat)
    if (isError(info)) return info
    branch = info.default_branch || 'main'
  }

  const head = await getRef(owner, repo, branch, pat)
  if (isError(head)) {
    // A missing ref can mean either the repository is empty or it does not
    // exist / is inaccessible. Confirm via the repo endpoint to disambiguate.
    if (head.error === 'not_found') {
      const info = await getRepoInfo(owner, repo, pat)
      if (isError(info)) return info
      return { branch, commitSha: '', items: [], truncated: false, empty: true }
    }
    return head
  }

  const tree = await getTree(owner, repo, head, pat)
  if (isError(tree)) {
    if (tree.error === 'not_found') {
      return { branch, commitSha: head, items: [], truncated: false, empty: true }
    }
    return tree
  }

  return {
    branch,
    commitSha: head,
    items: tree.items,
    truncated: tree.truncated,
    empty: tree.items.length === 0,
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s/g, '')
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunk) as unknown as number[]
    )
  }
  return btoa(binary)
}

/**
 * Download a single blob by sha and return its raw bytes. Using the blob API
 * (instead of the contents API) works uniformly for binary and large files and
 * avoids the 1 MB limit of the contents endpoint (blobs go up to 100 MB).
 */
export async function getBlob(
  owner: string,
  repo: string,
  sha: string,
  pat?: string
): Promise<Uint8Array | GitHubError> {
  const json = await request(`${API}/repos/${owner}/${repo}/git/blobs/${sha}`, pat)
  if (isError(json)) return json
  if (json.encoding === 'base64') return base64ToBytes(json.content || '')
  // tiny/edge case: some blobs come back utf-8 encoded
  return new TextEncoder().encode(json.content || '')
}

// -----------------------------------------------------------------------------
// push (Git Data API: blob -> tree -> commit -> ref)
// -----------------------------------------------------------------------------

/** Get the head commit sha of a branch. */
export async function getRef(
  owner: string,
  repo: string,
  branch: string,
  pat?: string
): Promise<string | GitHubError> {
  const json = await request(
    `${API}/repos/${owner}/${repo}/git/ref/${encodeURIComponent('heads/' + branch)}`,
    pat
  )
  if (isError(json)) return json
  return json.object?.sha
}

/** Get the tree sha referenced by a commit. */
export async function getCommit(
  owner: string,
  repo: string,
  commitSha: string,
  pat?: string
): Promise<{ treeSha: string } | GitHubError> {
  const json = await request(`${API}/repos/${owner}/${repo}/git/commits/${commitSha}`, pat)
  if (isError(json)) return json
  return { treeSha: json.tree?.sha }
}

export async function createBlob(
  owner: string,
  repo: string,
  data: Uint8Array,
  pat: string
): Promise<string | GitHubError> {
  const json = await request(`${API}/repos/${owner}/${repo}/git/blobs`, pat, {
    method: 'POST',
    body: JSON.stringify({ content: bytesToBase64(data), encoding: 'base64' }),
  })
  if (isError(json)) return json
  return json.sha
}

export interface TreeChange {
  path: string
  // a blob sha to add/update, or null to delete the path
  sha: string | null
}

export async function createTree(
  owner: string,
  repo: string,
  baseTreeSha: string,
  changes: TreeChange[],
  pat: string
): Promise<string | GitHubError> {
  const tree = changes.map((c) =>
    c.sha === null
      ? { path: c.path, mode: '100644', type: 'blob', sha: null }
      : { path: c.path, mode: '100644', type: 'blob', sha: c.sha }
  )
  const json = await request(`${API}/repos/${owner}/${repo}/git/trees`, pat, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTreeSha, tree }),
  })
  if (isError(json)) return json
  return json.sha
}

export async function createCommit(
  owner: string,
  repo: string,
  message: string,
  treeSha: string,
  parentSha: string,
  pat: string
): Promise<string | GitHubError> {
  const json = await request(`${API}/repos/${owner}/${repo}/git/commits`, pat, {
    method: 'POST',
    body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
  })
  if (isError(json)) return json
  return json.sha
}

export async function updateRef(
  owner: string,
  repo: string,
  branch: string,
  commitSha: string,
  pat: string
): Promise<{ sha: string } | GitHubError> {
  const json = await request(
    `${API}/repos/${owner}/${repo}/git/refs/${encodeURIComponent('heads/' + branch)}`,
    pat,
    {
      method: 'PATCH',
      body: JSON.stringify({ sha: commitSha, force: false }),
    }
  )
  if (isError(json)) return json
  return { sha: json.object?.sha }
}

/**
 * Compute the git blob SHA-1 of `data` (the same hash git/GitHub store in the
 * tree). Lets us detect modified files locally without downloading the remote
 * content: `sha("blob <len>\0<bytes>")`.
 */
export async function gitBlobSha(data: Uint8Array): Promise<string> {
  const header = new TextEncoder().encode(`blob ${data.length}\0`)
  const full = new Uint8Array(header.length + data.length)
  full.set(header, 0)
  full.set(data, header.length)
  const digest = await crypto.subtle.digest('SHA-1', full)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export { bytesToBase64, base64ToBytes }
