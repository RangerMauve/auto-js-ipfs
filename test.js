/* global Blob */
import process from 'node:process'

import test from 'tape'

import {
  Web3StorageAPI,
  EstuaryAPI,
  DaemonAPI,
  AgregoreAPI
} from './index.js'

const WEB3_AUTH = process.env.WEB3_STORAGE_AUTH
const ESTUARY_AUTH = process.env.ESTUARY_AUTH

const EXAMPLE_DATA = 'Hello World'
const EXAMPLE_FORMATS = () => [
  Buffer.from(EXAMPLE_DATA),
  EXAMPLE_DATA,
  new Blob([EXAMPLE_DATA]),
  toAsyncIterator(EXAMPLE_DATA)
]
const EXAMPLE_CAR = Buffer.from([58, 162, 101, 114, 111, 111, 116, 115, 129, 216, 42, 88, 37, 0, 1, 85, 18, 32, 165, 145, 166, 212, 11, 244, 32, 64, 74, 1, 23, 51, 207, 183, 177, 144, 214, 44, 101, 191, 11, 205, 163, 43, 87, 178, 119, 217, 173, 159, 20, 110, 103, 118, 101, 114, 115, 105, 111, 110, 1, 47, 1, 85, 18, 32, 165, 145, 166, 212, 11, 244, 32, 64, 74, 1, 23, 51, 207, 183, 177, 144, 214, 44, 101, 191, 11, 205, 163, 43, 87, 178, 119, 217, 173, 159, 20, 110, 72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100])
const EXAMPLE_CAR_FORMATS = () => [
  EXAMPLE_CAR,
  new Blob([EXAMPLE_CAR]),
  toAsyncIterator([EXAMPLE_CAR])
]

// Only possible for CAR files since file uploads are not generally determenistic
const EXAMPLE_URL = 'ipfs://bafkreiffsgtnic7uebaeuaixgph3pmmq2ywglpylzwrswv5so7m23hyuny/'

test('Upload file to Agregore', async (t) => {
  const { default: makeIPFSFetch } = await import('js-ipfs-fetch')

  const { ipfsd } = await initIPFS()
  const { api: ipfs } = ipfsd
  try {
    const fetch = await makeIPFSFetch({ ipfs })

    const api = new AgregoreAPI(fetch)

    for (const data of EXAMPLE_FORMATS()) {
      const url = await api.uploadFile(data, 'example.txt')

      t.ok(url, 'Able to upload file')

      const size = await api.getSize(url)
      t.equal(size, EXAMPLE_DATA.length, 'Able to read size accurately')

      const loaded = await collect(api.get(url))

      t.deepEqual(loaded.toString('utf8'), EXAMPLE_DATA, 'Got expected data from uploaded URL')
    }
  } finally {
    await ipfsd.stop()
  }
})

test('Upload CAR to Agregore', async (t) => {
  const { default: makeIPFSFetch } = await import('js-ipfs-fetch')

  const { ipfsd } = await initIPFS()
  const { api: ipfs } = ipfsd
  try {
    const fetch = await makeIPFSFetch({ ipfs })

    const api = new AgregoreAPI(fetch)

    for (const data of EXAMPLE_CAR_FORMATS()) {
      const roots = await api.uploadCAR(data)

      t.pass('Able to upload CAR')
      t.deepEqual(roots, [EXAMPLE_URL], 'Got expected roots from CAR')

      const carLoaded = await collect(api.get(EXAMPLE_URL, { format: 'car' }))

      t.deepEqual(carLoaded, EXAMPLE_CAR, 'Got car back out')
    }
  } finally {
    await ipfsd.stop()
  }
})

test('Upload file to web3.storage', async (t) => {
  const api = new Web3StorageAPI(WEB3_AUTH)

  for (const data of EXAMPLE_FORMATS()) {
    const url = await api.uploadFile(data, 'example.txt')

    t.pass('Able to upload file')

    const size = await api.getSize(url)
    t.equal(size, EXAMPLE_DATA.length, 'Able to read size accurately')

    const loaded = await collect(api.get(url))

    t.deepEqual(loaded.toString('utf8'), EXAMPLE_DATA, 'Got expected data from uploaded URL')
  }
})

