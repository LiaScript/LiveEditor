export const LiaScriptURL =
  process.env.LIASCRIPT || 'https://liascript.github.io/course/'

export const LiveEditorURL = window.location.origin + window.location.pathname

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

const CONFIG = 'config'

export interface EditorConfig {
  fontSize: number
  fontFamily: string
  lineNumbers: 'on' | 'off' | 'relative'
  minimap: boolean
  wordWrap: 'on' | 'off'
  tabSize: number
  insertSpaces: boolean
  renderWhitespace: 'none' | 'boundary' | 'all'
  folding: boolean
  bracketPairColorization: boolean
  smoothScrolling: boolean
  wordBasedSuggestions: boolean
  cursorBlinking: 'blink' | 'smooth' | 'solid'
}

const DEFAULT_EDITOR_CONFIG: EditorConfig = {
  fontSize: 14,
  fontFamily: 'Monospace',
  lineNumbers: 'on',
  minimap: false,
  wordWrap: 'on',
  tabSize: 4,
  insertSpaces: true,
  renderWhitespace: 'boundary',
  folding: true,
  bracketPairColorization: true,
  smoothScrolling: false,
  wordBasedSuggestions: false,
  cursorBlinking: 'blink',
}

export function loadConfig(): {
  lights: boolean
  mode: number
  user: {
    name: string
    color: string
  }
  credentials: any
  editor: EditorConfig
} {
  const configString = localStorage.getItem(CONFIG)

  let config

  if (configString) {
    config = JSON.parse(configString)

    if (!config.credentials) {
      config.credentials = {}
      storeConfig(config)
    }

    if (!config.editor) {
      config.editor = { ...DEFAULT_EDITOR_CONFIG }
      storeConfig(config)
    }
  } else {
    config = {
      lights: false,
      mode: 2,
      user: {
        name: randomString(),
        color: randomColor(),
      },
      credentials: {},
      editor: { ...DEFAULT_EDITOR_CONFIG },
    }

    storeConfig(config)
  }

  return config
}

export function storeConfig(config: {
  lights: boolean
  mode: number
  user: {
    name: string
    color: string
  }
  credentials: any
  editor?: EditorConfig
}) {
  localStorage.setItem(CONFIG, JSON.stringify(config))
}

/** GitHub Personal Access Token used for the repository import/push/pull.
 *  Stored separately from the OAuth gist credentials. */
export function getGithubPat(): string | undefined {
  return loadConfig().credentials?.githubPat || undefined
}

export function setGithubPat(pat: string | undefined) {
  const config = loadConfig()
  if (!config.credentials) config.credentials = {}
  config.credentials.githubPat = pat || undefined
  storeConfig(config)
}

/** A binary project file as returned by `Editor.getAllBlobs()`. */
export interface ProjectBlob {
  name: string
  data: Uint8Array | ArrayBuffer | Blob
}

/** Bundle the whole project (main document + all explorer files) into a single
 *  ZIP. The main document is written as `README.md`, matching what the
 *  LiaScript-Exporter expects as the entry point. Returns a `File` so it can be
 *  downloaded or posted/postMessage'd as-is.
 *
 *  Shared by the "download as ZIP" menu action and the LiaScript-Exporter
 *  integration so both ship exactly the same content. */
export async function buildProjectZip(
  mainContent: string,
  blobs: ProjectBlob[] | undefined | null,
  fileName = 'project.zip'
): Promise<File> {
  // jszip is a CommonJS module; depending on the bundler/interop the dynamic
  // import exposes the constructor either as the namespace itself or under
  // `.default` (and dev vs prod builds can differ), so pick whichever is
  // actually callable.
  const mod: any = await import('jszip')
  const JSZip =
    typeof mod === 'function'
      ? mod
      : typeof mod.default === 'function'
        ? mod.default
        : mod.default && typeof mod.default.default === 'function'
          ? mod.default.default
          : undefined
  if (!JSZip) throw new Error('Could not load JSZip')
  const zip = new JSZip()

  zip.file('README.md', mainContent)

  if (blobs) {
    for (const blob of blobs) {
      zip.file(blob.name, blob.data as any)
    }
  }

  const content = await zip.generateAsync({ type: 'blob' })
  return new File([content], fileName, { type: 'application/zip' })
}

export function getAllSupportedVideoCodecs() {
  return getAllSupportedCodecs('video')
}

export function getAllSupportedCodecs(...mediaTypes: string[]) {
  if (!mediaTypes.length) mediaTypes.push('video', 'audio')
  const CONTAINERS = [
    'webm',
    'ogg',
    'mp3',
    'mp4',
    'x-matroska',
    '3gpp',
    '3gpp2',
    '3gp2',
    'quicktime',
    'mpeg',
    'aac',
    'flac',
    'x-flac',
    'wave',
    'wav',
    'x-wav',
    'x-pn-wav',
    'not-supported',
  ]
  const CODECS = [
    'vp9',
    'vp9.0',
    'vp8',
    'vp8.0',
    'avc1',
    'av1',
    'h265',
    'h.265',
    'h264',
    'h.264',
    'opus',
    'vorbis',
    'pcm',
    'aac',
    'mpeg',
    'mp4a',
    'rtx',
    'red',
    'ulpfec',
    'g722',
    'pcmu',
    'pcma',
    'cn',
    'telephone-event',
    'not-supported',
  ]

  return [
    ...new Set(
      CONTAINERS.flatMap((ext) =>
        mediaTypes.flatMap((mediaType) => [`${mediaType}/${ext}`])
      )
    ),
    ...new Set(
      CONTAINERS.flatMap((ext) =>
        CODECS.flatMap((codec) =>
          mediaTypes.flatMap((mediaType) => [
            // NOTE: 'codecs:' will always be true (false positive)
            `${mediaType}/${ext};codecs=${codec}`,
          ])
        )
      )
    ),
    ...new Set(
      CONTAINERS.flatMap((ext) =>
        CODECS.flatMap((codec1) =>
          CODECS.flatMap((codec2) =>
            mediaTypes.flatMap((mediaType) => [
              `${mediaType}/${ext};codecs="${codec1}, ${codec2}"`,
            ])
          )
        )
      )
    ),
  ].filter((variation) => MediaRecorder.isTypeSupported(variation))
}
