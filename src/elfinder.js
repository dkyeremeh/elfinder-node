const express = require('express');
const router = express.Router();
const path = require('path');
const LFS = require('./LocalFileStorage');
const connector = LFS.api;

//Configure busboy
const busboy = require('express-busboy');
const { notImplementedError } = require('./utils');
const { filepath } = require('./lfs.utils');

module.exports = function (roots) {
  const volumes = roots.map((r) => r.path);
  const tmbroot = path.resolve(volumes[0], '.tmb');

  LFS({
    roots,
    volumes,
    tmbroot,
  });

  busboy.extend(router, {
    upload: true,
  });

  router.get('/', async function (req, res) {
    const cmd = req.query.cmd;
    try {
      if (!connector[cmd]) throw notImplementedError(cmd);
      const result = await connector[cmd](req.query, res);
      if (result) res.json(result);
    } catch (e) {
      console.log(e);
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/', async function (req, res) {
    const cmd = req.body.cmd;
    try {
      if (!connector[cmd]) throw notImplementedError(cmd);
      const result = await connector[cmd](
        req.body,
        res,
        req.files?.['upload[]']
      );
      if (result) res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/tmb/:filename', function (req, res) {
    res.sendFile(connector.tmbfile(req.params.filename));
  });

  // Fallback file access in case URL is not defined
  router.get('/file/:volume/*', function (req, res) {
    const file = filepath(req.params.volume, req.params['0']);
    if (file) res.sendFile(file);
    else {
      res.status(404);
      res.send();
    }
  });

  return router;
};

module.exports.LocalFileStorage = LFS;
