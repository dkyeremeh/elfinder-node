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
    URL: 'https://google.com/uploads/', //Required
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

You can also define roots dynamically per request — useful for serving a different root directory per user:

```javascript
app.use('/connector', (req, res, next) =>
  elfinder([
    {
      driver: LocalFileStorage,
      URL: `/uploads/${req.user.id}/`,
      path: `/storage/${req.user.id}`,
      permissions: { read: 1, write: 1, lock: 0 },
    },
  ])(req, res, next)
);
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

### Options

`elfinder(roots, options)` accepts an optional second argument:

- `busboy` [optional, default `true`] - The connector parses multipart uploads with its own `express-busboy` instance. Set this to `false` if your host app already runs a multipart parser ahead of this router (e.g. a global `express-busboy`/`busboy` middleware mounted on `app`). The raw request stream can only be read once, so running a second parser here would hang waiting on an already-drained stream — with `busboy: false`, the connector trusts `req.body`/`req.files` to already be populated by your own parser instead.

```javascript
const express = require('express');
const busboy = require('express-busboy');
const { elfinder, LocalFileStorage } = require('elfinder-node');

const app = express();

// Host app's own global multipart parser, mounted ahead of the connector
busboy.extend(app, { upload: true });

const roots = [
  {
    driver: LocalFileStorage,
    URL: '/uploads/',
    path: '/path/to/dir',
    permissions: { read: 1, write: 1, lock: 0 },
  },
];

// busboy: false — reuse req.body/req.files already populated above instead
// of parsing the request a second time
app.use('/connector', elfinder(roots, { busboy: false }));

app.listen(process.env.PORT || 8000);
```

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
