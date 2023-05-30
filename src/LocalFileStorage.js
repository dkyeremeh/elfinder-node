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
  disabled: ['chmod', 'size'],
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

api.duplicate = async function (opt) {
  const tasks = opt.targets.map(async (target) => {
    const _t = helpers.decode(target);
    const ext = path.extname(_t.name);
    const fil = path.basename(_t.name, ext);
    const name = fil + '(copy)' + ext;
    const base = path.dirname(_t.absolutePath);

    return helpers.copy({
      src: _t.absolutePath,
      dst: path.join(base, name),
    });
  });

  const info = await Promise.all(tasks);

  return {
    added: info.map((i) => i.added[0]),
  };
};

api.extract = async function (opts, res) {
  const target = helpers.decode(opts.target);
  const mkdir = opts.makedir == 1;

  let dest = path.dirname(target.absolutePath);
  if (mkdir) {
    const newDir = path.basename(target.absolutePath).split('.')[0];
    const newDirPath = path.resolve(target.absolutePath, newDir);
    console.log({ newDirPath });
    await fs.mkdirp(newDirPath);
    dest = newDirPath;
  }

  const files = await helpers.extract(target.absolutePath, dest);
  const tasks = files.map(async (file) =>
    helpers.info(path.resolve(dest, file))
  );

  return { added: await Promise.all(tasks) };
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

api.mkfile = async function (opts, res) {
  const dir = helpers.decode(opts.target);
  const name = opts.name;
  const filePath = dir.absolutePath + path.sep + name;

  await fs.writeFile(filePath, '');
  return { added: [await helpers.info(filePath)] };
};

api.open = async function (opts, res) {
  let volumes;
  let target = opts.target;
  const init = opts.init == true;
  const encodedRoot = helpers.encode(config.volumes[0] + path.sep);
  const data = {
    options: {
      uiCmdMap: [],
      tmbUrl: path.join(config.roots[0].URL, '.tmb/'),
    },
  };

  if (init) {
    config.init?.();
    target ??= encodedRoot;
  }
  if (!target) throw new Error('errCmdParams');

  //NOTE target must always be directory
  target = helpers.decode(target);
  const dirExists = await fs.exists(target.absolutePath);
  if (!dirExists) target = helpers.decode(encodedRoot);

  let files = (await fs.readdir(target.absolutePath).catch(console.log)) || [];
  const tasks = files.map(async (file) =>
    helpers.info(path.join(target.absolutePath, file))
  );

  data.files = await Promise.all(tasks);
  data.cwd = await helpers.info(target.absolutePath);

  if (init) {
    data.api = '2.1';
    volumes = await helpers.init();
    data.files = volumes.concat(data.files);
  }

  return data;
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

api.paste = async function (opts, res) {
  const dest = helpers.decode(opts.dst);

  const tasks = opts.targets.map(async (target) => {
    const info = helpers.decode(target);
    let name = info.name;
    if (opts.renames && opts.renames.indexOf(info.name) >= 0) {
      const ext = path.extname(name);
      const fil = path.basename(name, ext);
      name = fil + opts.suffix + ext;
    }

    const action = opts.cut == 1 ? helpers.move : helpers.copy;
    return action({
      src: info.absolutePath,
      dst: path.join(dest.absolutePath, name),
    });
  });

  const results = await Promise.all(tasks);

  const rtn = {
    added: [],
    removed: [],
    changed: [],
  };

  results.forEach((r) => {
    rtn.added.push(r.added[0]);
    if (r.removed?.length) {
      rtn.removed.push(r.removed[0]);
    }
    if (r.changed?.length && rtn.changed.indexOf(r.changed[0]) < 0) {
      rtn.changed.push(r.changed[0]);
    }
  });

  return rtn;
};

api.put = async function (opts, res) {
  const target = helpers.decode(opts.target);
  const { content, encoding = 'UTF-8' } = opts;

  await fs.writeFile(target.absolutePath, content);
  const info = await helpers.info(target.absolutePath);
  return { changed: [info] };
};

api.rename = function (opts, res) {
  if (!opts.target) return promise.reject('errCmdParams');
  const dir = helpers.decode(opts.target);
  const dirname = path.dirname(dir.absolutePath);
  return helpers.move({
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

api.upload = async function (opts, res, _files) {
  const target = helpers.decode(opts.target);
  const files = _files instanceof Array ? _files : [_files];

  const tasks = files.map(async (file, i) => {
    let filename = file.filename;
    let dst = target.absolutePath;
    if (opts.upload_path) {
      dst = path.join(dst, path.dirname(opts.upload_path[i]));
    }

    if (opts.renames?.indexOf(file.filename)) {
      filename = helpers.suffix(file.filename, opts.suffix);
    }
    dst = path.join(dst, filename);

    return helpers.move({
      dst,
      src: file.file,
      upload: true,
    });
  });

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
