import * as lz from 'lzutf8';
import * as path from 'path';
import * as mime from 'mime-types';
import * as _ from 'underscore';
import * as fs from 'fs-extra';
import * as archiver from 'archiver';
import Zip from 'adm-zip';
import { promisify } from 'util';
import {
  Config,
  DecodedPath,
  ParsedPath,
  FileItem,
  FileInfo,
  CopyMoveOptions,
  CopyMoveResult,
} from './types';

export const config: Partial<Config> = {};

export const compress = async (files: string[], dest: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(dest);
    const archive = archiver.default('zip', {
      store: true,
    });

    output.on('close', () => {
      resolve(true);
    });

    archive.on('error', (err: Error) => {
      console.log(err);
      reject(err);
    });

    archive.pipe(output);

    _.each(files, (file) => {
      const target = decode(file);
      if (fs.lstatSync(target.absolutePath).isDirectory()) {
        const name = path.basename(target.absolutePath);
        archive.directory(path.normalize(target.absolutePath + path.sep), name);
      } else {
        archive.file(target.absolutePath, {
          name: target.name,
        });
      }
    });

    archive.finalize();
  });
};

export const copy = async (opts: CopyMoveOptions): Promise<CopyMoveResult> => {
  const fileExists = await fs.pathExists(opts.dst);
  if (fileExists) throw new Error('Destination exists');

  await fs.copy(opts.src, opts.dst);
  const infoResult = await info(opts.dst);

  return {
    added: [infoResult],
    changed: [encode(path.dirname(opts.dst))],
  };
};

export const decode = (dir: string): DecodedPath => {
  let root: string, name: string, volume: number;

  if (!dir || dir.length < 4) throw Error('Invalid Path');
  if (dir[0] !== 'v' || dir[2] !== '_') throw Error('Invalid Path');

  volume = parseInt(dir[1]);

  let relative = dir
    .substr(3, dir.length - 3)
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/\./g, '=');

  relative = lz.decompress(relative + '==', {
    inputEncoding: 'Base64',
  });

  name = path.basename(relative);
  root = config.volumes![volume];

  return {
    volume,
    dir: root,
    path: relative,
    name,
    absolutePath: path.join(root, relative),
  };
};

export const encode = (dir: string): string => {
  const parsedInfo = parse(dir);
  const relative = lz
    .compress(parsedInfo.path, {
      outputEncoding: 'Base64',
    })
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '.');

  return 'v' + parsedInfo.volume + '_' + relative;
};

export const extract = async (source: string, dest: string): Promise<string[]> => {
  const zip = new Zip(source);
  const files = zip.getEntries().map((file: any) => file.entryName);
  const extractAsync = promisify(zip.extractAllToAsync.bind(zip));
  await extractAsync(dest, true);
  return files;
};

export const filepath = (volume: number, filename: string): string | null => {
  if (volume < 0 || volume > 2) return null;
  return path.join(config.volumes![volume], path.normalize(filename));
};

export const info = async (p: string): Promise<FileInfo> => {
  const parsedInfo = parse(p);
  if (parsedInfo.volume < 0) throw new Error('Volume not found');

  const stat = await fs.stat(p);

  const r: FileInfo = {
    name: path.basename(p),
    size: stat.size,
    hash: encode(p),
    mime: stat.isDirectory() ? 'directory' : (mime.lookup(p) || 'application/binary'),
    ts: Math.floor(stat.mtime.getTime() / 1000),
    volumeid: 'v' + parsedInfo.volume + '_',
    read: 1,
    write: 1,
    locked: 0,
    isdir: false,
  };

  if (r.mime.indexOf('image/') === 0) {
    const filename = encode(p);
    const tmbPath = path.join(config.tmbroot!, filename + '.png');
    if (await fs.pathExists(tmbPath)) {
      r.tmb = filename + '.png';
    } else {
      r.tmb = '1';
    }
  }

  if (!parsedInfo.isRoot) {
    const parent = path.dirname(p);
    r.phash = encode(parent);
  } else {
    r.options = {
      disabled: config.disabled!,
      archivers: {
        create: ['application/zip'],
        extract: ['application/zip'],
        createext: {
          'application/zip': 'zip',
        },
      },
      url: config.roots![parsedInfo.volume].URL,
    };
    if (config.volumeicons![parsedInfo.volume]) {
      r.options.csscls = config.volumeicons![parsedInfo.volume];
    }
  }

  const acl = config.acl!(p);
  r.read = acl.read;
  r.write = acl.write;
  r.locked = acl.locked;
  r.isdir = r.mime === 'directory';

  if (r.isdir) {
    const items = await fs.readdir(p);
    for (const item of items) {
      if ((await fs.lstat(path.join(p, item))).isDirectory()) {
        r.dirs = 1;
        break;
      }
    }
  }

  return r;
};

export const init = async (): Promise<FileInfo[]> => {
  const tasks = config.volumes!.map((volume) => info(volume));
  const results = await Promise.all(tasks);

  _.each(results, (result) => {
    result.phash = '';
  });

  return results;
};

export const move = async (opts: CopyMoveOptions): Promise<CopyMoveResult> => {
  if (await fs.pathExists(opts.dst)) {
    throw new Error('Destination exists');
  }

  await fs.move(opts.src, opts.dst);
  const infoResult = await info(opts.dst);

  return {
    added: [infoResult],
    removed: opts.upload ? [] : [encode(opts.src)],
  };
};

export const parse = (p: string): ParsedPath => {
  const v = volume(p);
  const root = config.volumes![v] || '';
  let relative = p.substr(root.length, p.length - root.length);
  if (relative.indexOf(path.sep) !== 0) relative = path.sep + relative;

  return {
    volume: v,
    dir: root,
    path: relative,
    isRoot: relative === path.sep,
  };
};

export const readdir = async (dir: string): Promise<FileItem[]> => {
  const items = await fs.readdir(dir);
  const files: FileItem[] = [];

  for (const item of items) {
    const itemInfo = await fs.lstat(path.join(dir, item));
    files.push({
      name: item,
      isdir: itemInfo.isDirectory(),
    });
  }

  return files;
};

export const suffix = (name: string, suff: string): string => {
  const ext = path.extname(name);
  const fil = path.basename(name, ext);
  return fil + suff + ext;
};

export const tmbfile = (filename: string): string => {
  return path.join(config.tmbroot!, filename);
};

export const volume = (p: string): number => {
  for (let i = 0; i < config.volumes!.length; i++) {
    if (i > 9) return -1;
    if (p.indexOf(config.volumes![i]) === 0) {
      return i;
    }
  }
  return -1;
};
