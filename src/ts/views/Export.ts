import AbstractView from './AbstractView'

import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import * as GitHub from './Helper/GitHub'
import { urlPath } from '../utils'

export default class extends AbstractView {
  protected type?: string
  protected code?: string

  constructor(params: any, init?: string) {
    super(params)
    this.type = init

    this.loadConfig()

    this.params.id = this.params.exportid || this.params.state

    if (init == 'github') {
      if (!this.config.credentials?.github && this.params.exportid) {
        GitHub.authorize(this.params.exportid)
      }
    }
  }

  async getHtml(element?: HTMLElement) {
    const type = this.type
    const params = this.params

    const yDoc = new Y.Doc()
    const provider = new IndexeddbPersistence(params.id, yDoc)

    const meta = this.index.get(params.id)

    const db = this.index

    provider.on('synced', async (_: any) => {
      const metaData = await meta
      const contentData = yDoc.getText(params.id).toJSON()
      console.warn('--------------------------')

      switch (type) {
        case 'github': {
          if (!this.config.credentials?.github) {
            this.config.credentials.github = await GitHub.access_token(
              params.code
            )

            this.storeConfig()
          }

          const gist = await GitHub.gistUpload(
            this.config.credentials.github,
            metaData.meta.title,
            metaData.meta.macro?.comment || '',
            contentData,
            metaData.meta.gist_id
          )

          if (gist.error == 'Bad credentials') {
            this.config.credentials.github = undefined

            this.storeConfig()

            window.location.reload()
          }

          if (metaData.meta.gist_id != gist.id) {
            await db.put(params.id, { gist_id: gist.id })
          }

          window.location.href = gist.url
          break
        }

        default: {
          console.warn('unknown service: ', type)
        }
      }
    })

    return
  }
}
