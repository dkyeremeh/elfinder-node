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

export type VolumeDriver = {
  config: any;
  archive: (opts: ArchiveOpts) => Promise<any>;
  dim: (opts: DimOpts) => Promise<any>;
  duplicate: (opts: DuplicateOpts) => Promise<any>;
  extract: (opts: ExtractOpts) => Promise<any>;
  file: (opts: FileOpts, res: any) => Promise<void>;
  get: (opts: GetOpts) => Promise<any>;
  info: () => Promise<void>;
  ls: (opts: LsOpts) => Promise<any>;
  mkdir: (opts: MkdirOpts) => Promise<any>;
  mkfile: (opts: MkfileOpts) => Promise<any>;
  open: (opts: OpenOpts) => Promise<any>;
  parents: (opts: ParentsOpts) => Promise<any>;
  paste: (opts: PasteOpts) => Promise<any>;
  put: (opts: PutOpts) => Promise<any>;
  rename: (opts: RenameOpts) => Promise<any>;
  resize: (opts: ResizeOpts) => Promise<any>;
  rm: (opts: RmOpts) => Promise<any>;
  size: () => Promise<any>;
  search: (opts: SearchOpts) => Promise<any>;
  tmb: (opts: TmbOpts) => Promise<any>;
  tree: (opts: TreeOpts) => Promise<any>;
  upload: (
    opts: UploadOpts,
    res: Response,
    files?: UploadedFile | UploadedFile[]
  ) => Promise<any>;
  zipdl: (opts: ZipdlOpts) => Promise<any>;
  [key: string]: any;
};

export type DriverSetup = <T extends Config>(
  config: Partial<T>
) => VolumeDriver;

export interface VolumeRoot {
  driver: DriverSetup;
  path: string;
  URL: string;
  permissions?: {
    read: number;
    write: number;
    locked: number;
  };
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
  /** List of disabled commands */
  disabled: string[];
  icon: string;
  /** Base url for public links */
  URL: string;
  permissions: { read: number; write: number; locked: number };
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
