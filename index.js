/* global Headers, fetch, Blob */
import {
  parseIPFSURL,
  checkError,

  postFormFile,
  postRawBody,
  autoStream,

  streamToIterator
} from './util.js'

export const BRAVE_PORTS = [45001, 45002, 45003, 45004, 45005]
export const W3S_LINK_URL = 'https://w3s.link/'
export const WEB3_STORAGE_URL = 'https://api.web3.storage/'
export const ESTUARY_URL = 'https://api.estuary.tech/'
export const DEFAULT_DAEMON_API_URL = 'http://localhost:9090/'
export const DEFAULT_TIMEOUT = 1000
export const AGREGORE_TYPE = 'agregore'
export const DAEMON_TYPE = 'daemon'
export const WEB3_STORAGE_TYPE = 'web3.storage'
export const ESTUARY_TYPE = 'estuary'
export const CHOOSE_ORDER = [AGREGORE_TYPE, DAEMON_TYPE, WEB3_STORAGE_TYPE, ESTUARY_TYPE]

export class API {
  async * get (url, { start, end } = {}) {
    throw new Error('Not Implemented')
  }

  async uploadCAR (carFileIterator) {
    throw new Error('Not Implemented')
  }

  async uploadFile (carFileIterator, fileName) {
    throw new Error('Not Implemented')
  }
}

export class Pins {
  async list () {
    throw new Error('Not Implemented')
  }

  async add (url, { name, meta } = {}) {
    throw new Error('Not Implemented')
  }

  async remove (id) {
    throw new Error('Not Implemented')
  }
}

export async function detect ({
  daemonURL = DEFAULT_DAEMON_API_URL,
  web3StorageToken,
  web3StorageURL = WEB3_STORAGE_URL,
  estuaryToken,
  estuaryURL = ESTUARY_URL,
  publicGatewayURL = W3S_LINK_URL,
  timeout = DEFAULT_TIMEOUT,
  fetch = globalThis.fetch
} = {}) {
  const options = []

  const toAttempt = []

  toAttempt.push(
    detectAgregoreFetch(fetch)
      .then(detected => detected && options.push({ type: AGREGORE_TYPE, fetch }))
  )

  toAttempt.push(
    detectBraveDaemon(fetch)
      .then(detected => detected && options.push({ type: DAEMON_TYPE, url: detected, fetch }))
  )

  if (daemonURL) {
    toAttempt.push(
      detectDaemon(daemonURL, timeout, fetch)
        .then(detected => detected && options.push({ type: DAEMON_TYPE, url: daemonURL, fetch }))
    )
  }

  if (estuaryToken) {
    const url = estuaryURL
    const authorization = estuaryToken
    options.push({ type: ESTUARY_TYPE, url, authorization, fetch, publicGatewayURL })
  }

  if (web3StorageToken) {
    const url = web3StorageURL
    const authorization = web3StorageToken
    options.push({ type: WEB3_STORAGE_TYPE, url, authorization, fetch, publicGatewayURL })
  }

  await Promise.allSettled(toAttempt)

  return options
}

export async function create ({ chooseOrder = CHOOSE_ORDER, ...opts } = {}) {
  const options = await detect(opts)

  const chosen = defaultChoice(options, chooseOrder)

  return choose(chosen)
}

export function defaultChoice (options, chooseOrder = CHOOSE_ORDER) {
  const sorted = options
    .filter(({ type }) => chooseOrder.includes(type))
    .sort(({ type: type1 }, { type: type2 }) => chooseOrder.indexOf(type1) - chooseOrder.indexOf(type2))

  const chosen = sorted[0]
  if (!chosen) throw new Error('Unable to find valid type')

  return chosen
}

