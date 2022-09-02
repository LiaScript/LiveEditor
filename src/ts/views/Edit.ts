import '../globals.d'

import * as Config from '../../config.json'

import AbstractView from './AbstractView'

import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { WebrtcProvider } from 'y-webrtc'
import { MonacoBinding } from 'y-monaco'
import * as monaco from 'monaco-editor'
import * as Utils from '../utils'
import * as GitHub from './Helper/GitHub'

// @ts-ignore
import JSONWorker from 'url:monaco-editor/esm/vs/language/json/json.worker.js'
// @ts-ignore
import CSSWorker from 'url:monaco-editor/esm/vs/language/css/css.worker.js'
// @ts-ignore
import HTMLWorker from 'url:monaco-editor/esm/vs/language/html/html.worker.js'
// @ts-ignore
import TSWorker from 'url:monaco-editor/esm/vs/language/typescript/ts.worker.js'
// @ts-ignore
import EditorWorker from 'url:monaco-editor/esm/vs/editor/editor.worker.js'

import { Snippets } from './Helper/Snippets'

import * as Global from '../globals/init'

self.MonacoEnvironment = {
  getWorkerUrl: function (moduleId, label) {
    if (label === 'json') {
      return JSONWorker
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return CSSWorker
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return HTMLWorker
    }
    if (label === 'typescript' || label === 'javascript') {
      return TSWorker
    }
    return EditorWorker
  },
}

Global.init()

window.liaReady = function (params) {
  const iframe = <HTMLIFrameElement>document.getElementById('liascript-preview')

  if (iframe && iframe.contentWindow?.LIA) {
    iframe.contentWindow.LIA.onReady = window.LIA.onReady

    // only inject if key has been defined
    if (Config.responsiveVoiceKey) {
      iframe.contentWindow.LIA.injectResposivevoice(Config.responsiveVoiceKey)
    }
  }

  if (!window.LIA.isReady) {
    window.LIA.isReady = true

    var value = window.LIA.editor?.getValue()

    window.LIA.init(value, callback)

    delSpinner(1000)
  }
}

function delSpinner(time: number) {
  setTimeout(() => {
    const spinner = document.getElementById(Global.SPINNER)

    if (spinner) {
      spinner.remove()
    }
  }, time)
}

window.LIA.fork = function () {
  const id = Utils.randomString(24)
  const yDoc = new Y.Doc()
  const yText = yDoc.getText(id)

  yText.insert(0, window.LIA.editor.getValue())

  const indexeddbProvider = new IndexeddbPersistence(id, yDoc)

  setTimeout(() => {
    window.location.search = '/edit/' + id
  }, 500)
}

function callback() {
  window.LIA.preview.lineGoto = function (line: number) {
    window.LIA.editor?.setPosition({ lineNumber: line + 1, column: 0 })
    window.LIA.editor?.revealLineNearTop(line + 1)
    window.LIA.editor?.focus()
  }

  delSpinner(1000)
}

export default class extends AbstractView {
  private provider?: WebrtcProvider
  private indexeddbProvider?: IndexeddbPersistence
  protected title: string = 'Lia[Edit]'

  constructor(params: any, _: any) {
    super(params)
    this.setTitle('Lia[Edit]')

    if (!params.id) {
      window.location.search = '/edit/' + Utils.randomString(24)
      return
    }

    this.index.maybeInit(params.id)

    this.loadConfig()

    this.initPreview()
  }

