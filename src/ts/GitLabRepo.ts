// GitLab REST API v4 client for repository import / push / pull.
//
// Unlike GitHubRepo.ts, the host is not fixed (gitlab.com) — any GitLab
// instance works (gitlab.com, gitlab.opencode.de, self-hosted, ...), so every
// function takes the host explicitly and the API base URL is built from it.

export const LARGE_FILE = 1024 * 1024
export const MAX_BLOB = 100 * 1024 * 1024

export interface GitLabRef {
  host: string
  projectPath: string
  branch?: string
  path?: string
}

export interface TreeItem {
  path: string
  type: 'blob' | 'tree'
  size?: number
  sha: string
}

export interface GitLabError {
  error: 'rate_limit' | 'auth' | 'not_found' | 'network' | 'other'
  message: string
  resetAt?: number
}

export function isError(value: any): value is GitLabError {
  return value && typeof value === 'object' && typeof value.error === 'string'
}

export function apiBase(host: string): string {
  return `https://${host}/api/v4`
}

/**
 * Parse a user supplied repository reference. Accepts:
 *   - "https://{host}/{namespace...}/{project}"
 *   - "https://{host}/{namespace...}/{project}/-/tree/{branch}/{path...}"
 *   - "git@{host}:{namespace...}/{project}.git"
 * The host is never assumed, so a bare "group/project" (without a scheme) is
 * not accepted — unlike GitHub's parseRepoUrl, there is no default host.
 * Returns null if no host + project path could be extracted.
 */
export function parseGitLabUrl(input: string): GitLabRef | null {
  let s = (input || '').trim()
  if (!s) return null

  const ssh = s.match(/^git@([^:]+):(.+)$/)
  if (ssh) s = `https://${ssh[1]}/${ssh[2]}`

  const m = s.match(/^https?:\/\/([^/]+)\/(.+)$/)
  if (!m) return null
  const host = m[1]
  let rest = m[2].replace(/\.git$/, '').replace(/\/+$/, '')
  if (!rest) return null

  let projectPath = rest
  let branch: string | undefined
  let path: string | undefined

  const dash = rest.indexOf('/-/')
  if (dash !== -1) {
    projectPath = rest.slice(0, dash)
    const parts = rest
      .slice(dash + 3)
      .split('/')
      .filter((p) => p.length > 0)
    if (parts.length > 1 && (parts[0] === 'tree' || parts[0] === 'blob')) {
      branch = parts[1]
      if (parts.length > 2) path = parts.slice(2).join('/')
    }
  }

  return projectPath ? { host, projectPath, branch, path } : null
}

function headers(pat?: string): Record<string, string> {
  const h: Record<string, string> = {}
  if (pat) h['PRIVATE-TOKEN'] = pat
  return h
}

/** Best-effort mapping of GitLab's HTTP/JSON errors onto a small set of
 *  structured GitLabError values. Self-hosted instances don't reliably expose
 *  gitlab.com's rate-limit headers, so a 403 is only classified as rate_limit
 *  when a quota header is actually present; otherwise it's treated as auth. */
function mapError(response: Response, body: any): GitLabError {
  const raw = body?.message
  const message =
    typeof raw === 'string'
      ? raw
      : raw
      ? JSON.stringify(raw)
      : `GitLab request failed (${response.status})`

  if (response.status === 429) {
    const reset = response.headers.get('ratelimit-reset')
    const retryAfter = response.headers.get('retry-after')
    const resetAt = reset
      ? parseInt(reset, 10) * 1000
      : retryAfter
      ? Date.now() + parseInt(retryAfter, 10) * 1000
      : undefined
    return { error: 'rate_limit', message, resetAt }
  }
  if (response.status === 401) return { error: 'auth', message }
  if (response.status === 403) {
    return response.headers.get('ratelimit-remaining') !== null
      ? { error: 'rate_limit', message }
      : { error: 'auth', message }
  }
  if (response.status === 404) return { error: 'not_found', message }
  return { error: 'other', message }
}

