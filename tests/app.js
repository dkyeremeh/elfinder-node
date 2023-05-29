const path = require('path');
const fs = require('fs-extra');
const express = require('express');
const app = express();
const elFinder = require('../');

const uploadsDir = path.resolve(__dirname, '../media/uploads');
const roots = [
  {
    driver: elFinder.LocalFileStorage,
    URL: '/uploads/', //Required
    path: uploadsDir, //Required
    permissions: { read: 1, write: 1, lock: 0 },
  },
];

app.use('/connector', elFinder(roots));
app.get('/', function (req, res) {
  res.sendFile(path.resolve(__dirname, './elfinder.html'));
});

fs.mkdirpSync(uploadsDir);

module.exports = app;
