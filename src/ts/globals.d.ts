declare global {
  interface Window {
    bootstrap: any

    LIA: {
      isCtrlPressed: boolean

      preview?: any

      editor?: any

      isReady: boolean
      onReady: (_: any) => void

      init: (code: string, callback?: () => void) => void
      compile: (code?: string) => void

      showMode: (mode: number) => void

      delete: (id: string) => void
      share: () => void
      fork: (code: string) => void
      download: () => void

      exporter: {
        github: (documentId: string) => string
      }
    }
  }
}

export {}
