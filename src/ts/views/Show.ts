import Edit from './Edit'

import * as Global from '../globals/init'
import * as Shrink from 'shrink-string'

function disable(id: string) {
  const element = <HTMLButtonElement>document.getElementById(id)

  if (element) {
    element.disabled = true
  }
}

function replaceURLs(base: string, code: string): string {
  return code.replace(
    /(\[[^\]]*\]\()(?!(http:|https:|ipfs:|#|\/\/))\.?\/?([^\)]+)/g,
    `$1${base}$3`
  )
}

export default class extends Edit {
  constructor(params: any) {
    params.id = '1'
    super(params)
    this.setTitle('Show')
    this.title = 'Lia[Share]'
  }

  init() {
    let self = this

    if (this.params.code) {
      //code = lzbase62.decompress(this.params.code)
      Shrink.decompress(this.params.code).then((e) => {
        self.showEditor(e)
      })
    } else if (this.params.file) {
      const baseURL = this.params.file.replace(/\/[^\/]*$/, '/')
      fetch(this.params.file)
        .then((response) => response.text())
        .then((readme) => {
          self.showEditor(replaceURLs(baseURL, readme))
          //window.LIA.compile()
        })
    }

    //this.onlyEditor(code)
  }

  showEditor(code: string) {
    this.initEditor(code)

    disable(Global.COLLABORATION)

    const onlineUsers = document.getElementById(Global.USERS)

    if (onlineUsers)
      onlineUsers.classList.replace('btn-primary', 'btn-secondary')
  }
}
