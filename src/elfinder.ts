import express, { Request, Response, Router } from 'express';
import * as path from 'path';
import * as busboy from 'express-busboy';
import LFS, { LocalFileSystemDriver } from './lfs';
import { notImplementedError, getTargetVolume } from './utils';
import { filepath, tmbfile } from './lfs.utils';
import { VolumeRoot, VolumeDriver } from './types';
import { driverRegistry } from './driver-registry';

export type { VolumeDriver, VolumeRoot };

const router: Router = express.Router();

export function elfinder(roots: VolumeRoot[]): Router {
  const volumes = roots.map((r) => r.path);
  const tmbroot = path.resolve(volumes[0], '.tmb');

  // Initialize LFS configuration (needed for lfs.utils helpers)
  LFS({
    roots,
    volumes,
    tmbroot,
  });

  // Initialize the driver registry with all volumes
  driverRegistry.initialize(roots);

  busboy.extend(router, {
    upload: true,
  });

  router.get('/', async (req: Request, res: Response) => {
    const cmd = req.query.cmd as string;
    try {
      // Determine which volume this command targets
      const volumeIndex = getTargetVolume(req.query);
      const driver = driverRegistry.getDriver(volumeIndex);

      // Check if the driver implements this command
      const driverMethod = driver[cmd as keyof typeof driver];
      if (!driverMethod || typeof driverMethod !== 'function') {
        throw notImplementedError(cmd);
      }

      const result = await driverMethod(req.query as any, res);
      if (result) res.json(result);
    } catch (e: any) {
      console.error(req.query, e);
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/', async (req: Request, res: Response) => {
    const cmd = req.body.cmd as string;
    try {
      // Determine which volume this command targets
      const volumeIndex = getTargetVolume(req.body);
      const driver = driverRegistry.getDriver(volumeIndex);

      // Check if the driver implements this command
      const driverMethod = driver[cmd as keyof typeof driver];
      if (!driverMethod || typeof driverMethod !== 'function') {
        throw notImplementedError(cmd);
      }

      const result = await driverMethod(
        req.body as any,
        res,
        req.files?.['upload[]']
      );
      if (result) res.json(result);
    } catch (e: any) {
      console.error(req.query, e);
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

export { LFS as LocalFileStorage, LFS, LocalFileSystemDriver, driverRegistry };