export async function choose (option) {
  const { type } = option
  let api = null
  if (type === AGREGORE_TYPE) {
    api = new AgregoreAPI(option.fetch || globalThis.fetch)
  } else if (type === DAEMON_TYPE) {
    api = new DaemonAPI(option.url)
  } else if (type === WEB3_STORAGE_TYPE) {
    api = new Web3StorageAPI(option.authorization, option.url, option.publicGatewayURL)
  } else if (type === ESTUARY_TYPE) {
    api = new EstuaryAPI(option.authorization, option.url, option.publicGatewayURL)
  } else {
    throw new TypeError(`Unknown API type: ${type}.`)
  }

  const pins = new Pins()

  return { api, pins }
}

export class EstuaryAPI extends API {
  constructor (authorization, url = ESTUARY_URL, gatewayURL = W3S_LINK_URL) {
    super()
    this.authorization = authorization
    this.url = url
    this.gatewayURL = gatewayURL
  }

  async * get (url, { start, end } = {}) {
    yield * getFromGateway(url, { start, end }, this.gatewayURL)
  }

  async uploadCAR (carFileIterator) {
    throw new Error('Not Implemented')
  }

  async uploadFile (fileIterator, fileName) {
    const toFetch = new URL('/content/add', this.url)
    toFetch.password = this.authorization

    const response = await postFormFile(toFetch, fileIterator, fileName, 'data')

    const { cid } = await response.json()

    return `ipfs://${cid}/`
  }
}

export class AgregoreAPI extends API {
  constructor (fetch = globalThis.fetch) {
    super()
    this.fetch = fetch
  }

  async * get (url, { start, end } = {}) {
    yield * getFromURL(url, { start, end }, this.fetch)
  }

  async uploadCAR (carFileIterator) {
    // convert to stream if iterator
    const body = await autoStream(carFileIterator)
    const { fetch } = this
    const response = await fetch('ipfs://localhost', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.ipld.car'
      },
      body
    })

    await checkError(response)

    const results = await response.text()

    return results.split('\n')
  }

  async uploadFile (fileIterator) {
    const body = await autoStream(fileIterator)
    const { fetch } = this
    const response = await fetch('ipfs://localhost', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream'
      },
      body
    })

    await checkError(response)

    return response.headers.get('Location')
  }
}

export class Web3StorageAPI extends API {
  constructor (authorization, url = WEB3_STORAGE_URL, gatewayURL = W3S_LINK_URL) {
    super()
    this.authorization = authorization
    this.url = url
    this.gatewayURL = gatewayURL
  }

  async * get (url, { start, end } = {}) {
    yield * getFromGateway(url, { start, end }, this.gatewayURL)
  }

  async uploadCAR (carFileIterator) {
    const toFetch = new URL('/car', this.url)
    toFetch.password = this.authorization

    const response = await postRawBody(toFetch, carFileIterator)

    const contents = await response.text()
    const items = contents.split('\n')

    return items.filter((line) => line).map((line) => {
      const { cid } = JSON.parse(line)
      return `ipfs://${cid}/`
    })
  }

  async uploadFile (fileIterator, fileName = '') {
    const toFetch = new URL('/upload', this.url)
    toFetch.password = this.authorization

    const response = await postFormFile(toFetch, fileIterator, fileName)

    const { cid } = await response.json()

    return `ipfs://${cid}/`
  }
}

export class DaemonAPI extends API {
  constructor (url = DEFAULT_DAEMON_API_URL) {
    super()
    this.url = url
  }

  async * get (url, { start, end } = {}) {
    const { cid, path, type } = parseIPFSURL(url)
    const relative = `/api/v0/cat?arg=/${type}/${cid}${path}`
    const toFetch = new URL(relative, this.url)

    if (start) {
      toFetch.searchParams.set('offset', start)
    }
    if (end) {
      toFetch.searchParams.set('length', (start || 0) + end)
    }

    const response = await fetch(toFetch, {
      method: 'POST'
    })

    await checkError(response)

    yield * streamToIterator(response.body)
  }

  async uploadCAR (carFileIterator) {
    const relative = '/api/v0/dag/import?allow-big-block=true&pin-roots=true'
    const toFetch = new URL(relative, this.url)

    const response = await postFormFile(toFetch, carFileIterator)

    const contents = await response.text()
    const items = contents.split('\n')

    return items.filter((line) => line).map((line) => {
      const { Root } = JSON.parse(line)
      const cid = Root.Cid['/']
      return `ipfs://${cid}/`
    })
  }

