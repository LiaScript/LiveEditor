import { tutorial } from '../views/Helper/Tutorial'

import * as Utils from '../utils'
import * as Shrink from 'shrink-string'

import * as Config from '../../config.json'

export const EDITOR = 'liascript-editor-container'
export const PREVIEW = 'liascript-preview-container'
export const COLLABORATION = 'collaboration-link'
export const USERS = 'online-users-overview'
export const SPINNER = 'preview-overlay'
export const GIST = 'gist-export'

export const modal = (title: string, body: string) => {
  const id = 'modal-container'
  let container = document.getElementById(id)

  if (!container) {
    container = document.createElement('div')
    container.id = id
    document.body.append(container)
  }

  container.innerHTML = `<!-- Modal -->
    <div class="modal fade" id="modal" tabindex="-1" aria-labelledby="exampleModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="exampleModalLabel">${title}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            ${body}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            <!--button type="button" class="btn btn-primary">Save changes</button-->
          </div>
        </div>
      </div>
    </div>`

  // @ts-ignore
  const modal = new bootstrap.Modal(document.getElementById('modal'), {
    'data-bs-toggle': 'modal',
  })

  modal.show()
}

async function share(type?: string) {
  switch (type) {
    case 'url': {
      modal(
        'Collaboration link',

        `
        If you share the link below, the editor will be in collaborative mode.
        Working should also be possible offline, but all connected users will work on the same course.
        If you did receive this via a collaboration link and want to make a complete new course by yourself, then you will have to click onto the "Fork" button, which will create a complete new version.
        
        <hr>

        <a href="${window.location.toString()}">
          ${window.location.toString()}
        </a>`
      )
      break
    }

    case 'zip': {
      const zipCode = await Shrink.compress(window.LIA.editor.getValue())

      modal(
        'Snapshot url',
        `
        Snapshots are URLs that contain the entire course defintion.
        However, this works only for short courses, the longer the course the longer the URL.
        Sharing your editor via a messenger for example, you will have to check first if no parts are truncated!
        Additionally different browser support different lengths of URLs...
                    
        <hr>
        
        <a style="word-break: break-all" href="${Utils.urlPath([
          'show',
          'code',
          zipCode,
        ])}">
          ${Utils.urlPath(['show', 'code', zipCode])}
        </a>`
      )

      break
    }

    case 'file': {
      const fileUrl = prompt(
        'please insert the URL of a Markdown file you want to share',
        ''
      )

      if (!fileUrl) return

      modal(
        'External resource',
        `
        Use this URL to predefine the content for your share link.
        In this case the editor will at first try to load the Markdown file and insert its content into the editor.
        This link will only work if your Markdown file is accessible via the internet.
                    
        <hr>
        
        <a style="word-break: break-all" href="${Utils.urlPath([
          'show',
          'file',
          fileUrl,
        ])}">
          ${Utils.urlPath(['show', 'file', fileUrl])}
        </a>`
      )
    }
  }
}

function showMode(i: number) {
  const editor = document.getElementById(EDITOR)
  const preview = document.getElementById(PREVIEW)

  if (!editor || !preview) return

  switch (i) {
    // editor only
    case 0: {
      editor.hidden = false
      preview.hidden = true

      editor.classList.replace('w-50', 'w-100')

      break
    }

    // preview only
    case 1: {
      editor.hidden = true
      preview.hidden = false

      preview.classList.replace('w-50', 'w-100')
      break
    }

    // both
    case 2: {
      editor.hidden = false
      preview.hidden = false

      editor.classList.replace('w-100', 'w-50')
      preview.classList.replace('w-100', 'w-50')
      break
    }
  }
}

function compile(code?: string) {
  if (!code && window.LIA.editor) {
    code = window.LIA.editor.getValue()
  }

  window.LIA.init(code || '')
}

function download() {
  if (!window.LIA.editor) {
    console.warn('No editor defined ...')
    return
  }
  const element = document.createElement('a')
  element.setAttribute(
    'href',
    'data:text/plain;charset=utf-8,' +
      encodeURIComponent(window.LIA.editor.getValue())
  )
  element.setAttribute('download', 'README.md')
  element.style.display = 'none'
  document.body.appendChild(element)

  element.click()

  document.body.removeChild(element)
}

export function init() {
  if (!window.LIA) {
    window.LIA = {
      isCtrlPressed: false,

      preview: undefined,

      editor: undefined,

      isReady: false,

      onReady: (params) => {
        console.warn('You need to overwrite window.LIA.onReady')
      },

      init: (code: string, callback?: () => void) => {
        if (window.LIA.preview && window.LIA.preview.jit) {
          window.LIA.preview.focusOnMain = false
          window.LIA.preview.scrollUpOnMain = false

          if (callback) {
            callback()
          }

          if (!code || !code.trim()) {
            console.warn('Empty Document, generating help')
            window.LIA.preview.jit(tutorial)
          } else {
            window.LIA.preview.jit(code)
          }
        } else {
          const iframe = document.getElementById('liascript-preview')
          if (iframe) {
            window.LIA.preview = (<HTMLIFrameElement>iframe).contentWindow?.LIA
          }

          setTimeout(function () {
            window.LIA.init(code, callback)
          }, 100)
        }
      },

      compile: compile,
      showMode: showMode,
      share: share,
      download: download,

      delete: async (id: string) => {
        console.warn('todo')
      },

      fork: async (code: string) => {
        console.warn('todo')
      },
    }
  }
}
