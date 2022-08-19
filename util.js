/* global Response, ReadableStream, FormData, Headers, Blob */
export const BRAVE_PORTS = [45001, 45002, 45003, 45004, 45005]

export function parseIPFSURL (url) {
  const { hostname, scheme, pathname } = new URL(url)

  if (!hostname) {
    const [cid, ...segments] = pathname.slice(2).split('/')
    const path = '/' + segments.join('/')
    return { type: scheme, cid, path }
  }
  return { type: scheme, cid: hostname, path: pathname }
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

export function iteratorToStream (iterator) {
  return new ReadableStream({
    async pull (controller) {
      const { value, done } = await iterator.next()

      if (done) {
        controller.close()
      } else {
        controller.enqueue(value)
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

export async function postRawBody (url, fileIterator) {
  const headers = new Headers()

  headers.set('Content-Type', 'application/octet-stream')

  addAuthorizationHeader(url, headers)

  let body = fileIterator
  if (isIterator(body) && !isStream(body)) {
    body = iteratorToStream(body)
  }

  const response = await fetch(url, {
    method: 'POST',
    body,
    headers
  })

  await checkError(response)

  return response
}

export async function postFormFile (url, fileIterator, fileName = '') {
  const body = new FormData()
  const headers = new Headers()

  addAuthorizationHeader(url, headers)

  const content = await autoBlob(fileIterator)

  if (fileName) {
    body.append('file', content, fileName)
  } else {
    body.append('file', content)
  }

  const response = await fetch(url, {
    method: 'POST',
    body,
    headers
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
      const encoded = btoa(`${url.username}:${url.password}`)
      const auth = `Basic ${encoded}`
      headers.append('Authorization', auth)
      url.username = ''
      url.password = ''
    } else {
      // If we just have a password, it's for a bearer token
      const token = url.password
      const auth = `Bearer ${token}`
      headers.append('Authorization', auth)
      url.password = ''
    }
  }
}
