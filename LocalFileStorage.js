/* eslint-disable no-unused-vars */
const path = require('path'); //Remove
const mime = require('mime-types');
const promise = require('promise');
const _ = require('underscore');
const Jimp = require('jimp');
const fs = require('fs-extra');

const helpers = require('./helpers');

const api = {};

const config = {
  router: '/connector',
  disabled: ['chmod', 'mkfile', 'zipdl', 'edit', 'put', 'size'],
  volumeicons: ['elfinder-navbar-root-local', 'elfinder-navbar-root-local'],
};
config.acl = function (path) {
  const volume = helpers.volume(path);
  return (
    config.roots[volume].permissions || {
      read: 1,
      write: 1,
      locked: 0,
    }
  );
};

api.archive = async function (opts, res) {
  const target = helpers.decode(opts.target);
  const filePath = path.join(target.absolutePath, opts.name);
  await helpers.compress(opts.targets, filePath);

  return {
    added: [await helpers.info(filePath)],
  };
};

api.dim = async function (opts, res) {
  const target = helpers.decode(opts.target);
  const img = await Jimp.read(target.absolutePath);
  return {
    dim: img.bitmap.width + 'x' + img.bitmap.height,
  };
};

api.copy = async function (opts, res) {
  const fileExists = await fs.exists(opts.dst);
  if (fileExists) throw new Error('Destination exists');

  await fs.copy(opts.src, opts.dst);
  const info = helpers.info(opts.dst);

  return {
    added: [info],
    changed: [api.encode(path.dirname(opts.dst))],
  };
};

api.duplicate = async function (opt) {
  const tasks = opt.targets.map(async (target) => {
    const _t = helpers.decode(target);
    const ext = path.extname(_t.name);
    const fil = path.basename(_t.name, ext);
    const name = fil + '(copy)' + ext;
    const base = path.dirname(_t.absolutePath);

    return api.copy({
      src: _t.absolutePath,
      dst: path.join(base, name),
    });
  });

  const info = await Promise.all(tasks);

  return {
    added: info.map((i) => i.added[0]),
  };
};

api.file = function (opts, res) {
  const target = helpers.decode(opts.target);
  res.sendFile(target.absolutePath);
};

api.get = async function (opts, res) {
  const target = helpers.decode(opts.target);
  const content = await fs.readFile(target.absolutePath, 'utf8');
  return { content };
};

//TODO: Implement this
api.info = async function (opts, res) {};

api.ls = async function (opts, res) {
  if (!opts.target) throw new Error('errCmdParams');

  const info = helpers.decode(opts.target);
  const files = await helpers.readdir(info.absolutePath);
  let list = files.map((e) => e.name);
  if (opts.intersect) {
    list = _.intersection(list, opts.intersect);
  }

  return { list };
};

//TODO check permission.
api.mkdir = async function (opts, res) {
  const dir = helpers.decode(opts.target);
  const dirs = opts.dirs || [];
  if (opts.name) {
    dirs.push(opts.name);
  }

  const tasks = dirs.map(async (name) => {
    const _dir = path.join(dir.absolutePath, name);
    await fs.mkdirp(_dir);
    return helpers.info(_dir);
  });

  const added = await Promise.all(tasks);
  return { added };
};

api.move = async function (opts, res) {
  if (await fs.exists(opts.dst)) {
    throw new Error('Destination exists');
  }

  await fs.move(opts.src, opts.dst);
  const info = await helpers.info(opts.dst);
  return {
    added: [info],
    removed: opts.upload ? [] : [helpers.encode(opts.src)],
  };
};

