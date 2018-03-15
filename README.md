## elFinder NodeJS Connector

This is connector for elFinder in nodejs. It currently implements LocalFileStorage only.

## Installation

```
npm install elfinder-node --save
```

## Usage

This package should be implemented as a middleware for Expressjs server

```javascript
const express = require("express");
const app = express();
const elFinder = require("elfinder-node");

const roots = [
    {
        driver: elFinder.LocalFileStorage
        URL: "/uploads/",       //Required
        path: "/path/to/dir",   //Required
        permissions: { read:1, write: 1, lock: 0 }
    },
    {
        driver: elFinder.LocalFileStorage
        URL: "/404/",       //Required
        path: "private",    //Required
        permissions: { read:1, write: 0, lock: 1 }
    },
];

app.use( "/connector", elFinder( roots ) );

app.listen( process.env.PORT || 8000 );
```

## Configuration
The connector takes an array of volumes. All volumes are local files and must be created before the connector is initiated

- `driver` [optional] - The volume driver to use. Only LocalFileStorage is implemented at the moment and is the default
- `URL` [Required] - the url which will be used to resolve files
- `path` [Required]  - The location of the folder
- `permissions` [optional] - An object containing the file permission. Very useful when implementing a multi-user system

## Missing Features
Most of the elFinder function are working with the exception of these:
- chmod:    change file permission
- mkfile:   create text files
- put:      save edited text
- extract   extract archive
- size


## Credits
Most of the work was done by [@quantv](https://github.com/quantv)
