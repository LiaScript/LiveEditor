import AbstractView from './AbstractView'

import DateFormat from 'date-format-simple'

const CONTAINER = 'card-container'

const dateFormat = new DateFormat(new Date().getTime())

function createDate(timestamp: number) {
  const dateObject = new Date(timestamp)

  return dateFormat.print(dateObject)
}

function createCard(def: { id: string; meta: any; timestamp: number }) {
  return ` 
          <div class="col-12 p-2 col-sm-6 col-md-6 col-lg-4 col-xl-3" style="height: inherit">

            <div class="card shadow bg-body rounded">
            
              <div class="card-body"style="margin-bottom: -26px">
                <div class="d-flex justify-content-between">
                  <h6 class="h6 text-truncate" style="margin-right: 10px">
                    ${def.meta?.title ? def.meta?.title : 'Untitled'}
                  </h6>
                  <button type="button" class="btn btn-close btn-sm" aria-label="Delete" onclick="window.LIA.delete('${
                    def.id
                  }')"></button>
                </div>
              </div>
              <hr>
              <div class="card-body pt-0" style="height: 12rem; overflow: auto">
                <img src="${def.meta?.logo}"
                  style="width:100%"
                ${def.meta?.logo ? '' : 'hidden="true"'} >
              
                <p class="mb-0"><small>${
                  def.meta?.macro?.comment || ''
                }</small></p>

                <hr ${def.meta?.macro?.comment ? '' : 'hidden="true"'}>
                <p class="mb-0 text-muted"><small>ID: ${def.id}</small></p>
              </div>

              <div class="row m-1">
              <p class="col-9 card-text my-2 text-truncate"><small class="text-muted">[v ${
                def.meta.version
              }] - ${createDate(def.timestamp)}</small></p>
                <div class="col gap-2 d-sm-flex justify-content-end p-1">
                  <a href="./?/edit/${
                    def.id
                  }" class="btn btn-primary btn-sm">Edit</a>
                </div>
              </div>
            </div>
          </div>
`
}
export default class extends AbstractView {
  constructor(params: object) {
    super(params)
    this.setTitle('Index')
  }

  async init() {
    const container = document.getElementById(CONTAINER)

    if (container) {
      const notes = await this.index.getAll()

      container.innerHTML = notes
        .map((e) => {
          return createCard(e)
        })
        .join('')
    }

    const db = this.index
    window.LIA.delete = (id) => {
      db.drop(id)
      window.indexedDB.deleteDatabase(id)
      window.location = window.location
    }
  }

  body(): string {
    return `
    <div
      class="container mx-0 px-0 pb-5"
      style="max-width: 100vw !important; height:100%; overflow: scroll"
      >
      <div
        id="${CONTAINER}"
        class="row row-cols-1 row-cols-md-3 row-cols-lg-4 g-8 m-5"
        
      >
      </div>
    </div>
    `
  }

  navigation(): string {
    return `
      <nav class="navbar navbar-expand-lg navbar-light bg-light">
        <div class="container-fluid">
          <a class="navbar-brand" href="./" data-link>
            Lia[Index]
          </a>

          <a class="navbar-brand" href="./examples.html">
            Lia[Examples]
          </a>
            
          <a type="button" class="btn btn-primary" href="./?/edit">
            New note
          </a>
        </div>
      </nav>`
  }

  async getHtml(element: HTMLElement) {
    element.innerHTML = this.navigation() + this.body()

    this.init()
  }
}
