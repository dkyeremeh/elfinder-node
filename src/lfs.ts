import * as path from 'path';
import * as mime from 'mime-types';
import * as _ from 'underscore';
import Jimp from 'jimp';
import * as fs from 'fs-extra';
import { Response } from 'express';
import * as helpers from './lfs.utils';
import {
  Config,
  ApiCommands,
  FileInfo,
  UploadedFile,
  ArchiveOpts,
  DimOpts,
  DuplicateOpts,
  ExtractOpts,
  FileOpts,
  GetOpts,
  LsOpts,
  MkdirOpts,
  MkfileOpts,
  OpenOpts,
  ParentsOpts,
  PasteOpts,
  PutOpts,
  RenameOpts,
  ResizeOpts,
  RmOpts,
  SearchOpts,
  TmbOpts,
  TreeOpts,
  UploadOpts,
  ZipdlOpts,
} from './types';

const api: Partial<ApiCommands> = {};

const config: Partial<Config> = {
  router: '/connector',
  disabled: ['chmod', 'size'],
  volumeicons: ['elfinder-navbar-root-local', 'elfinder-navbar-root-local'],
};

config.acl = function (filePath: string) {
  const volume = helpers.volume(filePath);
  const perms = config.roots![volume].permissions;
  const permissions = perms instanceof Function ? perms(filePath) : perms;
  return (
    permissions || {
      read: 1,
      write: 1,
      locked: 0,
    }
  );
};

api.archive = async (opts: ArchiveOpts) => {
  const target = helpers.decode(opts.target);
  const filePath = path.join(target.absolutePath, opts.name);
  await helpers.compress(opts.targets, filePath);

  return {
    added: [await helpers.info(filePath)],
  };
};

api.dim = async (opts: DimOpts) => {
  const target = helpers.decode(opts.target);
  const img = await Jimp.read(target.absolutePath);
  return {
    dim: img.bitmap.width + 'x' + img.bitmap.height,
  };
};

api.duplicate = async (opt: DuplicateOpts) => {
  const tasks = opt.targets.map(async (target: string) => {
    const _t = helpers.decode(target);
    const ext = path.extname(_t.name);
    const fil = path.basename(_t.name, ext);
    const name = fil + '(copy)' + ext;
    const base = path.dirname(_t.absolutePath);

    return helpers.copy({
      src: _t.absolutePath,
      dst: path.join(base, name),
    });
  });

  const info = await Promise.all(tasks);

  return {
    added: info.map((i) => i.added[0]),
  };
};

api.extract = async (opts: ExtractOpts) => {
  const target = helpers.decode(opts.target);
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
    helpers.info(path.resolve(dest, file))
  );

  return { added: await Promise.all(tasks) };
};

api.file = async (opts: FileOpts, res: Response): Promise<void> => {
  const target = helpers.decode(opts.target);
  res.sendFile(target.absolutePath);
};

api.get = async (opts: GetOpts) => {
  const target = helpers.decode(opts.target);
  const content = await fs.readFile(target.absolutePath, 'utf8');
  return { content };
};

api.info = async () => {};

api.ls = async (opts: LsOpts) => {
  if (!opts.target) throw new Error('errCmdParams');

  const info = helpers.decode(opts.target);
  const files = await helpers.readdir(info.absolutePath);
  let list = files.map((e) => e.name);
  if (opts.intersect) {
    list = _.intersection(list, opts.intersect);
  }

  return { list };
};

api.mkdir = async (opts: MkdirOpts) => {
  const dir = helpers.decode(opts.target);
  const dirs = opts.dirs || [];
  if (opts.name) {
    dirs.push(opts.name);
  }

  const tasks = dirs.map(async (name: string) => {
    const _dir = path.join(dir.absolutePath, name);
    await fs.mkdirp(_dir);
    return helpers.info(_dir);
  });

  const added = await Promise.all(tasks);
  return { added };
};

