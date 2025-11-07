import express, { Request, Response, Router } from 'express';
import * as path from 'path';
import * as busboy from 'express-busboy';
import LFS, * as api from './lfs';
import { notImplementedError } from './utils';
import { filepath, tmbfile } from './lfs.utils';
import { VolumeRoot } from './types';

const router: Router = express.Router();
const connector = api as any;

export function elfinder(roots: VolumeRoot[]): Router {
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

  router.get('/', async (req: Request, res: Response) => {
    const cmd = req.query.cmd as string;
    try {
      if (!connector[cmd]) throw notImplementedError(cmd);
      const result = await connector[cmd](req.query, res);
      if (result) res.json(result);
    } catch (e: any) {
      console.log(req.query, e);
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/', async (req: Request, res: Response) => {
    const cmd = req.body.cmd as string;
    try {
      if (!connector[cmd]) throw notImplementedError(cmd);
      const result = await connector[cmd](req.body, res, req.files?.['upload[]']);
      if (result) res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/tmb/:filename', (req: Request, res: Response) => {
    res.sendFile(tmbfile(req.params.filename));
  });

  router.get('/file/:volume/*', (req: Request, res: Response) => {
    const file = filepath(parseInt(req.params.volume), req.params['0']);
    if (file) res.sendFile(file);
    else {
      res.status(404);
      res.send();
    }
  });

  return router;
}

export { LFS as LocalFileStorage, LFS };
