// Shared helpers for displaying files outside the main FileExplorer (e.g. the
// GitHub import/push/pull dialogs). Keeps the Bootstrap-Icons mapping in one
// place so the GitHub file tree looks consistent with the explorer.

const EXT_ICONS: Record<string, string> = {
  md: 'bi-filetype-md', markdown: 'bi-filetype-md', lia: 'bi-filetype-md',
  txt: 'bi-filetype-txt', text: 'bi-filetype-txt', log: 'bi-filetype-txt',
  pdf: 'bi-filetype-pdf',
  csv: 'bi-filetype-csv', tsv: 'bi-filetype-csv',
  html: 'bi-filetype-html', htm: 'bi-filetype-html',
  css: 'bi-filetype-css', scss: 'bi-filetype-scss', sass: 'bi-filetype-sass',
  xml: 'bi-filetype-xml', svg: 'bi-filetype-svg',
  js: 'bi-filetype-js', mjs: 'bi-filetype-js', cjs: 'bi-filetype-js',
  jsx: 'bi-filetype-jsx', ts: 'bi-filetype-tsx', tsx: 'bi-filetype-tsx',
  json: 'bi-filetype-json', jsonc: 'bi-filetype-json',
  yml: 'bi-filetype-yml', yaml: 'bi-filetype-yml',
  py: 'bi-filetype-py', php: 'bi-filetype-php', rb: 'bi-filetype-rb',
  java: 'bi-filetype-java',
  sh: 'bi-filetype-sh', bash: 'bi-filetype-sh', zsh: 'bi-filetype-sh',
  sql: 'bi-filetype-sql',
  png: 'bi-filetype-png', jpg: 'bi-filetype-jpg', jpeg: 'bi-filetype-jpg',
  gif: 'bi-filetype-gif',
  bmp: 'bi-file-earmark-image', webp: 'bi-file-earmark-image',
  avif: 'bi-file-earmark-image', ico: 'bi-file-earmark-image',
  mp4: 'bi-filetype-mp4', mov: 'bi-filetype-mov',
  webm: 'bi-file-earmark-play', ogv: 'bi-file-earmark-play', ogg: 'bi-file-earmark-play',
  avi: 'bi-file-earmark-play', mkv: 'bi-file-earmark-play', m4v: 'bi-file-earmark-play',
  mp3: 'bi-filetype-mp3', wav: 'bi-filetype-wav', aac: 'bi-file-earmark-music',
  vue: 'bi-file-earmark-code',
}

/** Bootstrap-Icons class for a file or folder. */
export function iconFor(name: string, isFolder: boolean, expanded = false): string {
  if (isFolder) return expanded ? 'bi-folder2-open' : 'bi-folder'
  const ext = name.split('.').pop()?.toLowerCase() || ''
  return EXT_ICONS[ext] ?? 'bi-file-earmark'
}

/** Human readable byte size, e.g. "1.4 MB". */
export function formatBytes(size?: number): string {
  if (size == null) return ''
  if (size < 1024) return size + ' B'
  const units = ['KB', 'MB', 'GB']
  let value = size / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return value.toFixed(value < 10 ? 1 : 0) + ' ' + units[i]
}