api.mkfile = async (opts: MkfileOpts) => {
  const dir = helpers.decode(opts.target);
  const name = opts.name;
  const filePath = dir.absolutePath + path.sep + name;

  await fs.writeFile(filePath, '');
  return { added: [await helpers.info(filePath)] };
};

api.open = async (opts: OpenOpts) => {
  let volumes: FileInfo[] | undefined;
  let targetHash = opts.target;
  const init = opts.init == true;
  const encodedRoot = helpers.encode(config.volumes![0] + path.sep);
  const data: any = {
    options: {
      uiCmdMap: [],
      tmbUrl: path.join(config.roots![0].URL, '.tmb/'),
    },
  };

  if (init) {
    config.init?.();
    targetHash ??= encodedRoot;
  }
  if (!targetHash) throw new Error('errCmdParams');

  let target = helpers.decode(targetHash);
  const dirExists = await fs.pathExists(target.absolutePath);
  if (!dirExists) target = helpers.decode(encodedRoot);

  let files = (await fs.readdir(target.absolutePath).catch(console.log)) || [];
  const tasks = files.map(async (file: string) =>
    helpers.info(path.join(target.absolutePath, file))
  );

  data.files = await Promise.all(tasks);
  data.cwd = await helpers.info(target.absolutePath);

  if (init) {
    data.api = '2.1';
    volumes = await helpers.init();
    data.files = volumes.concat(data.files);
  }

  return data;
};

api.parents = async (opts: ParentsOpts) => {
  if (!opts.target) throw new Error('errCmdParams');

  const dir = helpers.decode(opts.target);
  let tree: FileInfo[] = await helpers.init();

  const read = async (t: string): Promise<void> => {
    const folder = path.dirname(t);
    const isRoot = config.volumes!.indexOf(t) >= 0;

    if (!isRoot) {
      const files = await helpers.readdir(folder);
      const tasks: Promise<FileInfo>[] = [];

      _.each(files, (file) => {
        if (file.isdir) {
          tasks.push(helpers.info(path.join(folder, file.name)));
        }
      });

      const folders = await Promise.all(tasks);
      tree = tree.concat(folders);
      await read(folder);
    }
  };

  await read(dir.absolutePath);

  return { tree };
};

api.paste = async (opts: PasteOpts) => {
  const dest = helpers.decode(opts.dst);

  const tasks = opts.targets.map(async (target: string) => {
    const info = helpers.decode(target);
    let name = info.name;
    if (opts.renames && opts.renames.indexOf(info.name) >= 0) {
      const ext = path.extname(name);
      const fil = path.basename(name, ext);
      name = fil + opts.suffix + ext;
    }

    const action = opts.cut == 1 ? helpers.move : helpers.copy;
    return action({
      src: info.absolutePath,
      dst: path.join(dest.absolutePath, name),
    });
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
};

api.put = async (opts: PutOpts) => {
  const target = helpers.decode(opts.target);
  const { content } = opts;

  await fs.writeFile(target.absolutePath, content);
  const info = await helpers.info(target.absolutePath);
  return { changed: [info] };
};

api.rename = async (opts: RenameOpts) => {
  if (!opts.target) throw new Error('errCmdParams');
  const dir = helpers.decode(opts.target);
  const dirname = path.dirname(dir.absolutePath);
  return helpers.move({
    src: dir.absolutePath,
    dst: path.join(dirname, opts.name),
  });
};

api.resize = async (opts: ResizeOpts) => {
  const target = helpers.decode(opts.target);
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
    image.quality(parseInt(opts.quality)).write(target.absolutePath, (err) => {
      if (err) reject(err);
      else resolve(undefined);
    });
  });
  const info = await helpers.info(target.absolutePath);
  info.tmb = '1';

  return {
    changed: [info],
  };
};

