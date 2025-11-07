import * as path from 'path';
import * as mime from 'mime-types';
import * as _ from 'underscore';
import Jimp from 'jimp';
import * as fs from 'fs-extra';
import { Response } from 'express';
import * as helpers from './lfs.utils';
import { DriverSetup, FileInfo } from './types';

const defaultOptions = {
  disabled: ['chmod', 'size'],
  icon: 'elfinder-navbar-root-local',
  permissions: { read: 1, write: 1, locked: 0 },
};

const LFS: DriverSetup = (options: Partial<helpers.LFSConfig>) => {
  const config = {
    tmbroot: path.resolve(options.path!, '.tmb'),
    ...defaultOptions,
    ...options,
  } as helpers.LFSConfig;

  config.acl = function (filePath: string) {
    const perms = config.permissions;
    const permissions = perms instanceof Function ? perms(filePath) : perms;
    return (
      permissions || {
        read: 1,
        write: 1,
        locked: 0,
      }
    );
  };

  return {
    archive: async function (opts) {
      const target = helpers.decode(opts.target, config);
      const filePath = path.join(target.absolutePath, opts.name);
      await helpers.compress(opts.targets, filePath, config);

      return {
        added: [await helpers.info(filePath, config)],
      };
    },

    dim: async function (opts) {
      const target = helpers.decode(opts.target, config);
      const img = await Jimp.read(target.absolutePath);
      return {
        dim: img.bitmap.width + 'x' + img.bitmap.height,
      };
    },

    duplicate: async function (opt) {
      const tasks = opt.targets.map(async (target: string) => {
        const _t = helpers.decode(target, config);
        const ext = path.extname(_t.name);
        const fil = path.basename(_t.name, ext);
        const name = fil + '(copy)' + ext;
        const base = path.dirname(_t.absolutePath);

        return helpers.copy(
          {
            src: _t.absolutePath,
            dst: path.join(base, name),
          },
          config
        );
      });

      const info = await Promise.all(tasks);

      return {
        added: info.map((i) => i.added[0]),
      };
    },

    extract: async function (opts) {
      const target = helpers.decode(opts.target, config);
      const mkdir = opts.makedir == 1;

      let dest = path.dirname(target.absolutePath);
      if (mkdir) {
        const newDir = path.basename(target.absolutePath).split('.')[0];
        const newDirPath = path.resolve(dest, newDir);
        await fs.mkdirp(newDirPath);
        dest = newDirPath;
      }

      const files = await helpers.extract(target.absolutePath, dest);
      const tasks = files.map(async (file) =>
        helpers.info(path.resolve(dest, file), config)
      );

      return { added: await Promise.all(tasks) };
    },

    file: async function (opts, res: Response): Promise<void> {
      const target = helpers.decode(opts.target, config);
      res.sendFile(target.absolutePath);
    },

    get: async function (opts) {
      const target = helpers.decode(opts.target, config);
      const content = await fs.readFile(target.absolutePath, 'utf8');
      return { content };
    },

    info: async function () {},

    ls: async function (opts) {
      if (!opts.target) throw new Error('errCmdParams');

      const info = helpers.decode(opts.target, config);
      const files = await helpers.readdir(info.absolutePath);
      let list = files.map((e) => e.name);
      if (opts.intersect) {
        list = _.intersection(list, opts.intersect);
      }

      return { list };
    },

    mkdir: async function (opts) {
      const dir = helpers.decode(opts.target, config);
      const dirs = opts.dirs || [];
      if (opts.name) {
        dirs.push(opts.name);
      }

      const tasks = dirs.map(async (name: string) => {
        const _dir = path.join(dir.absolutePath, name);
        await fs.mkdirp(_dir);
        return helpers.info(_dir, config);
      });

      const added = await Promise.all(tasks);
      return { added };
    },

    mkfile: async function (opts) {
      const dir = helpers.decode(opts.target, config);
      const name = opts.name;
      const filePath = dir.absolutePath + path.sep + name;

      await fs.writeFile(filePath, '');
      return { added: [await helpers.info(filePath, config)] };
    },

    open: async function (opts) {
      let volumes: FileInfo[] | undefined;
      let targetHash = opts.target;
      const init = opts.init == true;
      const encodedRoot = helpers.encode(config.path + path.sep, config);
      const data: any = {
        options: {
          uiCmdMap: [],
          tmbUrl: path.join(config.URL, '.tmb/'),
        },
      };

      if (init) {
        config.init?.();
        targetHash = targetHash || encodedRoot;
      }
      if (!targetHash) throw new Error('errCmdParams');

      let target = helpers.decode(targetHash, config);
      const dirExists = await fs.pathExists(target.absolutePath);
      if (!dirExists) target = helpers.decode(encodedRoot, config);

      let files =
        (await fs.readdir(target.absolutePath).catch(console.log)) || [];
      const tasks = files.map(async (file: string) =>
        helpers.info(path.join(target.absolutePath, file), config)
      );

      data.files = await Promise.all(tasks);
      data.cwd = await helpers.info(target.absolutePath, config);

      if (init) {
        data.api = '2.1';
        volumes = await helpers.init(config);
        data.files = volumes.concat(data.files);
      }

      return data;
    },

    parents: async function (opts) {
      if (!opts.target) throw new Error('errCmdParams');

      const dir = helpers.decode(opts.target, config);
      let tree: FileInfo[] = await helpers.init(config);

      const read = async (t: string): Promise<void> => {
        const folder = path.dirname(t);
        const isRoot = config.path === t;

        if (!isRoot) {
          const files = await helpers.readdir(folder);
          const tasks: Promise<FileInfo>[] = [];

          _.each(files, (file) => {
            if (file.isdir) {
              tasks.push(helpers.info(path.join(folder, file.name), config));
            }
          });

          const folders = await Promise.all(tasks);
          tree = tree.concat(folders);
          await read(folder);
        }
      };

      await read(dir.absolutePath);

      return { tree };
    },

    paste: async function (opts) {
      const dest = helpers.decode(opts.dst, config);

      const tasks = opts.targets.map(async (target: string) => {
        const info = helpers.decode(target, config);
        let name = info.name;
        if (opts.renames && opts.renames.indexOf(info.name) >= 0) {
          const ext = path.extname(name);
          const fil = path.basename(name, ext);
          name = fil + opts.suffix + ext;
        }

        const action = opts.cut == 1 ? helpers.move : helpers.copy;
        return action(
          {
            src: info.absolutePath,
            dst: path.join(dest.absolutePath, name),
          },
          config
        );
      });

      const results = await Promise.all(tasks);

      const rtn = {
        added: [] as FileInfo[],
        removed: [] as string[],
        changed: [] as string[],
      };

      results.forEach((r) => {
        rtn.added.push(r.added[0]);
        if (r.removed?.length) {
          rtn.removed.push(r.removed[0]);
        }
        if (r.changed?.length && rtn.changed.indexOf(r.changed[0]) < 0) {
          rtn.changed.push(r.changed[0]);
        }
      });

      return rtn;
    },

    put: async function (opts) {
      const target = helpers.decode(opts.target, config);
      const { content } = opts;

      await fs.writeFile(target.absolutePath, content);
      const info = await helpers.info(target.absolutePath, config);
      return { changed: [info] };
    },

    rename: async function (opts) {
      if (!opts.target) throw new Error('errCmdParams');
      const dir = helpers.decode(opts.target, config);
      const dirname = path.dirname(dir.absolutePath);
      return helpers.move(
        {
          src: dir.absolutePath,
          dst: path.join(dirname, opts.name),
        },
        config
      );
    },

    resize: async function (opts) {
      const target = helpers.decode(opts.target, config);
      let image = await Jimp.read(target.absolutePath);

      if (opts.mode == 'resize') {
        image = image.resize(parseInt(opts.width), parseInt(opts.height));
      } else if (opts.mode == 'crop') {
        image = image.crop(
          parseInt(opts.x),
          parseInt(opts.y),
          parseInt(opts.width),
          parseInt(opts.height)
        );
      } else if (opts.mode == 'rotate') {
        image = image.rotate(parseInt(opts.degree));
        if (opts.bg) {
          image = image.background(parseInt(opts.bg.substr(1, 6), 16));
        }
      }

      await new Promise((resolve, reject) => {
        image
          .quality(parseInt(opts.quality))
          .write(target.absolutePath, (err) => {
            if (err) reject(err);
            else resolve(undefined);
          });
      });
      const info = await helpers.info(target.absolutePath, config);
      info.tmb = '1';

      return {
        changed: [info],
      };
    },

    rm: async function (opts) {
      const removed: string[] = [];

      for (const hash of opts.targets) {
        const target = helpers.decode(hash, config);
        await fs.remove(target.absolutePath);
        removed.push(hash);
      }

      return { removed };
    },

    size: async function () {
      return {
        size: 'unkown',
      };
    },

    search: async function (opts) {
      if (!opts.q || opts.q.length < 1) {
        throw new Error('errCmdParams');
      }

      const target = helpers.decode(opts.target, config);
      const tasks: Promise<FileInfo>[] = [];

      const searchRecursive = async (dir: string): Promise<void> => {
        const items = await fs.readdir(dir, { withFileTypes: true });

        for (const item of items) {
          const itemPath = path.join(dir, item.name);

          if (item.name.indexOf(opts.q) >= 0) {
            tasks.push(helpers.info(itemPath, config));
          }

          if (item.isDirectory()) {
            await searchRecursive(itemPath);
          }
        }
      };

      await searchRecursive(target.absolutePath);
      const files = await Promise.all(tasks);

      return { files };
    },

    tmb: async function (opts) {
      const files: string[] = [];

      if (opts.current) {
        const dir = helpers.decode(opts.current, config);
        const items = await fs.readdir(dir.absolutePath);

        _.each(items, (item) => {
          const _m = mime.lookup(item);
          if (_m !== false && _m.indexOf('image/') == 0) {
            files.push(path.join(dir.absolutePath, item));
          }
        });
      } else if (opts.targets) {
        _.each(opts.targets, (target: string) => {
          const _t = helpers.decode(target, config);
          files.push(_t.absolutePath);
        });
      }

      const tasks: Promise<string>[] = [];

      _.each(files, (file) => {
        tasks.push(
          Jimp.read(file).then(async (img) => {
            const op = helpers.encode(file, config);
            await new Promise<void>((resolve, reject) => {
              img
                .resize(48, 48)
                .write(path.join(config.tmbroot, op + '.png'), (err) => {
                  if (err) reject(err);
                  else resolve();
                });
            });
            return op;
          })
        );
      });

      const hashes = await Promise.all(tasks);
      const rtn: { [key: string]: string } = {};

      _.each(hashes, (hash) => {
        rtn[hash] = hash + '.png';
      });

      return {
        images: rtn,
      };
    },

    tree: async function (opts) {
      if (!opts.target) throw new Error('errCmdParams');
      const dir = helpers.decode(opts.target, config);
      const files = await helpers.readdir(dir.absolutePath);

      const tasks = files.map(async (file) => {
        if (file.isdir) {
          return helpers.info(path.join(dir.absolutePath, file.name), config);
        }
      });

      const tree = await Promise.all(tasks);
      return { tree };
    },

    upload: async function (opts, _res, _files?) {
      const target = helpers.decode(opts.target, config);

      // Handle chunked upload
      if (opts.chunk && opts.range) {
        const chunkFile = _files instanceof Array ? _files[0] : _files;
        if (!chunkFile) {
          throw new Error('Chunk file not provided');
        }

        let dst = target.absolutePath;
        if (opts.upload_path && opts.upload_path[0]) {
          dst = path.join(dst, path.dirname(opts.upload_path[0]));
        }

        const result = await helpers.handleChunkUpload({
          chunkName: opts.chunk,
          chunkFile: chunkFile.file,
          range: opts.range,
          destinationDir: dst,
        });

        if (result.isComplete && result.finalPath) {
          // Return file info for the completed upload
          const fileInfo = await helpers.info(result.finalPath, config);
          return { added: [fileInfo] };
        } else {
          // Not the last chunk, return empty response
          const chunkName = opts.chunk;
          const realFilename = chunkName.replace(/\.\d+_\d+\.part$/, '');
          return {
            added: [],
            _chunkmerged: chunkName,
            _name: realFilename,
          };
        }
      }

      // Handle regular upload (non-chunked)
      const files = _files instanceof Array ? _files : [_files!];

      const tasks = files
        .filter((file) => file !== undefined)
        .map(async (file, i) => {
          let filename = file.filename;
          let dst = target.absolutePath;
          if (opts.upload_path) {
            dst = path.join(dst, path.dirname(opts.upload_path[i]));
          }

          if (opts.renames?.indexOf(file.filename) && opts.suffix) {
            filename = helpers.suffix(file.filename, opts.suffix);
          }
          dst = path.join(dst, filename);

          return helpers.move(
            {
              dst,
              src: file.file,
              upload: true,
            },
            config
          );
        });

      const info = await Promise.all(tasks);
      const added = info.map((i) => i.added[0]);

      return { added };
    },

    zipdl: async function (opts) {
      if (!opts.targets?.length) throw new Error('errCmdParams');

      const firstHash = opts.targets[0];
      const first = helpers.decode(firstHash, config);
      const dir = path.dirname(first.absolutePath);
      const name = path.basename(dir);
      const file = path.join(dir, name + '.zip');

      await helpers.compress(opts.targets, file, config);

      return {
        zipdl: {
          file: helpers.encode(file, config),
          name: name + '.zip',
          mime: 'application/zip',
        },
      };
    },
  };
};

export default LFS;
