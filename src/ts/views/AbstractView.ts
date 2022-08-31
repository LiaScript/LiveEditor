import Dexie from '../indexDB'

export default class {
  protected index: Dexie
  protected params: any = {}

  constructor(params: any, init?: any) {
    this.index = new Dexie()
    this.params = params
  }

  setTitle(title: string) {
    document.title = title
  }

  init() {}

  async getHtml(element?: HTMLElement) {
    if (element) element.innerHTML = ''
  }
}
