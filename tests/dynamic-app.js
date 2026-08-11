const { resolve } = require('path');
const fs = require('fs-extra');
const express = require('express');
const app = express();
const { elfinder, LocalFileStorage } = require('../dist/elfinder');

const usersDir = resolve(__dirname, '../media/users');

app.use('/connector', (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'missing x-user-id' });

  const userDir = resolve(usersDir, userId);
  fs.mkdirpSync(userDir);

  elfinder([
    {
      driver: LocalFileStorage,
      URL: `/users/${userId}/`,
      path: userDir,
      permissions: { read: 1, write: 1, lock: 0 },
    },
  ])(req, res, next);
});

module.exports = app;