async function requestRaw(
  url: string,
  pat?: string,
  init?: RequestInit
): Promise<{ response: Response; json: any } | GitLabError> {
  let response: Response
  // fetch() defaults a string body to "Content-Type: text/plain", which
  // GitLab's API (Grape) rejects outright — before it even looks at the
  // token — with a 400 "Unsupported Content-Type". Every caller here sends
  // JSON, so set it explicitly whenever there's a body.
  const h: Record<string, string> = { ...headers(pat), ...(init?.headers || {}) }
  if (init?.body && !h['Content-Type']) h['Content-Type'] = 'application/json'
  try {
    response = await fetch(url, { ...init, headers: h })
  } catch (e) {
    console.warn(e)
    return { error: 'network', message: 'Could not reach GitLab' }
  }

  let json: any = {}
  if (response.status !== 204) {
    try {
      json = await response.json()
    } catch {
      /* ignore non-JSON bodies (e.g. raw blob endpoints, empty error bodies) */
    }
  }

  if (!response.ok) return mapError(response, json)
  return { response, json }
}

async function request(url: string, pat?: string, init?: RequestInit): Promise<any | GitLabError> {
  const r = await requestRaw(url, pat, init)
  return isError(r) ? r : r.json
}

// -----------------------------------------------------------------------------
// read
// -----------------------------------------------------------------------------

export async function getRepoInfo(host: string, projectPath: string, pat?: string) {
  return request(`${apiBase(host)}/projects/${encodeURIComponent(projectPath)}`, pat)
}

/** The authenticated user (requires a PAT). */
export async function getAuthUser(host: string, pat: string): Promise<{ username: string } | GitLabError> {
  const json = await request(`${apiBase(host)}/user`, pat)
  if (isError(json)) return json
  return { username: json.username }
}

/** Groups (~ GitHub orgs) the authenticated user belongs to. */
export async function listGroups(
  host: string,
  pat: string
): Promise<{ id: number; fullPath: string }[] | GitLabError> {
  const json = await request(`${apiBase(host)}/groups?per_page=100&min_access_level=30`, pat)
  if (isError(json)) return json
  return (json || []).map((g: any) => ({ id: g.id, fullPath: g.full_path }))
}

export interface CreateRepoOptions {
  visibility?: 'public' | 'private' | 'internal'
  description?: string
  // create inside a group namespace instead of the user's personal namespace
  namespaceId?: number
}

/**
 * Create a new project (initialised with a README so the first push is a
 * normal update). Returns its host/projectPath/default branch.
 */
export async function createRepo(
  host: string,
  name: string,
  opts: CreateRepoOptions,
  pat: string
): Promise<{ host: string; projectPath: string; branch: string; webUrl: string } | GitLabError> {
  const json = await request(`${apiBase(host)}/projects`, pat, {
    method: 'POST',
    body: JSON.stringify({
      name,
      visibility: opts.visibility || 'public',
      description: opts.description || '',
      namespace_id: opts.namespaceId,
      initialize_with_readme: true,
    }),
  })
  if (isError(json)) return json
  return {
    host,
    projectPath: json.path_with_namespace || name,
    branch: json.default_branch || 'main',
    webUrl: json.web_url,
  }
}

/** Paginated recursive tree listing. GitLab's tree endpoint doesn't return a
 *  single "give me everything" call like GitHub's git-trees API, so this
 *  loops over `per_page=100` pages using the `x-next-page` response header,
 *  capped so a runaway (or misbehaving) instance can't loop forever. */
export async function getTree(
  host: string,
  projectPath: string,
  ref: string,
  pat?: string
): Promise<{ items: TreeItem[]; truncated: boolean } | GitLabError> {
  const items: TreeItem[] = []
  let page = 1
  // ponytail: hard ceiling (~20k entries at per_page=100) instead of real
  // keyset pagination; raise this or switch to keyset paging if a real repo
  // ever hits it
  const MAX_PAGES = 200

  while (page <= MAX_PAGES) {
    const r = await requestRaw(
      `${apiBase(host)}/projects/${encodeURIComponent(projectPath)}/repository/tree` +
        `?ref=${encodeURIComponent(ref)}&recursive=true&per_page=100&page=${page}`,
      pat
    )
    if (isError(r)) return r
    for (const t of r.json || []) {
      items.push({ path: t.path, type: t.type === 'tree' ? 'tree' : 'blob', sha: t.id })
    }
    const next = r.response.headers.get('x-next-page')
    if (!next) return { items, truncated: false }
    page = parseInt(next, 10)
  }
  return { items, truncated: true }
}

