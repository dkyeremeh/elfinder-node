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
const { elfinder, LocalFileStorage } = require('elfinder-node');

const roots = [
  {
    driver: LocalFileStorage,
    URL: '/uploads/', //Required
    path: '/path/to/dir', //Required
    permissions: { read: 1, write: 1, lock: 0 },
  },
  {
    driver: LocalFileStorage,
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

- `driver` [**Required**] - The volume driver to use. Use `LocalFileStorage` for local filesystem access, or implement a custom driver for other storage backends (S3, FTP, SSH, etc.)
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

### Important Note on Driver Architecture

The current implementation uses a **shared global configuration** for LocalFileStorage. This means:

- The `elfinder()` function initializes LFS with configuration for ALL volumes
- This allows cross-volume operations (copy/paste between different volumes)
- Each volume can still specify `LocalFileStorage` as its driver
- Custom drivers can be implemented per-volume as needed

### Creating a Custom Driver

A driver must implement the `VolumeDriver` interface with all required methods:

```typescript
import { VolumeDriver, LocalFileStorage } from 'elfinder-node';

// You can extend the LocalFileStorage or create from scratch
const MyCustomDriver: VolumeDriver = {
  async archive(opts) {
    /* ... */
  },
  async dim(opts) {
    /* ... */
  },
  async duplicate(opts) {
    /* ... */
  },
  async extract(opts) {
    /* ... */
  },
  async file(opts, res) {
    /* ... */
  },
  async get(opts) {
    /* ... */
  },
  async info() {
    /* ... */
  },
  async ls(opts) {
    /* ... */
  },
  async mkdir(opts) {
    /* ... */
  },
  async mkfile(opts) {
    /* ... */
  },
  async open(opts) {
    /* ... */
  },
  async parents(opts) {
    /* ... */
  },
  async paste(opts) {
    /* ... */
  },
  async put(opts) {
    /* ... */
  },
  async rename(opts) {
    /* ... */
  },
  async resize(opts) {
    /* ... */
  },
  async rm(opts) {
    /* ... */
  },
  async size() {
    /* ... */
  },
  async search(opts) {
    /* ... */
  },
  async tmb(opts) {
    /* ... */
  },
  async tree(opts) {
    /* ... */
  },
  async upload(opts, res, files) {
    /* ... */
  },
  async zipdl(opts) {
    /* ... */
  },
};
```

### Using Custom Drivers

You can specify different drivers for each volume:

```javascript
const { elfinder, LocalFileStorage } = require('elfinder-node');
const MyS3Driver = require('./my-s3-driver');

const roots = [
  {
    driver: LocalFileStorage, // Use local file system for this volume
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
const { driverRegistry, LocalFileStorage } = require('elfinder-node');

// Set a driver for a specific volume after initialization
driverRegistry.setDriver(0, LocalFileStorage);

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

## Troubleshooting

### Path Configuration

When setting up your volumes, ensure you provide correct paths for your operating system:

```javascript
const roots = [
  {
    driver: LocalFileStorage,
    path: 'C:\\Users\\username\\uploads'  // Windows
    URL: '/uploads/',
    permissions: { read: 1, write: 1, lock: 0 }
  }
];
```

---

**Thanks to [@quantv](https://github.com/quantv) and the community for their contributions!**
