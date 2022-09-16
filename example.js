/* global HTMLElement, localStorage, customElements, FormData, CustomEvent */
import { detect, create, choose, defaultChoice } from './index.js'

export const OPTIONS_PERSIST_KEY = 'auto-ipfs-options'

export class AutoIPFSOptions extends HTMLElement {
  connectedCallback () {
    this.innerHTML = `
    <details open>
      <summary>Settings</summary>
      <select title="Choose which backend you would like to use">
        <option value="" selected>Autoslect Backend</option>
      </select> 
      <form>
        <label>Kubo Daemon URL: </label>
        <input name="daemonURL"/>
        <label>Web3.Storage Token: </label>
        <input name="web3StorageToken" type="password"/>
        <label>Estuary Token: </label>
        <input name="estuaryToken" type="password"/>
      </form>
    </details>
    `

    this.form.addEventListener('change', () => this.handleChange())
    this.select.addEventListener('change', () => this.emitLatest())
    this.details.addEventListener('toggle', () => {
      this.saveOptions()
    })
    this.loadOptions()
    this.refreshBackends()
  }

  get select () {
    return this.querySelector('select')
  }

  get form () {
    return this.querySelector('form')
  }

  get details () {
    return this.querySelector('details')
  }

  get opts () {
    const data = new FormData(this.form)

    const opts = {
      readonly: false
    }

    for (const [key, value] of data.entries()) {
      if (!value) continue
      opts[key] = value
    }

    return opts
  }

  loadOptions () {
    const saved = localStorage.getItem(OPTIONS_PERSIST_KEY)

    if (!saved) return

    const { opts, detailsOpen } = JSON.parse(saved)

    this.details.toggleAttribute('open', detailsOpen)

    for (const [key, value] of Object.entries(opts)) {
      const element = this.querySelector(`[name=${key}]`)
      if (!element) {
        console.warn(`Couldn't find ${key} input`)
        continue
      }
      element.value = value
    }
  }

  saveOptions () {
    const { opts, details } = this
    const detailsOpen = details.open

    const toSave = JSON.stringify({
      opts,
      detailsOpen
    })

    localStorage.setItem(OPTIONS_PERSIST_KEY, toSave)
  }

  handleChange () {
    this.saveOptions()
    this.refreshBackends()
  }

  emitLatest () {
    const { selected } = this
    this.dispatchEvent(new CustomEvent('selected', { detail: unescape(selected) }))
  }

  async refreshBackends () {
    const { opts, select } = this
    const options = await detect(opts)
    const defaultOption = defaultChoice(options)

    console.log('Detected options', opts, options, defaultOption)

    const optionSelects = options.map((option) => `
      <option value="${escape(JSON.stringify(option))}">
        ${option.type}
      </option>
    `).join('')

    select.innerHTML = `
      ${optionSelects}
      <option value="${escape(JSON.stringify(defaultOption))}" selected>
        default (${defaultOption.type})
      </option>
    `

    this.emitLatest()
  }

  get selected () {
    return this.querySelector('option:checked').value
  }
}

export class AutoIPFSUpload extends HTMLElement {
  connectedCallback () {
    this.innerHTML = `
      <label>
        Drop Your File Here Or Click To Choose
        <input name="files" multiple type="file" aria-hidden="true">
      </label>
      <ul>
      </ul>
    `

    this.drop.addEventListener('drop', (e) => {
      e.preventDefault()
      console.log('drop', e.dataTransfer)
      this.uploadFiles(e.dataTransfer.files)
    })

    this.drop.addEventListener('dragover', (e) => {
      e.preventDefault()
    })

    this.input.addEventListener('change', async (e) => {
      const { files } = this.input
      await this.uploadFiles(files)
    })
  }

  get drop () {
    return this.querySelector('label')
  }

  get input () {
    return this.querySelector('input')
  }

  get list () {
    return this.querySelector('ul')
  }

  async getAPI () {
    const selected = this.getAttribute('selected')
    if (selected) {
      const parsed = JSON.parse(selected)
      const { api } = await choose(parsed)
      return api
    } else {
      const { api } = await create()
      return api
    }
  }

  listFile (name, url) {
    const li = document.createElement('li')
    li.innerHTML = `<a href="${url}">${name}: ${url}</a>`

    this.list.appendChild(li)
  }

  async uploadFile (file) {
    const api = await this.getAPI()
    const url = await api.uploadFile(file)

    this.listFile(file.name, url)
  }

  async uploadCar (file) {
    const api = await this.getAPI()
    console.log({ api, file })
    const [url] = await api.uploadCAR(file)

    this.listFile(file.name, url)
  }

  async uploadFiles (fileList) {
    for (const file of fileList) {
      console.log('uploading', file)
      if (file.name.endsWith('.car')) {
        this.uploadCar(file)
      } else {
        this.uploadFile(file)
      }
    }
  }
}

customElements.define('auto-ipfs-options', AutoIPFSOptions)
customElements.define('auto-ipfs-upload', AutoIPFSUpload)
