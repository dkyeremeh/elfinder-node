exports.notImplementedError = (cmd) =>
  new Error(`'${cmd}' is not implemented by volume driver`);
