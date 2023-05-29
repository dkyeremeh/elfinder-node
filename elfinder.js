const express = require('express');
const router = express.Router();
const path = require('path');
const promise = require('promise');
const multer = require('multer');
const fs = require('fs-extra');
const _ = require('underscore');
const LFS = require('./LocalFileStorage');
const connector = LFS.api;
const utils = require('./utils');

module.exports = function (roots) {
  const volumes = roots.map((r) => r.path);
  const media = path.resolve(volumes[0]);

  LFS({
    roots: roots,
    tmbroot: path.join(media, '.tmb'),
    volumes: volumes,
  });

  router.get('/', async function (req, res, next) {
    const cmd = req.query.cmd;
    if (cmd && connector[cmd]) {
      const result = await connector[cmd](req.query, res).catch((e) =>
        res.json({ error: e.message })
      );

      res.json(result);
    } else {
      res.json({ error: cmd + ' is not implemented by volume driver' });
    }
  });

  const upload = multer({ dest: 'media/.tmp/' });

  router.post(
    '/',
    upload.array('upload[]', 10),
    async function (req, res, next) {
      const cmd = req.body.cmd;
      if (cmd && connector[cmd]) {
        const result = await connector[cmd](req.body, res, req.files).catch(
          (e) => res.json({ error: e.message })
        );

        res.json(result);
      } else {
        res.json({ error: cmd + ' is not implemented by volume driver' });
      }
    }
  );

  router.get('/tmb/:filename', function (req, res, next) {
    res.sendFile(connector.tmbfile(req.params.filename));
  });

  //TODO: Remove this code after removing its dependency in LFS
  router.get('/file/:volume/*', function (req, res, next) {
    const file = connector.filepath(req.params.volume, req.params['0']);
    if (file) res.sendFile(file);
    else {
      res.status(404);
      res.send();
    }
  });

  return router;
};

module.exports.LocalFileStorage = LFS;
module.exports.utils = utils;