test('Upload CAR to web3.storage', async (t) => {
  const api = new Web3StorageAPI(WEB3_AUTH)

  for (const data of EXAMPLE_CAR_FORMATS()) {
    const roots = await api.uploadCAR(data)

    t.pass('Able to upload CAR')
    t.deepEqual(roots, [EXAMPLE_URL], 'Got expected roots from CAR')

    const carLoaded = await collect(api.get(EXAMPLE_URL, { format: 'car' }))

    t.deepEqual(carLoaded, EXAMPLE_CAR, 'Got car back out')
  }
})

test.skip('Upload file to estuary', async (t) => {
  const api = new EstuaryAPI(ESTUARY_AUTH)

  for (const data of EXAMPLE_FORMATS()) {
    const url = await api.uploadFile(data, 'example.txt')

    t.pass('Able to upload file')

    const size = await api.getSize(url)
    t.equal(size, EXAMPLE_DATA.length, 'Able to read size accurately')

    const loaded = await collect(api.get(url))

    t.deepEqual(loaded.toString('utf8'), EXAMPLE_DATA, 'Got expected data from uploaded URL')
  }
})

test('Upload file to Kubo daemon', async (t) => {
  const { ipfsd, daemonURL } = await initIPFS()
  try {
    const api = new DaemonAPI(daemonURL)

    for (const data of EXAMPLE_FORMATS()) {
      const url = await api.uploadFile(data, 'example.txt')

      t.pass('Able to upload file')

      const size = await api.getSize(url)
      t.equal(size, EXAMPLE_DATA.length, 'Able to read size accurately')

      const loaded = await collect(api.get(url))

      t.deepEqual(loaded.toString('utf8'), EXAMPLE_DATA, 'Got expected data from uploaded URL')

      await api.clear(url)

      t.pass('Able to clear uploaded URL')
    }
  } finally {
    await ipfsd.stop()
  }
})

test('Upload CAR to Kubo Daemon', async (t) => {
  const { ipfsd, daemonURL } = await initIPFS()
  try {
    const api = new DaemonAPI(daemonURL)

    for (const data of EXAMPLE_CAR_FORMATS()) {
      const roots = await api.uploadCAR(data)

      t.pass('Able to upload CAR')
      t.deepEqual(roots, [EXAMPLE_URL], 'Got expected roots from CAR')

      await api.clear(EXAMPLE_URL)

      t.pass('Able to clear uploaded URL')
    }
  } finally {
    await ipfsd.stop()
  }
})

async function * toAsyncIterator (data) {
  yield * data
}

async function collect (iterator) {
  const data = []
  for await (const chunk of iterator) {
    data.push(chunk)
  }
  return Buffer.concat(data)
}

async function initIPFS (port = 6660) {
  const ipfsHttpModule = await import('ipfs-http-client')
  const { createController } = await import('ipfsd-ctl')
  const { default: GoIPFS } = await import('go-ipfs')

  const ipfsBin = GoIPFS.path()

  const apiPort = port++
  const swarmPort = port++
  const ipfsOptions = {
    config: {
      Addresses: {
        API: `/ip4/127.0.0.1/tcp/${apiPort}`,
        Swarm: [
          `/ip4/0.0.0.0/tcp/${swarmPort}`,
          `/ip6/::/tcp/${swarmPort}`,
          `/ip4/0.0.0.0/udp/${swarmPort}/quic`,
          `/ip6/::/udp/${swarmPort}/quic`
        ]
      },
      Gateway: null
    }
  }
  const ipfsd = await createController({
    type: 'go',
    test: true,
    disposable: true,
    remote: false,
    ipfsHttpModule,
    ipfsBin,
    ipfsOptions
  })

  try {
    await ipfsd.init({ ipfsOptions })

    await ipfsd.start()
    await ipfsd.api.id()
  } catch (e) {
    await ipfsd.stop()
    throw e
  }

  const daemonURL = `http://127.0.0.1:${apiPort}/`

  return { ipfsd, apiPort, swarmPort, daemonURL }
}
