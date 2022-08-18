# auto-js-ipfs
Automatically get some IPFS download/upload/pinning functionality based on your environment.

## How

- Detect IPFS support in the global `fetch()` API (e.g. for Agregore)
- Or attempt to use the local gateway URL that was provided
- Or Detect a locally running go-ipfs daemon
	- Either default IPFS port
	- Or detect Brave browser and it's embedded daemon
- Or (if enabled and in node.js) set up a local go-ipfs node
- Or use web3.storage
- Or use estuary

## API

### `opts => {daemonURL, web3StorageToken, estuaryToken, publicGatewayURL, noFetch}`

These options can be used to either detect what the best supported options are, or to create an instance of this API.

All options are optional, and by default just the local node/agregore support will be used.

`daemonURL` is the URL of an IPFS daemon that should be used.

`web3StorageToken` is the Authorization token for use in the [web3.storage](https://web3.storage/) API.

`estuaryToken` is the Authorization token for use in the [Estuary](https://estuary.tech/) API.

`publicGatewayURL` is the public IPFS gateway to use for loading content without a local node.

`noFetch` is a boolean to skip attempting to use the local Agregore based node

### `detect(opts) => [{type, supports: [], gatewayURL}`

Detect what's supported in the current environment.

`type` can be one of `daemon`, `fetch`, `web3.storage`, `estuary`

`supports` is an array of supported features such as `get`, `upload`, `pin`, `name`.

`url` is an optional value that will point to ipfs daemon URL being used or the public gateway being used.

### `create(opts) => api`

### api.implementations => {type, function}

### `api.get(url, {start, end}) => AsyncIterator<ArrayBuffer>`

### `api.upload(carFileAsyncIterator) => Promise<[url]>`

### `api.pin.list({status: 'pinned'}) => Promise<{id, url, status, name, meta}>`

### `api.pin.add(url, {name, meta}) => Promise<{id, url, status, name, meta}>`

### `api.pin.remove(id) => Promise`