api.open = async function (opts, res) {
  return new promise(function (resolve, reject) {
    const data = {};
    data.options = {
      uiCmdMap: [],
      tmbUrl: path.join(config.roots[0].URL, '.tmb/'),
    };
    const _init = opts.init && opts.init == true;
    let _target = opts.target;

    if (_init) {
      if (config.init) config.init();
      data.api = '2.1';
      if (!_target) {
        _target = helpers.encode(config.volumes[0] + path.sep);
      }
    }
    if (!_target) {
      return reject('errCmdParams');
    }
    //NOTE target must always be directory
    _target = helpers.decode(_target);

    helpers
      .info(_target.absolutePath)
      .then(function (result) {
        data.cwd = result;
        let files;
        try {
          files = fs.readdirSync(_target.absolutePath);
        } catch (e) {
          //errors.
          console.log(e);
          files = [];
        }
        const tasks = [];
        _.each(files, function (file) {
          tasks.push(helpers.info(path.join(_target.absolutePath, file)));
        });
        return Promise.all(tasks);
      })
      .then(function (files) {
        data.files = files;
        if (_init) {
          return helpers.init();
        } else {
          return promise.resolve(null);
        }
      })
      .then(function (volumes) {
        if (volumes != null) {
          data.files = volumes.concat(data.files);
        }
      })
      .then(function () {
        resolve(data);
      })
      .catch(reject);
  });
};

api.parents = function (opts, res) {
  return new promise(function (resolve, reject) {
    if (!opts.target) return reject('errCmdParams');
    const dir = helpers.decode(opts.target);
    let tree;
    helpers.init().then(function (results) {
      tree = results;
      const read = function (t) {
        const folder = path.dirname(t);
        const isRoot = config.volumes.indexOf(t) >= 0;
        if (isRoot) {
          return resolve({
            tree: tree,
          });
        } else {
          helpers
            .readdir(folder)
            .then(function (files) {
              const tasks = [];
              _.each(files, function (file) {
                if (file.isdir) {
                  tasks.push(helpers.info(path.join(folder, file.name)));
                }
              });
              Promise.all(tasks).then(function (folders) {
                tree = tree.concat(folders);
                read(folder);
              });
            })
            .catch(function (e) {
              reject(e);
            });
        }
      };
      read(dir.absolutePath);
    });
  });
};

api.paste = function (opts, res) {
  return new promise(function (resolve, reject) {
    const tasks = [];
    const dest = helpers.decode(opts.dst);
    _.each(opts.targets, function (target) {
      const info = helpers.decode(target);
      let name = info.name;
      if (opts.renames && opts.renames.indexOf(info.name) >= 0) {
        const ext = path.extname(name);
        const fil = path.basename(name, ext);
        name = fil + opts.suffix + ext;
      }
      if (opts.cut == 1) {
        tasks.push(
          api.move({
            src: info.absolutePath,
            dst: path.join(dest.absolutePath, name),
          })
        );
      } else {
        tasks.push(
          api.copy({
            src: info.absolutePath,
            dst: path.join(dest.absolutePath, name),
          })
        );
      }
    });
    promise
      .all(tasks)
      .then(function (results) {
        const rtn = {
          added: [],
          removed: [],
          changed: [],
        };
        _.each(results, function (r) {
          rtn.added.push(r.added[0]);
          if (r?.removed[0]) {
            rtn.removed.push(r.removed[0]);
          }
          if (r?.changed[0] && rtn.changed.indexOf(r.changed[0]) < 0) {
            rtn.changed.push(r.changed[0]);
          }
        });
        resolve(rtn);
      })
      .catch(function (e) {
        reject(e);
      });
  });
};

api.rename = function (opts, res) {
  if (!opts.target) return promise.reject('errCmdParams');
  const dir = helpers.decode(opts.target);
  const dirname = path.dirname(dir.absolutePath);
  return api.move({
    src: dir.absolutePath,
    dst: path.join(dirname, opts.name),
  });
};

api.resize = function (opts, res) {
  return new promise(function (resolve, reject) {
    const target = helpers.decode(opts.target);
    Jimp.read(target.absolutePath)
      .then(function (image) {
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
        image.quality(parseInt(opts.quality)).write(target.absolutePath);
        return helpers.info(target.absolutePath);
      })
      .then(function (info) {
        info.tmb = 1;
        resolve({
          changed: [info],
        });
      })
      .catch(function (err) {
        reject(err);
      });
  });
};

