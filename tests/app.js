const { resolve } = require('path');
const fs = require('fs-extra');
const express = require('express');
const app = express();
const elFinder = require('../dist/elfinder');

const uploadsDir = resolve(__dirname, '../media/uploads');
const roots = [
  {
    driver: elFinder.LocalFileStorage,
    URL: '/uploads/', //Required
    path: uploadsDir, //Required
    permissions: { read: 1, write: 1, lock: 0 },
  },
];

app.use('/uploads', express.static(uploadsDir));

app.use('/connector', elFinder(roots));
app.get('/', function (req, res) {
  res.sendFile(resolve(__dirname, './elfinder.html'));
});

fs.mkdirpSync(uploadsDir);

module.exports = app;
