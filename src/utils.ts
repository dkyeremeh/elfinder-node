export const notImplementedError = (cmd: string): Error =>
  new Error(`'${cmd}' is not implemented by volume driver`);