export interface RepoTree {
  branch: string
  commitSha: string
  items: TreeItem[]
  truncated: boolean
  empty: boolean
}

/** Head commit sha of a branch (GitHub's getRef equivalent). */
export async function getBranchHead(
  host: string,
  projectPath: string,
  branch: string,
  pat?: string
): Promise<string | GitLabError> {
  const json = await request(
    `${apiBase(host)}/projects/${encodeURIComponent(projectPath)}/repository/branches/${encodeURIComponent(
      branch
    )}`,
    pat
  )
  if (isError(json)) return json
  return json.commit?.id
}

/**
 * Resolve a project's branch + recursive file tree in one call. An *empty*
 * project (no commits/branch yet) is reported as `empty: true` with an empty
 * item list rather than as an error, so callers can seed an empty README.md
 * instead of failing.
 */
export async function loadRepoTree(
  host: string,
  projectPath: string,
  branchHint: string | undefined,
  pat?: string
): Promise<RepoTree | GitLabError> {
  let branch = branchHint
  if (!branch) {
    const info = await getRepoInfo(host, projectPath, pat)
    if (isError(info)) return info
    branch = info.default_branch
    if (!branch) return { branch: 'main', commitSha: '', items: [], truncated: false, empty: true }
  }

  const head = await getBranchHead(host, projectPath, branch, pat)
  if (isError(head)) {
    // A missing branch can mean either the project is empty or it does not
    // exist / is inaccessible. Confirm via the project endpoint to disambiguate.
    if (head.error === 'not_found') {
      const info = await getRepoInfo(host, projectPath, pat)
      if (isError(info)) return info
      return { branch, commitSha: '', items: [], truncated: false, empty: true }
    }
    return head
  }

  const tree = await getTree(host, projectPath, head, pat)
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

/** Download a single blob by sha and return its raw bytes. */
export async function getBlob(
  host: string,
  projectPath: string,
  sha: string,
  pat?: string
): Promise<Uint8Array | GitLabError> {
  const json = await request(
    `${apiBase(host)}/projects/${encodeURIComponent(projectPath)}/repository/blobs/${sha}`,
    pat
  )
  if (isError(json)) return json
  return base64ToBytes(json.content || '')
}

// -----------------------------------------------------------------------------
// push (single commit-with-actions call — no separate blob/tree/commit/ref
// dance like GitHub's Git Data API)
// -----------------------------------------------------------------------------

export interface CommitAction {
  action: 'create' | 'update' | 'delete'
  file_path: string
  content?: string
  encoding?: 'base64'
}

export async function createCommit(
  host: string,
  projectPath: string,
  branch: string,
  message: string,
  actions: CommitAction[],
  pat: string
): Promise<{ id: string } | GitLabError> {
  const json = await request(
    `${apiBase(host)}/projects/${encodeURIComponent(projectPath)}/repository/commits`,
    pat,
    {
      method: 'POST',
      body: JSON.stringify({ branch, commit_message: message, actions }),
    }
  )
  if (isError(json)) return json
  return { id: json.id }
}

/**
 * Compute the git blob SHA-1 of `data` (the same hash git/GitLab store in the
 * tree). Lets us detect modified files locally without downloading the remote
 * content: `sha("blob <len>\0<bytes>")`. Identical algorithm to GitHubRepo's,
 * duplicated here so this module has no dependency on GitHubRepo.ts.
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
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[])
  }
  return btoa(binary)
}

export { bytesToBase64, base64ToBytes }
