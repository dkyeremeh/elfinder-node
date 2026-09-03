const { resolve } = require('path');
const fs = require('fs-extra');
const express = require('express');
const app = express();
const { elfinder, LocalFileStorage } = require('../dist/elfinder');

const uploadsDir = resolve(__dirname, '../media/uploads');

app.use('/uploads', express.static(uploadsDir));

app.use('/connector', (req, res, next) =>
  elfinder([
    {
      driver: LocalFileStorage,
      URL: '/uploads/', //Required
      path: uploadsDir, //Required
      name: 'Uploads',
      permissions: { read: 1, write: 1 },
    },
  ])(req, res, next)
);
app.get('/', function (req, res) {
  res.sendFile(resolve(__dirname, './elfinder.html'));
});

fs.mkdirpSync(uploadsDir);

module.exports = app;
