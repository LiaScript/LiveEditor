import AbstractView from './AbstractView'

import * as Config from '../../config.json'
import * as Utils from '../utils'

export default class extends AbstractView {
  protected type?: string

  constructor(params: any, init?: string) {
    super(params)
    this.type = init

    this.setTitle('Lia[Export]')
  }

  async getHtml(element?: HTMLElement) {
    switch (this.type) {
      case 'github': {
        const response = await fetch(
          `https://github.com/login/oauth/access_token?client_id=${
            Config.github.clientId
          }&client_secret=${Config.github.clientSecret}&code=${
            this.params.code
          }&state=${this.params.state}&redirect_uri=${Utils.urlPath([
            'export',
            'github',
          ])}/`,
          { method: 'post' }
        )

        /*
        const response = await fetch(
          `https://github.com/login/oauth/access_token`,
          {
            method: 'post',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              client_id: Config.github.clientId,
              client_secret: Config.github.clientSecret,
              code: this.params.code,
              state: this.params.state,
              redirect_uri: Utils.urlPath(['export', 'github']),
            }),
          }
        )
        */

        const access_token = await response.json()

        console.warn('access_token', response, access_token)

        if (element) element.innerHTML = '---' + JSON.stringify(this.params)
        break
      }

      default: {
        console.warn('unknown service: ', this.params.type)
      }
    }
  }
}
