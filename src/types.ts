declare module 'express-serve-static-core' {
  interface Request {
    files?: {
      [key: string]: any;
    };
  }
}

export interface FileInfo {
  name: string;
  size: number;
  hash: string;
  mime: string;
  ts: number;
  volumeid: string;
  phash?: string;
  tmb?: string | '1';
  read: number;
  write: number;
  locked: number;
  isdir: boolean;
  dirs?: 1;
  options?: {
    disabled: string[];
    archivers: {
      create: string[];
      extract: string[];
      createext: {
        [key: string]: string;
      };
    };
    url: string;
    csscls?: string;
    uiCmdMap?: unknown[];
    tmbUrl?: string;
  };
}

export interface VolumeRoot {
  path: string;
  URL: string;
  permissions?:
    | {
        read: number;
        write: number;
        locked: number;
      }
    | ((path: string) => { read: number; write: number; locked: number });
}

export interface DecodedPath {
  volume: number;
  dir: string;
  path: string;
  name: string;
  absolutePath: string;
}

export interface ParsedPath {
  volume: number;
  dir: string;
  path: string;
  isRoot: boolean;
}

export interface FileItem {
  name: string;
  isdir: boolean;
}

export interface Config {
  router?: string;
  disabled: string[];
  volumeicons: string[];
  volumes: string[];
  roots: VolumeRoot[];
  tmbroot: string;
  init?: () => void;
  acl: (path: string) => { read: number; write: number; locked: number };
}

export interface CopyMoveOptions {
  src: string;
  dst: string;
  upload?: boolean;
}

export interface CopyMoveResult {
  added: FileInfo[];
  removed?: string[];
  changed?: string[];
}

export interface UploadedFile {
  filename: string;
  file: string;
}

// API Command Options
export interface ArchiveOpts {
  target: string;
  name: string;
  targets: string[];
}

export interface DimOpts {
  target: string;
}

export interface DuplicateOpts {
  targets: string[];
}

export interface ExtractOpts {
  target: string;
  makedir?: number;
}

export interface FileOpts {
  target: string;
}

export interface GetOpts {
  target: string;
}

export interface LsOpts {
  target: string;
  intersect?: string[];
}

export interface MkdirOpts {
  target: string;
  name?: string;
  dirs?: string[];
}

export interface MkfileOpts {
  target: string;
  name: string;
}

export interface OpenOpts {
  target?: string;
  init?: boolean;
}

export interface ParentsOpts {
  target: string;
}

export interface PasteOpts {
  dst: string;
  targets: string[];
  cut?: number;
  renames?: string[];
  suffix?: string;
}

export interface PutOpts {
  target: string;
  content: string;
}

export interface RenameOpts {
  target: string;
  name: string;
}

export interface ResizeOpts {
  target: string;
  mode: 'resize' | 'crop' | 'rotate';
  width: string;
  height: string;
  x: string;
  y: string;
  degree: string;
  bg: string;
  quality: string;
}

export interface RmOpts {
  targets: string[];
}

export interface SearchOpts {
  target: string;
  q: string;
}

export interface TmbOpts {
  current?: string;
  targets?: string[];
}

export interface TreeOpts {
  target: string;
}

export interface UploadOpts {
  target: string;
  upload_path?: string[];
  renames?: string[];
  suffix: string;
}

export interface ZipdlOpts {
  targets: string[];
}
