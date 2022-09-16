# auto-js-ipfs
Automatically get some IPFS download/upload/pinning functionality based on your environment.

## How

- Detect IPFS support in the global `fetch()` API (e.g. for Agregore)
- Or attempt to use the local Kubo Daemon URL that was provided
- Or Detect a locally running go-ipfs daemon
	- Either default Kubo RPC port (9090)
	- Or detect the Brave browser and it's embedded daemon
- Or use web3.storage (if an auth token is provided)
- Or use estuary (if an auth token is provided)
- Or use readonly mode (if enabled)
- Or throw an error

## API

### `opts => {daemonURL, web3StorageToken, estuaryToken, publicGatewayURL}`

These options can be used to either detect what the best supported options are, or to create an instance of this API.

All options are optional, and by default just the local node/agregore support will be used.

`daemonURL` is the URL of an IPFS daemon that should be used.

`web3StorageToken` is the Authorization token for use in the [web3.storage](https://web3.storage/) API.

`web3StorageURL` is the web3.storage API server URL that should be used.

`estuaryToken` is the Authorization token for use in the [Estuary](https://estuary.tech/) API.

`estuaryURL` is the Estuary API server URL that should be used.

`publicGatewayURL` is the public IPFS gateway to use for loading content without a local node.

`readonly` is an option for whether there should be a fallback to "readonly" mode where only `api.get` and `api.getSize` will be supported. Enabled by default.

### `async detect(opts) => Promise<[{type, url?}]>`

Detect what's supported in the current environment.

`type` can be one of `daemon`, `fetch`, `web3.storage`, `estuary`

`url` is an optional value that will point to ipfs daemon URL being used or the public gateway being used, or the backend API URL to be used.

### `async choose(choice) => Promise<API>`

Initialize the API based on the choice selected from `detect()`

### `async create(opts) => Promise<API>`

Create an API instance by auto-detecting the "best" option available.

### `api.get(url, {start, end}) => AsyncIterator<ArrayBuffer>`

Get data from an `ipfs://` URL, can optionally chose a start and end offset for loading data.

### `api.uploadCar(carFileAsyncIterator) => Promise<[url]>`

Upload a CAR file. Returns an array of root `ipfs://` URLs

### `api.uploadFile(fileAsyncIterator, fileName?) => Promise<url>`

Upload a file to the backend and get back a URL. Optionally specify a file name so that it will be wrapped in a folder.
