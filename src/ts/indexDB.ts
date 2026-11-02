import { liveQuery, Dexie } from 'dexie'
import { markRaw } from 'vue'

export default class {
  private db: Dexie
  private observer?: any

  constructor() {
    // markRaw: components keep this wrapper in data(); a Vue proxy around the
    // Dexie instance breaks its transaction tracking ("transaction has finished")
    this.db = markRaw(new Dexie('LiveEditor'))

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
    const item = await this.get(id)

    return item ? true : false
  }

  async get(id: string) {
    return await this.db.data.get(id)
  }

  async put(id: string, meta: any) {
    if (id.length > 8) {
      // read-merge-write in one transaction, so two concurrent puts (also from
      // different Dexie instances) can't drop each other's fields
      await this.db.transaction('rw', this.db.data, async () => {
        const stored = await this.db.data.get(id)
        await this.db.data.put({
          id: id,
          timestamp: Date.now(),
          meta: stored ? { ...stored.meta, ...meta } : meta,
        })
      })
    }
  }

  drop(id: string) {
    this.db.data.delete(id)
  }

  /** Live-query the entry (or all entries); returns an unsubscribe function. */
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
    return () => subscription.unsubscribe()
  }
}