  async uploadFile (fileIterator, fileName = '') {
    const relative = '/api/v0/add?cid-version=1&inline=true&raw-leaves=true'
    const toFetch = new URL(relative, this.url)

    const isFile = fileIterator.name && fileIterator instanceof Blob
    // We should just wrap files or things with a name with a directory
    if (fileName || isFile) {
      toFetch.searchParams.set('wrap-with-directory', 'true')
    }

    const response = await postFormFile(toFetch, fileIterator, fileName)

    const contents = await response.text()
    const [line] = contents.split('\n')

    const { Hash: cid } = JSON.parse(line)
    return `ipfs://${cid}/`
  }
}

export let hasInterceptedWebRequests = false
export const shouldInterceptWebRequests = !!(globalThis?.chrome?.webRequest?.onBeforeSendHeaders?.addListener)

export async function detectBraveDaemon () {
  if (typeof navigator === 'undefined') return false
  if (!navigator.brave && !navigator.brave.isBrave()) return false

  const potentialGateways = BRAVE_PORTS.map((port) => `http://localhost:${port}/`)
  try {
    // Search all the potential gateways in paralell and return the first valid one
    const foundGateway = Promise.any(potentialGateways.map(
      (gateway) => detectDaemon(gateway).then((exists) => {
        if (exists) return gateway
        throw new Error('Not found')
      })
    ))

    if (!foundGateway) return false

    if (shouldInterceptWebRequests && !hasInterceptedWebRequests) {
      interceptWebRequests(foundGateway)
    }

    return foundGateway
  } catch {
    return false
  }
}

// This a funky thing that WebRecorder did to bypass cors
function interceptWebRequests (apiURL) {
  hasInterceptedWebRequests = true
  globalThis.chrome.webRequest.onBeforeSendHeaders.addListener((details) => {
    const { requestHeaders } = details

    for (const header of requestHeaders) {
      if (header.name.toLowerCase() === 'origin') {
        header.value = apiURL
        return { requestHeaders }
      }
    }

    details.requestHeaders.push({ name: 'Origin', value: apiURL })
    return { requestHeaders }
  },
  { urls: [apiURL + '/*'] },
  ['blocking', 'requestHeaders', 'extraHeaders']
  )
}

export async function detectAgregoreFetch (fetch = globalThis.fetch) {
  try {
    // Should throw error if IPFS is not supported
    // Also throws an error in brave even with IPFS support
    await fetch('ipfs://localhost/')
    return true
  } catch (e) {
    console.error('Unable to detect Agregore', e)
    return false
  }
}

export async function detectDaemon (url, timeout = 1000, fetch = globalThis.fetch) {
  try {
    const controller = new AbortController()
    const { signal } = controller
    setTimeout(() => controller.abort(), timeout)
    const response = await fetch(new URL('/api/v0/version', url), {
      signal
    })
    if (response.ok) return true
    if (response.status === 405) return true
    return false
  } catch (e) {
    console.error('Unable to detect Kubo Daemon', e, url)
    return false
  }
}

export async function * getFromGateway (ipfsURL, { start, end } = {}, gatewayURL = W3S_LINK_URL) {
  const { cid, path, type } = parseIPFSURL(ipfsURL)

  const relative = `/${type}/${cid}${path}`
  const toFetch = new URL(relative, gatewayURL)

  yield * getFromURL(toFetch, { start, end })
}

export async function * getFromURL (url, { start, end } = {}, fetch = globalThis.fetch) {
  const headers = new Headers()
  if (Number.isInteger(start)) {
    if (Number.isInteger(end)) {
      headers.set('Range', `bytes=${start}-${end}`)
    } else {
      headers.set('Range', `bytes=${start}-`)
    }
  }

  const response = await fetch(url, {
    headers
  })

  await checkError(response)

  yield * streamToIterator(response.body)
}