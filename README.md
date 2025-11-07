## elFinder NodeJS Connector

[![Tests](https://github.com/dkyeremeh/elfinder-node/actions/workflows/int-test.yml/badge.svg)](https://github.com/dkyeremeh/elfinder-node/actions/workflows/int-test.yml)
[![cov](https://dkyeremeh.github.io/elfinder-node/badges/coverage.svg)](https://github.com/dkyeremeh/elfinder-node/actions)

This package allows you to use [elFinder file manager](https://github.com/Studio-42/elFinder) with Nodejs.
It currently implements LocalFileStorage only.
Work is being done to allow ftp, ssh and cloud storage compatibility.

## Demo

https://studio-42.github.io/elFinder/

## Installation

```sh
npm install elfinder-node --save
```

or

```sh
yarn add elfinder-node
```

## Usage

This package should be implemented as a middleware for Express server. You can see an example of how this package is used [here](/tests).

Below is a summary of how it is used:

```javascript
const express = require('express');
const app = express();
const { elfinder, LocalFileSystemDriver } = require('elfinder-node');

const roots = [
  {
    driver: LocalFileSystemDriver,
    URL: '/uploads/', //Required
    path: '/path/to/dir', //Required
    permissions: { read: 1, write: 1, lock: 0 },
  },
  {
    driver: LocalFileSystemDriver,
    URL: '/404/', //Required
    path: 'private', //Required
    permissions: { read: 1, write: 0, lock: 1 },
  },
];

app.use('/connector', elfinder(roots));

app.listen(process.env.PORT || 8000);
```

**Note:** This package is built as CommonJS and works with both `require()` and ES Module `import` statements.

## Configuration

The connector takes an array of volumes. All volumes must be configured with a driver before the connector is initiated.

- `driver` [**Required**] - The volume driver to use. Use `LocalFileSystemDriver` for local filesystem access, or implement a custom driver for other storage backends (S3, FTP, SSH, etc.)
- `URL` [**Required**] - The URL which will be used to resolve files
- `path` [**Required**] - The location of the folder or storage identifier
- `permissions` [optional] - An object containing the file permissions. The permissions will apply to everyone if you use an object as shown in the example above.
  You can also use a custom function which returns an object containing the permissions. This is useful for a multi-user system.

```javascript
permissions: function (path) {
  if (user.canAccess(path)) {
    return { read: 1, write: 1, lock: 0 };
  } else return { read: 0, write: 0, lock: 1 };
};
```

## Custom Drivers

As of version 2.0, elfinder-node supports custom volume drivers, allowing you to implement support for different storage backends (FTP, S3, SSH, etc.). Each volume can have its own driver configured independently.

### Creating a Custom Driver

A driver must implement the `VolumeDriver` interface with all required methods:

```typescript
import { VolumeDriver, LocalFileSystemDriver } from 'elfinder-node';

// You can extend the LocalFileSystemDriver or create from scratch
const MyCustomDriver: VolumeDriver = {
  async archive(opts) { /* ... */ },
  async dim(opts) { /* ... */ },
  async duplicate(opts) { /* ... */ },
  async extract(opts) { /* ... */ },
  async file(opts, res) { /* ... */ },
  async get(opts) { /* ... */ },
  async info() { /* ... */ },
  async ls(opts) { /* ... */ },
  async mkdir(opts) { /* ... */ },
  async mkfile(opts) { /* ... */ },
  async open(opts) { /* ... */ },
  async parents(opts) { /* ... */ },
  async paste(opts) { /* ... */ },
  async put(opts) { /* ... */ },
  async rename(opts) { /* ... */ },
  async resize(opts) { /* ... */ },
  async rm(opts) { /* ... */ },
  async size() { /* ... */ },
  async search(opts) { /* ... */ },
  async tmb(opts) { /* ... */ },
  async tree(opts) { /* ... */ },
  async upload(opts, res, files) { /* ... */ },
  async zipdl(opts) { /* ... */ },
};
```

### Using Custom Drivers

You can specify different drivers for each volume:

```javascript
const { elfinder, LocalFileSystemDriver } = require('elfinder-node');
const MyS3Driver = require('./my-s3-driver');

const roots = [
  {
    driver: LocalFileSystemDriver, // Use local file system for this volume
    URL: '/uploads/',
    path: '/path/to/local/dir',
  },
  {
    driver: MyS3Driver, // Use custom S3 driver for this volume
    URL: '/s3-files/',
    path: 's3://my-bucket/folder',
  },
];

app.use('/connector', elfinder(roots));
```

### Driver Registry

For advanced use cases, you can access the driver registry directly:

```javascript
const { driverRegistry, LocalFileSystemDriver } = require('elfinder-node');

// Set a driver for a specific volume after initialization
driverRegistry.setDriver(0, LocalFileSystemDriver);

// Get the driver for a volume
const driver = driverRegistry.getDriver(0);

// Check if a volume has a driver registered
if (driverRegistry.hasDriver(1)) {
  // Volume 1 has a driver registered
}
```

## Contributing

There is more work to be done to make this project great. View the [ROADMAP](/ROADMAP.md) for a list of tasks to be done

## Credits

Most of the work was done by [@quantv](https://github.com/quantv)


## Common Problems & Solutions on Windows/Node.js)

#### 1. Setting up connectors and file paths
- **Problem:** Issues with `target` hashes, root paths, and connector URLs (especially on Windows).
- **Solution:** Double-check your connector configuration (`roots`, `path`, `URL`) in the backend. Ensure paths use correct slashes (`\` for Windows, `/` for Linux). For initial blank targets, patch to use the correct hash (e.g., `v0_Lw` for `/` root).

### 2. "The string to be encoded contains characters outside of the Latin1 range."
- **Problem:** Base64 encoding/decoding fails with non-Latin1 strings (Unicode paths, etc.).
- **Solution:** Replace uses of the `base-64` npm package with Node.js `Buffer` for base64 encoding/decoding in `lfs.utils.js`:
  ```js
  const base64 = {
    encode: (str) => Buffer.from(str, 'utf8').toString('base64'),
    decode: (str) => Buffer.from(str, 'base64').toString('utf8')
  };
  ```
  This works for all Unicode file paths.

### 3. Search fails: "TypeError: fs.walk is not a function"
- **Problem:** elfinder-node's search uses the deprecated `fs.walk` API, which is not present in recent `fs-extra`.
- **Solution:** Replace the `api.search` implementation in `LocalFileStorage.js` with a custom async recursive function using `fs.readdir` and `fs.stat`:
  ```js
  api.search = async function (opts, res) {
    // ... see detailed code in thread ...
  };
  ```
  This removes the dependency on `fs.walk` and works for all directory trees.

### General Tip
- Always check your Node.js version and your dependencies (`fs-extra`, etc.).
- If you update elfinder-node, re-apply these fixes as needed.

---

**Thanks to the community for their help! If you need more details, see the full discussion or ask below.**