  initPreview() {
    const id = this.params.id?.length > 8 ? this.params.id : null
    const db = this.index

    window.LIA.onReady = (params) => {
      if (id) {
        const titleMatch = window.LIA.editor?.getValue().match(/^# (.+)/m)

        if (titleMatch) params.title = titleMatch[1]

        db.put(id, params)
      }
    }
  }

  initEditor(code: string) {
    window.LIA.editor = monaco.editor.create(
      document.getElementById('liascript-editor'),
      {
        value: code,
        language: 'markdown',
        theme: this.config.lights ? 'vs-light' : 'vs-dark',
        automaticLayout: true,
      }
    )

    window.LIA.editor.addAction({
      // An unique identifier of the contributed action.
      id: 'compile',

      // A label of the action that will be presented to the user.
      label: 'LiaScript compile',

      // An optional array of keybindings for the action.
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S],

      // A precondition for this action.
      precondition: null,

      // A rule to evaluate on top of the precondition in order to dispatch the keybindings.
      keybindingContext: null,

      contextMenuGroupId: 'navigation',

      contextMenuOrder: 1.5,

      // Method that will be executed when the action is triggered.
      // @param editor The editor instance is passed in as a convenience
      run: function (_: any) {
        window.LIA.compile()
      },
    })

    monaco.languages.registerCompletionItemProvider('markdown', {
      //triggerCharacters: ['['],
      provideCompletionItems: function (model, position, context) {
        const word = model.getWordAtPosition(position)

        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        })

        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        }

        const suggestions = []

        if (textUntilPosition.match(/(lia|hili|voice).*$/m)) {
          for (const snippet of Snippets) {
            suggestions.push({
              label: snippet.label,
              kind: monaco.languages.CompletionItemKind.Text,
              documentation: snippet.documentation,
              insertText: snippet.insertText,
              range: range,
              command: { id: 'editor.action.insertLineAfter' },
            })
          }
        }

        return { suggestions }
      },
    })

    monaco.languages.registerCodeActionProvider('markdown', {
      provideCodeActions(model, range, token) {
        if (window.LIA.isCtrlPressed) {
          window.LIA.isCtrlPressed = false
          window.LIA?.preview?.gotoLine(range.startLineNumber - 1)
        }

        return undefined
      },
    })

    window.LIA.editor?.onKeyDown((e) => {
      if (e.keyCode == 5) {
        window.LIA.isCtrlPressed = true
      }
    })

    window.LIA.editor?.onKeyUp((e) => {
      if (e.keyCode == 5) {
        window.LIA.isCtrlPressed = false
      }
    })
  }

  init() {
    this.initEditor('')

    const yDoc = new Y.Doc()
    this.provider = new WebrtcProvider(this.params.id, yDoc, {
      // @ts-ignore
      url: 'https//signaling.simplewebrtc.com:443/',
    })

    this.indexeddbProvider = new IndexeddbPersistence(this.params.id, yDoc)

    const awareness = this.provider.awareness

    awareness.setLocalStateField('user', this.config.user)

    let status

    this.provider.on('status', (event) => {
      console.log('-----------------------------', event.status) // logs "connected" or "disconnected"
      status = event.status
      if (event.status === 'connected') {
      }
    })

    awareness.on('change', (changes) => {
      // Whenever somebody updates their awareness information,
      // we log all awareness information from all users.
      const users = document.getElementById('number_of_users')

      if (users) {
        users.innerText = '' + Array.from(awareness.getStates().values()).length
      }
    })

    const monacoBinding = new MonacoBinding(
      yDoc.getText(this.params.id),
      window.LIA.editor.getModel(),
      new Set([window.LIA.editor]),
      awareness
    )
  }

  navigation(): string {
    return `
      <nav class="navbar navbar-expand-lg bg-light">
        <div class="container-fluid">
          <a class="navbar-brand" href="./">${this.title}</a>

          <div class="btn-toolbar btn-group-sm" role="toolbar" aria-label="Toolbar with button groups">
            <div class="btn-group btn-outline-secondary me-2" role="group" aria-label="Basic radio toggle button group">
              <input 
                type="radio"
                class="btn-check"
                name="btnradio"
                id="btnradio1"
                autocomplete="off"
            
                onclick="window.LIA.showMode(0)"
              >
              <label
                class="btn btn-outline-secondary"
                for="btnradio1"
                title="Editor only"
              >
                <i class="bi bi-pencil"></i>
              </label>
      
              <input
                type="radio"
                class="btn-check"
                name="btnradio"
                id="btnradio2"
                autocomplete="off"
                checked
            
                onclick="window.LIA.showMode(2)"
              >
              <label
                class="btn btn-outline-secondary"
                for="btnradio2"
                title="Split view"
              >
                <i class="bi bi-layout-split"></i>
              </label>
      
              <input
                type="radio"
                class="btn-check"
                name="btnradio"
                id="btnradio3"
                autocomplete="off"
                onclick="window.LIA.showMode(1)"
              >
              <label
                class="btn btn-outline-secondary"
                for="btnradio3"
                title="Preview only"
              >
                <i class="bi bi-eye"></i>
              </label>
            </div>

            <button
              type="button"
              class="btn btn-outline-secondary me-2 px-3"
              onclick="window.LIA.compile()"

              title="Compile (Ctrl+S)"
            >
              <i class="bi bi-arrow-counterclockwise"></i>
            </button>

            <!--button 
              type="button" 
              class="btn btn-outline-secondary px-3"
              onclick="compile()"

              title="Show help"
            >
              <i class="bi bi-question-circle"></i>
            </button-->
          </div>

          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
          </button>
          
          <div class="collapse navbar-collapse" id="navbarSupportedContent">
            <ul class="navbar-nav me-auto mb-lg-0">
              
            </ul>
            
            <!--div class="container-fluid"-->
              
                <div class="navbar-nav mb-2 mb-lg-0">

                  <div class="nav-item nav-item-sm ml-4 me-4">
                    <a class="nav-link" aria-current="page" href="./?/edit" title="Create a new and empty document">
                      <i class="bi bi-plus"></i>
                      New
                    </a>
                  </div>

                <div class="nav-item me-4">
                  <button type="button" class="btn nav-link btn-link" onclick="window.LIA.fork()" title="Create a copy of this document">
                    <i class="bi bi-bezier2"></i> Fork
                  </button>
                </div>

                  <div class="nav-item dropdown me-4" >
                    <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                      Menu
                    </a>
              
                    <ul class="dropdown-menu">
                      <li>
                        <h6 class="dropdown-header fw-light">
                          Share editor ...
                        </h6>
                      </li>
                      <li>
                        <button id="${
                          Global.COLLABORATION
                        }" class="btn dropdown-item btn-link" onclick="window.LIA.share('url')">
                          collaboration link
                        </button>
                      </li>
                      <li>
                        <button class="btn dropdown-item btn-link" onclick="window.LIA.share('zip')">
                          snapshot url
                        </button>
                      </li>
                      <li>
                        <button class="btn dropdown-item btn-link" onclick="window.LIA.share('file')">
                          external resource
                        </button>
                      </li>
                      <li><hr class="dropdown-divider"></li>
                      <li>
                        <h6 class="dropdown-header fw-light">
                          Share course via ...
                        </h6>
                      </li>
                      <li><a class="dropdown-item" href="#">direct link</a></li>
                      <li><hr class="dropdown-divider"></li>
                      <li>
                        <h6 class="dropdown-header fw-light">
                          Download ...
                        </h6>
                      </li>
                      <li>
                        <button class="btn dropdown-item btn-link" onclick="window.LIA.download()">
                          README.md
                        </button>
                      </li>
                      <li><hr class="dropdown-divider"></li>
                      <li>
                        <h6 class="dropdown-header fw-light">
                          Export to...
                        </h6>
                      </li>
                      <li>
                        <a id="${
                          Global.GIST
                        }" class="btn dropdown-item btn-link" aria-current="page" target="_blank" href="${Utils.urlPath(
      ['export', 'github']
    )}/${this.params.id}" title="Store the document on github">
                          GitHub gist
                        </a>
                      </li>
                    </ul>
                  </div>
                
                
                  
                    <span class="btn btn-primary" id="${Global.USERS}">
                      <i class="bi bi-people-fill"></i>
                      <span id="number_of_users">1</span>
                        ONLINE
                      </span>
                    </span>
                  
                </div>    
        
              


            <!--/div-->
          </div>
        </nav>`
  }

  body(): string {
    return `
    <div class="container p-0" style="max-width:100%">
      <div id="liascript-ide" class="row align-items-start p-0 m-0 flex-nowrap" style="height: calc(100vh - 56px);">
        <div class="col-6 w-50 p-0 h-100" id="${Global.EDITOR}">
          <div class="col w-100 p-0 h-100" id="liascript-editor"></div>
        </div>

        <div class="col-6 w-50 h-100 p-0" id="${Global.PREVIEW}">
          <div id="${Global.SPINNER}" style="position: absolute; background-color: white; width:50%; height: 100%">
            <div class="spinner-grow" style="width: 5rem; height: 5rem; margin-top: 50%; margin-left: 45%; margin-right: 45%;" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          </div>
          <iframe style="height: 100%; width:100%" id="liascript-preview" src="./liascript/index.html?"></iframe>
        </div>
      </div>
    </div>
    `
  }

  async getHtml(element: HTMLElement) {
    element.innerHTML = this.navigation() + this.body()

    this.init()
  }
}
