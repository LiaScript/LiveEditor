import { liveQuery, Dexie } from 'dexie'

export default class {
  private db: Dexie
  private observer?: any

  constructor() {
    this.db = new Dexie('LiveEditor')

    this.db.version(1).stores({
      data: `
            &id,
            timestamp,
            meta`,
    })
  }

  getAll() {
    return this.db.data.orderBy('timestamp').desc().toArray()
  }

  async maybeInit(id: string) {
    if (id.length > 8) {
      const skip = await this.exists(id)
      if (!skip) {
        this.put(id, { title: '' })
      }
    }
  }

  async exists(id: string) {
    const item = this.get(id)

    return item ? true : false
  }

  async get(id: string) {
    return await this.db.data.get(id)
  }

  async put(id: string, meta: any) {
    if (id.length > 8) {
      const storedMeta = await this.get(id)

      if (storedMeta) {
        meta = { ...storedMeta.meta, ...meta }
      }

      await this.db.data.put({
        id: id,
        timestamp: Date.now(),
        meta: meta,
      })
    }
  }

  drop(id: string) {
    this.db.data.delete(id)
  }

  watch(
    id: string | null,
    callbackOk: (_: any) => void,
    callbackError: (_: any) => void = console.warn
  ) {
    const db = this.db
    this.observer = liveQuery(
      id
        ? () => db.data.where('id').equals(id).toArray()
        : () => db.data.toArray()
    )

    const subscription = this.observer.subscribe({
      next: (result) => {
        if (result.length > 0) callbackOk(result[0])
      },
      error: (result) => callbackError(result),
    })
  }
}
