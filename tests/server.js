const express = require('express');
const app = express();
const elFinder = require('../');

const port = process.env.PORT || 8000;
const roots = [
  {
    driver: elFinder.LocalFileStorage,
    URL: '/uploads/', //Required
    path: '../media/uploads', //Required
    permissions: { read: 1, write: 1, lock: 0 },
  },
  {
    driver: elFinder.LocalFileStorage,
    URL: '/404/', //Required
    path: '../media/private', //Required
    permissions: { read: 1, write: 0, lock: 1 },
  },
];

app.use('/connector', elFinder(roots));

app.listen(port, function () {
  console.log('Listening on port: ' + port);
});
