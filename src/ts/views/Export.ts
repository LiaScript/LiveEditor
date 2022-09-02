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
  }

  async getHtml(element?: HTMLElement) {
    const type = this.type
    const id = this.params.state

    const yDoc = new Y.Doc()
    const provider = new IndexeddbPersistence(id, yDoc)

    const meta = this.index.get(id)

    const db = this.index

    provider.on('synced', async (_: any) => {
      const metaData = await meta
      const contentData = yDoc.getText(id).toJSON()
      const code = this.params.code

      switch (type) {
        case 'github': {
          const gist = await GitHub.gist_Upload(
            code,
            metaData.meta.title,
            metaData.meta.macro?.comment || '',
            contentData,
            metaData.meta.gist_id
          )

          if (!metaData.meta.gist_id) {
            //metaData.meta.gist_id = gist.id
            await db.put(id, { gist_id: gist.id })
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
