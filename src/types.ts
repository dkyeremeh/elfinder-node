import { Request, Response } from 'express';

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

export interface ApiCommand {
  (opts: any, res: Response, files?: any): Promise<any>;
}

export interface ApiCommands {
  [key: string]: ApiCommand;
  archive: ApiCommand;
  dim: ApiCommand;
  duplicate: ApiCommand;
  extract: ApiCommand;
  file: ApiCommand;
  get: ApiCommand;
  info: ApiCommand;
  ls: ApiCommand;
  mkdir: ApiCommand;
  mkfile: ApiCommand;
  open: ApiCommand;
  parents: ApiCommand;
  paste: ApiCommand;
  put: ApiCommand;
  rename: ApiCommand;
  resize: ApiCommand;
  rm: ApiCommand;
  size: ApiCommand;
  search: ApiCommand;
  tmb: ApiCommand;
  tree: ApiCommand;
  upload: ApiCommand;
  zipdl: ApiCommand;
}

export interface UploadedFile {
  filename: string;
  file: string;
}
