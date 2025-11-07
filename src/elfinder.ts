import express, { Request, Response, Router } from 'express';
import * as busboy from 'express-busboy';
import LFS from './lfs';
import { notImplementedError, getTargetVolume } from './utils';
import { filepath, tmbfile } from './lfs.utils';
import { VolumeRoot, VolumeDriver } from './types';
import { driverRegistry } from './driverRegistry';

export type { VolumeDriver, VolumeRoot };

const router: Router = express.Router();

export function elfinder(roots: VolumeRoot[]): Router {
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
    // Get the first driver's config for thumbnail path
    const driver = driverRegistry.getDriver(0);
    res.sendFile(tmbfile(req.params.filename, driver.config));
  });

  router.get('/file/:volume/*', (req: Request, res: Response) => {
    const volumeIndex = parseInt(req.params.volume);
    const driver = driverRegistry.getDriver(volumeIndex);
    const file = filepath(volumeIndex, req.params['0'], driver.config);
    if (file) res.sendFile(file);
    else {
      res.status(404);
      res.send();
    }
  });

  return router;
}

export { LFS as LocalFileStorage, LFS, driverRegistry };
