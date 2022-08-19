/* global Blob */
import process from 'node:process'

import test from 'tape'
import * as ipfsHttpModule from 'ipfs-http-client'
import { createController } from 'ipfsd-ctl'
import GoIPFS from 'go-ipfs'

import {
  API,
  Pins,
  Web3StorageAPI,
  DaemonAPI
} from './index.js'

const ipfsBin = GoIPFS.path()

const WEB3_AUTH = process.env.WEB3_STORAGE_AUTH

const EXAMPLE_DATA = 'Hello World'
const EXAMPLE_FORMATS = [
  EXAMPLE_DATA,
  new Blob([EXAMPLE_DATA]),
  toAsyncIterator(EXAMPLE_DATA)
]

test('Upload file to web3.storage', async (t) => {
  const EXAMPLE_URL = 'ipfs://bafkreiffsgtnic7uebaeuaixgph3pmmq2ywglpylzwrswv5so7m23hyuny/'

  const api = new Web3StorageAPI(WEB3_AUTH)

  for (const data of EXAMPLE_FORMATS) {
    const url = await api.uploadFile(data, 'example.txt')

    t.pass('Able to upload file')
    t.equal(url, EXAMPLE_URL, 'Got expeted URL returned')
  }
})

test('Upload file to Kubo daemon', async (t) => {
  // Why is it different from web3 storage?
  const EXAMPLE_URL = 'ipfs://bafkqac2imvwgy3zak5xxe3de/'

  const { ipfsd, apiPort } = await initIPFS()
  try {
    const daemonURL = `http://127.0.0.1:${apiPort}/`

    const api = new DaemonAPI(daemonURL)

    for (const data of EXAMPLE_FORMATS) {
      const url = await api.uploadFile(data, 'example.txt')

      t.pass('Able to upload file')
      t.equal(url, EXAMPLE_URL, 'Got expeted URL returned')
    }
  } finally {
    await ipfsd.stop()
  }
})

async function * toAsyncIterator (data) {
  yield * data
}

async function initIPFS (port = 6660) {
  const apiPort = port++
  const gatewayPort = port++
  const swarmPort = port++
  const ipfsOptions = {
    config: {
      Addresses: {
        API: `/ip4/127.0.0.1/tcp/${apiPort}`,
        Gateway: `/ip4/127.0.0.1/tcp/${gatewayPort}`,
        Swarm: [
          `/ip4/0.0.0.0/tcp/${swarmPort}`,
          `/ip6/::/tcp/${swarmPort}`,
          `/ip4/0.0.0.0/udp/${swarmPort}/quic`,
          `/ip6/::/udp/${swarmPort}/quic`
        ]
      }
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

  return { ipfsd, gatewayPort, apiPort, swarmPort }
}
