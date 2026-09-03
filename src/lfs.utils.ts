import * as lz from 'lzutf8';
import * as path from 'path';
import * as mime from 'mime-types';
import * as fs from 'fs-extra';
import Zip from 'adm-zip';
import type { Sharp } from 'sharp';
import { promisify } from 'util';
import { pipeline } from 'stream/promises';
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
  name?: string;
};

export type LFSConfigInput = Partial<Config> & {
  path: string;
  tmbroot?: string;
};

export const compress = async (
  files: string[],
  dest: string,
  config: LFSConfig,
): Promise<boolean> => {
  const zip = new Zip();

  for (const file of files) {
    const target = decode(file, config);
    if ((await fs.lstat(target.absolutePath)).isDirectory()) {
      const name = path.basename(target.absolutePath);
      zip.addLocalFolder(target.absolutePath, name);
    } else {
      zip.addLocalFile(target.absolutePath, '', target.name);
    }
  }

  await zip.writeZipPromise(dest);

  return true;
};

export const copy = async (
  opts: CopyMoveOptions,
  config: LFSConfig,
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

  // Restore standard base64 from the URL-safe encoding used in elFinder hashes
  const encodedHash = dir
    .substr(3, dir.length - 3)
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/\./g, '=');

  const relative: string = lz
    .decompress(encodedHash, {
      inputEncoding: 'Base64',
    })
    .replace(/\\/g, '/'); // convert \ path sep to /

  if (relative.split('/').some((seg) => seg === '..')) {
    throw Error('Invalid Path');
  }

  name = path.basename(relative);
  root = path.resolve(config.path);
  // Strip leading separator so path.resolve treats it as relative to root
  const absolutePath = path.resolve(root, relative.replace(/^\/+/, ''));

  if (absolutePath !== root && !absolutePath.startsWith(root + path.sep)) {
    throw Error('Invalid Path');
  }

  return {
    volume,
    dir: root,
    path: relative,
    name,
    absolutePath,
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
  dest: string,
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
    read: true,
    write: true,
    locked: false,
    isdir: false,
  };

  if (r.mime.indexOf('image/') === 0) {
    const filename = encode(p, config);
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
  r.read = Boolean(acl.read);
  r.write = Boolean(acl.write);
  r.locked = Boolean(acl.locked);
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
  if (config.name) {
    volumeInfo.name = config.name;
  }
  volumeInfo.phash = '';
  return [volumeInfo];
};

export const move = async (
  opts: CopyMoveOptions,
  config: LFSConfig,
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

export const readdir = async (
  dir: string,
  config?: LFSConfig,
): Promise<FileItem[]> => {
  const items = await fs.readdir(dir);
  const files: FileItem[] = [];

  for (const item of items) {
    const itemPath = path.join(dir, item);
    if (config?.acl(itemPath).hidden) continue;

    const itemInfo = await fs.lstat(itemPath);
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

export const hexToRgba = (
  hex: string,
): { r: number; g: number; b: number; alpha: number } => {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
    alpha: 1,
  };
};

export const applyQuality = (
  image: Sharp,
  filePath: string,
  quality: number,
): Sharp => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') {
    return image.jpeg({ quality });
  }
  if (ext === '.webp') {
    return image.webp({ quality });
  }
  if (ext === '.png') {
    return image.png({ quality });
  }
  return image;
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
  destinationDir: string;
}

export interface ChunkUploadResult {
  isComplete: boolean;
  finalPath?: string;
  chunkPath: string;
}

const chunkNamePattern = /^(.*)\.(\d+)_(\d+)\.part$/;

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseChunkName = (
  chunkName: string,
): { realFilename: string; total: number } | null => {
  const match = chunkName.match(chunkNamePattern);
  if (!match) return null;
  const [, realFilename, , lastIndexStr] = match;
  // elFinder's client encodes the *last chunk's index* as this segment
  // (e.g. a 3-chunk upload is named .0_2, .1_2, .2_2), not the chunk count.
  return { realFilename, total: parseInt(lastIndexStr, 10) + 1 };
};