api.rm = async function (opts, res) {
  const removed = [];

  for (const hash of opts.targets) {
    const target = helpers.decode(hash);
    await fs.remove(target.absolutePath);
    removed.push(hash);
  }

  return { removed };
};

//not impletemented
api.size = function (opts, res) {
  return promise.resolve({
    size: 'unkown',
  });
};

api.search = function (opts, res) {
  return new promise(function (resolve, reject) {
    if (!opts.q || opts.q.length < 1)
      reject({
        message: 'errCmdParams',
      });
    const target = helpers.decode(opts.target);
    const tasks = [];

    fs.walk(target.absolutePath)
      .on('data', function (item) {
        const name = path.basename(item.path);
        if (name.indexOf(opts.q) >= 0) {
          tasks.push(helpers.info(item.path));
        }
      })
      .on('end', function () {
        promise
          .all(tasks)
          .then(function (files) {
            resolve({
              files: files,
            });
          })
          .catch(function (err) {
            reject(err);
          });
      });
  });
};

api.tmb = function (opts, res) {
  return new promise(function (resolve, reject) {
    const files = [];
    if (opts.current) {
      const dir = helpers.decode(opts.current);
      const items = fs.readdirSync(dir.absolutePath);
      _.each(items, function (item) {
        const _m = mime.lookup(item);
        if (_m !== false && _m.indexOf('image/') == 0) {
          files.push(path.join(dir.absolutePath, item));
        }
      });
    } else if (opts.targets) {
      _.each(opts.targets, function (target) {
        const _t = helpers.decode(target);
        files.push(_t.absolutePath);
      });
    }
    //create.
    const tasks = [];
    _.each(files, function (file) {
      tasks.push(
        Jimp.read(file).then(function (img) {
          const op = helpers.encode(file);
          img.resize(48, 48).write(path.join(config.tmbroot, op + '.png'));
          return promise.resolve(op);
        })
      );
    });
    promise
      .all(tasks)
      .then(function (hashes) {
        const rtn = {};
        _.each(hashes, function (hash) {
          rtn[hash] = hash + '.png';
        });
        resolve({
          images: rtn,
        });
      })
      .catch(function (err) {
        console.log(err);
        reject(err);
      });
  });
};

api.tree = async function (opts, res) {
  if (!opts.target) throw new Error('errCmdParams');
  const dir = helpers.decode(opts.target);
  const files = await helpers.readdir(dir.absolutePath);

  const tasks = files.map(async (file) => {
    if (file.isdir) {
      return helpers.info(path.join(dir.absolutePath, file.name));
    }
  });

  const tree = Promise.all(tasks);
  return { tree };
};

api.upload = async function (opts, res, files) {
  const target = helpers.decode(opts.target);

  const tasks = [];
  for (let i = 0; i < files.length; i++) {
    const _file = files[i];
    //const _dest = opts.upload_path[i];
    const _source = path.resolve(_file.path);
    let _filename = _file.originalname;
    let _saveto = target.absolutePath;
    if (opts.upload_path) {
      _saveto = path.join(_saveto, path.dirname(opts.upload_path[i]));
    }
    if (opts.renames?.indexOf(_file.originalname)) {
      _filename = helpers.suffix(_file.originalname, opts.suffix);
    }
    _saveto = path.join(_saveto, _filename);
    tasks.push(
      api.move({
        src: _source,
        dst: _saveto,
        upload: true,
      })
    );
  }

  const info = await Promise.all(tasks);
  const added = info.map((i) => i.added[0]);

  return { added };
};

api.zipdl = async function (opts, res) {
  if (!opts.targets?.length) throw new Error('errCmdParams');

  let first = opts.targets[0];
  first = helpers.decode(first);
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

module.exports = function (options) {
  Object.assign(config, options);
  Object.assign(helpers.config, config);
};
module.exports.api = api;
