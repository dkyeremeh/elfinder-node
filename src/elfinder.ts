import express, { Request, Response, Router } from 'express';
import * as busboy from 'express-busboy';
import LFS from './lfs';
import { notImplementedError } from './utils';
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
      const driver = driverRegistry.getDriverForRequest(req.query);
      if (typeof driver[cmd] !== 'function') throw notImplementedError(cmd);

      const result = await driver[cmd](req.query as any, res);
      if (result) res.json(result);
    } catch (e: any) {
      console.error(req.query, e);
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/', async (req: Request, res: Response) => {
    const cmd = req.body.cmd as string;
    try {
      const driver = driverRegistry.getDriverForRequest(req.query);
      if (typeof driver[cmd] !== 'function') throw notImplementedError(cmd);

      const result = await driver[cmd](
        req.body as any,
        res,
        req.files?.['upload[]']
      );
      if (result) res.json(result);
    } catch (e: any) {
      console.error(req.body, e);
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}

export { LFS as LocalFileStorage, LFS, driverRegistry };
