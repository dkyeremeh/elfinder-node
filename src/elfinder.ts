import * as path from 'path';
import * as yup from 'yup';
import express, { Request, Response, Router } from 'express';
import * as busboy from 'express-busboy';
import LFS from './lfs';
import { notImplementedError } from './utils';
import { VolumeRoot, VolumeDriver } from './types';
import { DriverRegistry } from './driverRegistry';

export type { VolumeDriver, VolumeRoot };

const stripTraversal = (p: string) =>
  p
    .split('/')
    .filter((seg) => seg !== '..' && seg !== '')
    .join('/');

const optsSchema = yup.object({
  name: yup.string().transform((v) => path.basename(v)),
  chunk: yup.string().transform((v) => path.basename(v)),
  dirs: yup.array(yup.string().transform((v) => path.basename(v))),
  suffix: yup
    .string()
    .test('no-path-sep', 'errInvParams', (v) => !v || !/[/\\]/.test(v)),
  upload_path: yup.array(yup.string().transform(stripTraversal)),
});

const filesSchema = yup.array(
  yup
    .object({ filename: yup.string().transform((v) => path.basename(v)) })
    .nullable()
    .default(null),
);

export function elfinder(roots: VolumeRoot[]): Router {
  const registry = new DriverRegistry();
  registry.initialize(roots);

  const router: Router = express.Router();

  busboy.extend(router, {
    upload: true,
  });

  router.get('/', async (req: Request, res: Response) => {
    const cmd = req.query.cmd as string;
    try {
      const driver = registry.getDriverForRequest(req.query);
      if (typeof driver[cmd] !== 'function') throw notImplementedError(cmd);

      const opts = await optsSchema.validate(req.query);

      const result = await driver[cmd](opts, res);
      if (result) res.json(result);
    } catch (e: any) {
      console.error(req.query, e);
      const status = e instanceof yup.ValidationError ? 400 : 500;
      res.status(status).json({ error: e.message });
    }
  });

  router.post('/', async (req: Request, res: Response) => {
    const cmd = req.body.cmd as string;
    try {
      const driver = registry.getDriverForRequest(req.query);
      if (typeof driver[cmd] !== 'function') throw notImplementedError(cmd);

      const opts = await optsSchema.validate(req.body);
      const rawFiles = req.files?.['upload[]'];
      const files = await filesSchema.validate(
        Array.isArray(rawFiles) ? rawFiles : [rawFiles],
      );

      const result = await driver[cmd](opts, res, files);
      if (result) res.json(result);
    } catch (e: any) {
      console.error(req.body, e);
      const status = e instanceof yup.ValidationError ? 400 : 500;
      res.status(status).json({ error: e.message });
    }
  });

  return router;
}

export { LFS as LocalFileStorage, LFS, DriverRegistry };
