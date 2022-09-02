import Dexie from '../indexDB'
import * as Utils from '../utils'

export default class {
  protected index: Dexie
  protected params: any = {}
  protected config: {
    lights: boolean
    mode: number
    user: {
      name: string
      color: string
    }
    credentials: any
  } = {
    lights: false,
    mode: 2,
    user: {
      name: Utils.randomString(),
      color: Utils.randomColor(),
    },
    credentials: {},
  }

  constructor(params: any, init?: any) {
    this.index = new Dexie()
    this.params = params
  }

  loadConfig() {
    const configString = localStorage.getItem('config')

    if (configString) {
      this.config = JSON.parse(configString)

      if (!this.config.credentials) {
        this.config.credentials = {}
        this.storeConfig()
      }
    } else {
      this.storeConfig()
    }
  }

  storeConfig() {
    localStorage.setItem('config', JSON.stringify(this.config))
  }

  setTitle(title: string) {
    document.title = title
  }

  init() {}

  async getHtml(element?: HTMLElement) {
    if (element) element.innerHTML = ''
  }
}
