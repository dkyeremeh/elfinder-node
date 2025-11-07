declare module 'express-busboy' {
  import { Router } from 'express';

  interface BusboyOptions {
    upload?: boolean;
    path?: string;
    allowedPath?: string | RegExp | ((url: string) => boolean);
    immediate?: boolean;
    [key: string]: any;
  }

  function extend(router: Router, options?: BusboyOptions): void;

  export { extend };
}
