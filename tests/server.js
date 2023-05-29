const path = require('path');
const fs = require('fs-extra');
const express = require('express');
const app = express();
const elFinder = require('../');

const uploadsDir = path.resolve(__dirname, '../media/uploads');
const privateDir = path.resolve(__dirname, '../media/private');

const port = process.env.PORT || 8000;
const roots = [
  {
    driver: elFinder.LocalFileStorage,
    URL: '/uploads/', //Required
    path: uploadsDir, //Required
    permissions: { read: 1, write: 1, lock: 0 },
  },
  {
    driver: elFinder.LocalFileStorage,
    URL: '/404/', //Required
    path: privateDir, //Required
    permissions: { read: 1, write: 0, lock: 1 },
  },
];

app.use('/connector', elFinder(roots));
app.get('/', function (req, res) {
  res.sendFile(path.resolve(__dirname, './elfinder.html'));
});

app.listen(port, function () {
  console.log('Listening on port: ' + port);
});

fs.mkdirpSync(uploadsDir);
fs.mkdirpSync(privateDir);
