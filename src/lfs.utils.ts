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

export type LFSConfig = Config & {
  init?: Function;
  path: string;
  tmbroot: string;
};

export type LFSConfigInput = Partial<Config> & {
  path: string;
  tmbroot?: string;
};

export const compress = async (
  files: string[],
  dest: string,
  config: LFSConfig
): Promise<boolean> => {
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
      const target = decode(file, config);
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

export const copy = async (
  opts: CopyMoveOptions,
  config: LFSConfig
): Promise<CopyMoveResult> => {
  const fileExists = await fs.pathExists(opts.dst);
  if (fileExists) throw new Error('Destination exists');

  await fs.copy(opts.src, opts.dst);
  const infoResult = await info(opts.dst, config);

  return {
    added: [infoResult],
    changed: [encode(path.dirname(opts.dst), config)],
  };
};

export const decode = (dir: string, config: LFSConfig): DecodedPath => {
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
  root = config.path;

  return {
    volume,
    dir: root,
    path: relative,
    name,
    absolutePath: path.join(root, relative),
  };
};

export const encode = (dir: string, config: LFSConfig): string => {
  const parsedInfo = parse(dir, config);
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

export const extract = async (
  source: string,
  dest: string
): Promise<string[]> => {
  const zip = new Zip(source);
  const files = zip.getEntries().map((file: any) => file.entryName);
  const extractAsync = promisify(zip.extractAllToAsync.bind(zip));
  await extractAsync(dest, true);
  return files;
};

export const info = async (p: string, config: LFSConfig): Promise<FileInfo> => {
  const parsedInfo = parse(p, config);
  if (parsedInfo.volume < 0) throw new Error('Volume not found');

  const stat = await fs.stat(p);

  const r: FileInfo = {
    name: path.basename(p),
    size: stat.size,
    hash: encode(p, config),
    mime: stat.isDirectory()
      ? 'directory'
      : mime.lookup(p) || 'application/binary',
    ts: Math.floor(stat.mtime.getTime() / 1000),
    volumeid: 'v' + parsedInfo.volume + '_',
    read: 1,
    write: 1,
    locked: 0,
    isdir: false,
  };

  if (r.mime.indexOf('image/') === 0) {
    const filename = encode(p, config);
    console.log('bbb', config.tmbroot, filename);
    const tmbPath = path.join(config.tmbroot, filename + '.png');
    if (await fs.pathExists(tmbPath)) {
      r.tmb = filename + '.png';
    } else {
      r.tmb = '1';
    }
  }

  if (!parsedInfo.isRoot) {
    const parent = path.dirname(p);
    r.phash = encode(parent, config);
  } else {
    r.options = {
      disabled: config.disabled,
      archivers: {
        create: ['application/zip'],
        extract: ['application/zip'],
        createext: {
          'application/zip': 'zip',
        },
      },
      url: config.URL,
    };
    if (config.icon) {
      r.options.csscls = config.icon;
    }
  }

  const acl = config.acl(p);
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

export const init = async (config: LFSConfig): Promise<FileInfo[]> => {
  const volumeInfo = await info(config.path, config);
  volumeInfo.phash = '';
  return [volumeInfo];
};

export const move = async (
  opts: CopyMoveOptions,
  config: LFSConfig
): Promise<CopyMoveResult> => {
  if (await fs.pathExists(opts.dst)) {
    throw new Error('Destination exists');
  }

  await fs.move(opts.src, opts.dst);
  const infoResult = await info(opts.dst, config);

  return {
    added: [infoResult],
    removed: opts.upload ? [] : [encode(opts.src, config)],
  };
};

export const parse = (p: string, config: LFSConfig): ParsedPath => {
  const v = volume(p, config);
  const root = config.path || '';
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

export const volume = (p: string, config: LFSConfig): number => {
  // For single volume, always return 0 if path matches
  if (p.indexOf(config.path) === 0) {
    return 0;
  }
  return -1;
};

export interface ChunkUploadOptions {
  chunkName: string;
  chunkFile: string;
  range: string;
  destinationDir: string;
}

export interface ChunkUploadResult {
  isComplete: boolean;
  finalPath?: string;
  chunkPath: string;
}

/**
 * Handles uploading a single chunk of a file
 * Returns information about whether the upload is complete and where the file is located
 */
export const handleChunkUpload = async (
  opts: ChunkUploadOptions
): Promise<ChunkUploadResult> => {
  const { chunkName, chunkFile, range, destinationDir } = opts;
  const [start, , totalSize] = range.split(',').map(Number);

  // Extract real filename by removing the chunk pattern (.N_M.part)
  const realFilename = chunkName.replace(/\.\d+_\d+\.part$/, '');
  const finalPath = path.join(destinationDir, realFilename);
  const chunkPath = path.join(destinationDir, chunkName);

  // Ensure destination directory exists
  await fs.ensureDir(destinationDir);

  // Move uploaded chunk to temp location
  await fs.move(chunkFile, chunkPath, { overwrite: true });

  // Check if this is the last chunk by checking file size
  const chunkStat = await fs.stat(chunkPath);
  const isLastChunk = start + chunkStat.size >= totalSize;

  if (isLastChunk) {
    // Merge all chunks into final file
    await mergeChunks(realFilename, destinationDir);
    return { isComplete: true, finalPath, chunkPath };
  }

  return { isComplete: false, chunkPath };
};

/**
 * Merges all chunk files for a given filename into a single file
 */
const mergeChunks = async (
  filename: string,
  directory: string
): Promise<void> => {
  const escapedFilename = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const chunkPattern = new RegExp(`^${escapedFilename}\\.\\d+_\\d+\\.part$`);

  // Find and sort all chunk files
  const chunkFiles = (await fs.readdir(directory))
    .filter((f) => chunkPattern.test(f))
    .sort((a, b) => {
      // Extract chunk numbers for proper sorting
      const aMatch = a.match(/\.(\d+)_\d+\.part$/);
      const bMatch = b.match(/\.(\d+)_\d+\.part$/);
      const aNum = aMatch ? parseInt(aMatch[1]) : 0;
      const bNum = bMatch ? parseInt(bMatch[1]) : 0;
      return aNum - bNum;
    });

  const finalPath = path.join(directory, filename);
  const writeStream = fs.createWriteStream(finalPath);

  // Write each chunk in order and clean up
  for (const chunk of chunkFiles) {
    const chunkFullPath = path.join(directory, chunk);
    const data = await fs.readFile(chunkFullPath);
    writeStream.write(data);
    await fs.remove(chunkFullPath);
  }

  // Finalize the write stream
  await new Promise<void>((resolve, reject) => {
    writeStream.end((err?: Error) => {
      if (err) reject(err);
      else resolve();
    });
  });
};
