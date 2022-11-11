/* global Response, ReadableStream, FormData, Headers, Blob */

export const BRAVE_PORTS = [45001, 45002, 45003, 45004, 45005]
export const W3S_LINK_URL = 'https://w3s.link/'
export const DEFAULT_GATEWAY = W3S_LINK_URL

export function parseIPFSURL (url) {
  const { hostname, protocol, pathname } = new URL(url)

  const type = protocol.slice(0, -1)

  if (!hostname) {
    const [cid, ...segments] = pathname.slice(2).split('/')
    const path = '/' + segments.join('/')
    return { type, cid, path }
  }
  return { type, cid: hostname, path: pathname }
}

// Might not convert if it's a plain string
// Used for appending to form data
export async function autoBlob (content) {
  if (isStream(content)) {
    const blob = await streamToBlob(content)
    return blob
  } else if (isIterator(content)) {
    const stream = iteratorToStream(content)
    const blob = await streamToBlob(stream)
    return blob
  } else {
    return new Blob([content])
  }
}

export async function autoStream (content) {
  if (isStream(content)) return content
  if (isIterator(content)) return iteratorToStream(content)
  /* if (typeof content.stream === 'function') {
    // Probably a Blob or a File
    return content.stream()
  } */
  // Probably a string or something
  return content
}

export async function streamToBlob (stream) {
  const response = new Response(stream)
  return response.blob()
}

export async function * streamToIterator (stream) {
  const reader = await stream.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return
      yield value
    }
  } finally {
    reader.releaseLock()
  }
}

export function iteratorToStream (iterable) {
  let iterator = iterable
  if (!iterator.next) {
    iterator = iterable[Symbol.asyncIterator]()
  }
  const encoder = new TextEncoder()
  return new ReadableStream({
    async pull (controller) {
      const { value, done } = await iterator.next()

      if (done) {
        await controller.close()
      } else {
        let toSend = value
        if (typeof toSend === 'string') {
          toSend = encoder.encode(toSend)
        }
        await controller.enqueue(toSend)
      }
    }
  })
}

export async function checkError (response) {
  if (!response.ok) {
    const error = await response.text()
    const status = response.status
    throw new Error(`HTTP Error ${status}: ${error}`)
  }
}

export async function postRawBody ({
  url,
  fileIterator,
  signal
}) {
  const headers = new Headers()

  headers.set('Content-Type', 'application/octet-stream')

  addAuthorizationHeader(url, headers)

  const body = await autoStream(fileIterator)

  const response = await fetch(url, {
    method: 'POST',
    signal,
    body,
    headers
  })

  await checkError(response)

  return response
}

export async function postFormFile ({
  url,
  file,
  fileName = '',
  parameterName = 'file',
  fetch = globalThis.fetch,
  signal
}) {
  const body = new FormData()
  const headers = new Headers()

  addAuthorizationHeader(url, headers)

  const content = await autoBlob(file)

  if (fileName) {
    body.append(parameterName, content, fileName)
  } else {
    body.append(parameterName, content)
  }

  const response = await fetch(url, {
    method: 'POST',
    body,
    headers,
    signal
  })

  await checkError(response)

  return response
}

export function isStream (content) {
  return typeof content.getReader === 'function'
}

export function isIterator (content) {
  return content[Symbol.asyncIterator]
  // || content[Symbol.iterator]
}

export function addAuthorizationHeader (url, headers) {
  if (url.password) {
    if (url.username) {
      const encoded = btoa(`${unescape(url.username)}:${unescape(url.password)}`)
      const auth = `Basic ${encoded}`
      headers.append('Authorization', unescape(auth))
      url.username = ''
      url.password = ''
    } else {
      // If we just have a password, it's for a bearer token
      const token = url.password
      const auth = `Bearer ${token}`
      headers.append('Authorization', unescape(auth))
      url.password = ''
    }
  }
}

export async function getSizeFromURL ({
  url,
  fetch = globalThis.fetch,
  signal
}) {
  const response = await fetch(url, {
    method: 'HEAD',
    signal
  })

  await checkError(response)

  const lengthHeader = response.headers.get('Content-Length')

  return parseInt(lengthHeader, 10)
}

export async function * getFromURL ({
  url,
  start,
  end,
  format,
  signal,
  fetch = globalThis.fetch
}) {
  const headers = new Headers()
  if (Number.isInteger(start)) {
    if (Number.isInteger(end)) {
      headers.set('Range', `bytes=${start}-${end}`)
    } else {
      headers.set('Range', `bytes=${start}-`)
    }
  }

  const toFetch = new URL(url)

  if (format) {
    headers.set('Accept', `application/vnd.ipld.${format}`)
    headers.set('cache-control', 'no-cache')
  }

  const response = await fetch(toFetch.href, {
    headers,
    signal
  })

  await checkError(response)

  yield * streamToIterator(response.body)
}

export function toGatewayURL (url, gatewayBaseURL = detectDefaultGateway()) {
  const { cid, path, type } = parseIPFSURL(url)

  const relative = `/${type}/${cid}${path}`
  const toFetch = new URL(relative, gatewayBaseURL)

  return toFetch
}

export async function * getFromGateway ({
  url,
  start,
  end,
  format,
  signal,
  gatewayURL = detectDefaultGateway()
}) {
  const toFetch = toGatewayURL(url, gatewayURL, format)

  yield * getFromURL({
    url: toFetch,
    start,
    end,
    format,
    signal
  })
}

export function detectDefaultGateway () {
  if (!globalThis.location) return DEFAULT_GATEWAY
  const { pathname, hostname, protocol } = globalThis.location
  const isOnGatewayPath = pathname.startsWith('/ipfs/') || pathname.startsWith('/ipns/')

  if (isOnGatewayPath) {
    return `${protocol}//${hostname}/`
  }

  const [subdomain, ...segments] = hostname.split('.')

  // If the first subdomain is about the length of a CID it's probably a gateway?
  const isGatewaySubdomain = subdomain.length === 59 && segments.length >= 2

  if (isGatewaySubdomain) {
    return `${protocol}//${segments.join('.')}/`
  }

  return DEFAULT_GATEWAY
}