const getChunkFiles = async (
  realFilename: string,
  directory: string,
): Promise<string[]> => {
  const chunkPattern = new RegExp(
    `^${escapeRegExp(realFilename)}\\.\\d+_\\d+\\.part$`,
  );
  return (await fs.readdir(directory)).filter((f) => chunkPattern.test(f));
};

/**
 * Handles uploading a single chunk of a file
 * Returns information about whether the upload is complete and where the file is located
 */
export const handleChunkUpload = async (
  opts: ChunkUploadOptions,
): Promise<ChunkUploadResult> => {
  const { chunkName, chunkFile, destinationDir } = opts;

  const parsed = parseChunkName(chunkName);
  if (!parsed) throw new Error('Invalid chunk name');
  const { realFilename, total } = parsed;

  const finalPath = path.join(destinationDir, realFilename);
  const chunkPath = path.join(destinationDir, chunkName);

  // Ensure destination directory exists
  await fs.ensureDir(destinationDir);

  // Move uploaded chunk to temp location
  await fs.move(chunkFile, chunkPath, { overwrite: true });

  // A chunk is complete once every indexed part has arrived on disk -
  // derived from the "<index>_<total>.part" name, since the client
  // doesn't always send a byte range for the upload.
  const receivedChunks = await getChunkFiles(realFilename, destinationDir);
  const isLastChunk = receivedChunks.length >= total;

  if (isLastChunk) {
    // Multiple concurrent requests can observe the full chunk set at once
    // (elFinder uploads several chunks in parallel). Only the request that
    // wins this atomic claim performs the merge, so two requests never
    // write/delete the same files at the same time.
    const lockPath = path.join(destinationDir, `.${realFilename}.merging`);
    try {
      const fd = await fs.open(lockPath, 'wx');
      await fs.close(fd);
    } catch (e: any) {
      if (e.code === 'EEXIST') {
        return { isComplete: false, chunkPath };
      }
      throw e;
    }

    try {
      // Merge all chunks into final file
      await mergeChunks(realFilename, destinationDir);
    } finally {
      await fs.remove(lockPath);
    }

    return { isComplete: true, finalPath, chunkPath };
  }

  return { isComplete: false, chunkPath };
};

/**
 * Removes any partial chunk files for a failed/aborted chunked upload
 */
export const cleanupChunks = async (
  chunkName: string,
  destinationDir: string,
): Promise<void> => {
  const parsed = parseChunkName(chunkName);
  if (!parsed) return;

  if (!(await fs.pathExists(destinationDir))) return;

  const chunkFiles = await getChunkFiles(parsed.realFilename, destinationDir);

  await Promise.all(
    chunkFiles.map((f) => fs.remove(path.join(destinationDir, f))),
  );
  await fs.remove(
    path.join(destinationDir, `.${parsed.realFilename}.merging`),
  );
};

/**
 * Merges all chunk files for a given filename into a single file
 */
const mergeChunks = async (
  filename: string,
  directory: string,
): Promise<void> => {
  // Find and sort all chunk files
  const chunkFiles = (await getChunkFiles(filename, directory)).sort(
    (a, b) => {
      // Extract chunk numbers for proper sorting
      const aMatch = a.match(/\.(\d+)_\d+\.part$/);
      const bMatch = b.match(/\.(\d+)_\d+\.part$/);
      const aNum = aMatch ? parseInt(aMatch[1]) : 0;
      const bNum = bMatch ? parseInt(bMatch[1]) : 0;
      return aNum - bNum;
    },
  );

  const finalPath = path.join(directory, filename);
  const writeStream = fs.createWriteStream(finalPath);

  for (const chunk of chunkFiles) {
    const chunkFullPath = path.join(directory, chunk);
    await pipeline(fs.createReadStream(chunkFullPath), writeStream, {
      end: false,
    });
  }

  await new Promise<void>((resolve, reject) => {
    writeStream.end((err?: Error) => {
      if (err) reject(err);
      else resolve();
    });
  });

  await Promise.all(
    chunkFiles.map((chunk) => fs.remove(path.join(directory, chunk))),
  );
};