api.rm = async (opts: RmOpts) => {
  const removed: string[] = [];

  for (const hash of opts.targets) {
    const target = helpers.decode(hash);
    await fs.remove(target.absolutePath);
    removed.push(hash);
  }

  return { removed };
};

api.size = async () => {
  return {
    size: 'unkown',
  };
};

api.search = async (opts: SearchOpts) => {
  if (!opts.q || opts.q.length < 1) {
    throw new Error('errCmdParams');
  }

  const target = helpers.decode(opts.target);
  const tasks: Promise<FileInfo>[] = [];

  const searchRecursive = async (dir: string): Promise<void> => {
    const items = await fs.readdir(dir, { withFileTypes: true });

    for (const item of items) {
      const itemPath = path.join(dir, item.name);

      if (item.name.indexOf(opts.q) >= 0) {
        tasks.push(helpers.info(itemPath));
      }

      if (item.isDirectory()) {
        await searchRecursive(itemPath);
      }
    }
  };

  await searchRecursive(target.absolutePath);
  const files = await Promise.all(tasks);

  return { files };
};

api.tmb = async (opts: TmbOpts) => {
  const files: string[] = [];

  if (opts.current) {
    const dir = helpers.decode(opts.current);
    const items = await fs.readdir(dir.absolutePath);

    _.each(items, (item) => {
      const _m = mime.lookup(item);
      if (_m !== false && _m.indexOf('image/') == 0) {
        files.push(path.join(dir.absolutePath, item));
      }
    });
  } else if (opts.targets) {
    _.each(opts.targets, (target: string) => {
      const _t = helpers.decode(target);
      files.push(_t.absolutePath);
    });
  }

  const tasks: Promise<string>[] = [];

  _.each(files, (file) => {
    tasks.push(
      Jimp.read(file).then(async (img) => {
        const op = helpers.encode(file);
        await new Promise<void>((resolve, reject) => {
          img
            .resize(48, 48)
            .write(path.join(config.tmbroot!, op + '.png'), (err) => {
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
};

api.tree = async (opts: TreeOpts) => {
  if (!opts.target) throw new Error('errCmdParams');
  const dir = helpers.decode(opts.target);
  const files = await helpers.readdir(dir.absolutePath);

  const tasks = files.map(async (file) => {
    if (file.isdir) {
      return helpers.info(path.join(dir.absolutePath, file.name));
    }
  });

  const tree = await Promise.all(tasks);
  return { tree };
};

api.upload = async (
  opts: UploadOpts,
  _res: Response,
  _files?: UploadedFile | UploadedFile[]
) => {
  const target = helpers.decode(opts.target);
  const files = _files instanceof Array ? _files : [_files!];

  const tasks = files.map(async (file, i) => {
    let filename = file.filename;
    let dst = target.absolutePath;
    if (opts.upload_path) {
      dst = path.join(dst, path.dirname(opts.upload_path[i]));
    }

    if (opts.renames?.indexOf(file.filename)) {
      filename = helpers.suffix(file.filename, opts.suffix);
    }
    dst = path.join(dst, filename);

    return helpers.move({
      dst,
      src: file.file,
      upload: true,
    });
  });

  const info = await Promise.all(tasks);
  const added = info.map((i) => i.added[0]);

  return { added };
};

api.zipdl = async (opts: ZipdlOpts) => {
  if (!opts.targets?.length) throw new Error('errCmdParams');

  const firstHash = opts.targets[0];
  const first = helpers.decode(firstHash);
  const dir = path.dirname(first.absolutePath);
  const name = path.basename(dir);
  const file = path.join(dir, name + '.zip');

  await helpers.compress(opts.targets, file);

  return {
    zipdl: {
      file: helpers.encode(file),
      name: name + '.zip',
      mime: 'application/zip',
    },
  };
};

const LFS = function (options: Partial<Config>) {
  Object.assign(config, options);
  Object.assign(helpers.config, config);
};

(LFS as any).api = api;

export = LFS;
