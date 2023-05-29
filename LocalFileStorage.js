const lz = require('lzutf8'), //Remove after decoupling
  path = require('path'), //Remove
  mime = require('mime-types'),
  promise = require('promise'),
  _ = require('underscore'),
  Jimp = require('jimp'),
  fs = require('fs-extra'),
  archiver = require('archiver');

const elFinder = require('./elfinder');

const api = {};
const priv = {};

config = {
  router: '/connector',
  disabled: ['chmod', 'mkfile', 'zipdl', 'edit', 'put', 'size'],
  volumeicons: ['elfinder-navbar-root-local', 'elfinder-navbar-root-local'],
};
config.acl = function (path) {
  const volume = priv.volume(path);
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
    added: [helpers.info(filePath)],
  };
};

api.dim = async function (opts, res) {
  const target = priv.decode(opts.target);
  const img = await Jimp.read(target.absolutePath);
  return {
    dim: img.bitmap.width + 'x' + img.bitmap.height,
  };
};

api.copy = async function (opts, res) {
  const fileExists = await fs.exists(opts.dst);
  if (fileExists) throw new Error('Destination exists');

  await fs.copy(opts.src, opts.dst);
  const info = priv.info(opts.dst);

  return {
    added: [info],
    changed: [m.encode(path.dirname(opts.dst))],
  };
};

api.duplicate = async function (opt) {
  const tasks = opt.targets.map(async (target) => {
    const _t = priv.decode(target);
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
  const target = priv.decode(opts.target);
  res.sendFile(target.absolutePath);
};

api.get = async function (opts, res) {
  const target = priv.decode(opts.target);
  const content = await fs.readFile(target.absolutePath, 'utf8');
  return { content };
};

//TODO: Implement this
api.info = function (opts, res) {};

api.ls = function (opts, res) {
  return new promise(function (resolve, reject) {
    if (!opts.target) return reject('errCmdParams');
    const info = priv.decode(opts.target);
    priv.readdir(info.absolutePath).then(function (files) {
      let _files = files.map(function (e) {
        return e.name;
      });
      if (opts.intersect) {
        _files = _.intersection(_files, opts.intersect);
      }
      resolve({
        list: _files,
      });
    });
  });
};

//TODO check permission.
api.mkdir = function (opts, res) {
  return new promise(function (resolve, reject) {
    const dir = priv.decode(opts.target);
    const tasks = [];
    const dirs = opts.dirs || [];
    if (opts.name) {
      dirs.push(opts.name);
    }
    _.each(dirs, function (name) {
      const _dir = path.join(dir.absolutePath, name);
      if (!fs.existsSync(_dir)) {
        fs.mkdirSync(_dir);
        tasks.push(priv.info(_dir));
      }
    });
    promise.all(tasks).then(function (added) {
      resolve({
        added: added,
      });
    });
  });
};

api.move = function (opts, res) {
  return new promise(function (resolve, reject) {
    if (fs.existsSync(opts.dst)) {
      return reject('Destination exists');
    }
    fs.move(opts.src, opts.dst, function (err) {
      if (err) return reject(err);
      priv
        .info(opts.dst)
        .then(function (info) {
          resolve({
            added: [info],
            removed: opts.upload ? [] : [m.encode(opts.src)],
          });
        })
        .catch(function (err) {
          reject(err);
        });
    });
  });
};

api.open = function (opts, res) {
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
        _target = priv.encode(config.volumes[0] + path.sep);
      }
    }
    if (!_target) {
      return reject('errCmdParams');
    }
    //NOTE target must always be directory
    _target = priv.decode(_target);

    priv
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
          tasks.push(priv.info(path.join(_target.absolutePath, file)));
        });
        return promise.all(tasks);
      })
      .then(function (files) {
        data.files = files;
        if (_init) {
          return priv.init();
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
      });
  });
};

api.parents = function (opts, res) {
  return new promise(function (resolve, reject) {
    if (!opts.target) return reject('errCmdParams');
    const dir = priv.decode(opts.target);
    let tree;
    priv.init().then(function (results) {
      tree = results;
      const read = function (t) {
        const folder = path.dirname(t);
        const isRoot = config.volumes.indexOf(t) >= 0;
        if (isRoot) {
          return resolve({
            tree: tree,
          });
        } else {
          priv
            .readdir(folder)
            .then(function (files) {
              const tasks = [];
              _.each(files, function (file) {
                if (file.isdir) {
                  tasks.push(priv.info(path.join(folder, file.name)));
                }
              });
              promise.all(tasks).then(function (folders) {
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
    const dest = priv.decode(opts.dst);
    _.each(opts.targets, function (target) {
      const info = priv.decode(target);
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
  const dir = priv.decode(opts.target);
  const dirname = path.dirname(dir.absolutePath);
  return api.move({
    src: dir.absolutePath,
    dst: path.join(dirname, opts.name),
  });
};

api.resize = function (opts, res) {
  return new promise(function (resolve, reject) {
    const target = priv.decode(opts.target);
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
        return priv.info(target.absolutePath);
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

api.rm = function (opts, res) {
  return new promise(function (resolve, reject) {
    const removed = [];
    _.each(opts.targets, function (hash) {
      const target = priv.decode(hash);
      try {
        fs.removeSync(target.absolutePath);
        removed.push(hash);
      } catch (err) {
        console.log(err);
        reject(err);
      }
    });
    resolve({
      removed: removed,
    });
  });
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
    const target = priv.decode(opts.target);
    const tasks = [];

    fs.walk(target.absolutePath)
      .on('data', function (item) {
        const name = path.basename(item.path);
        if (name.indexOf(opts.q) >= 0) {
          tasks.push(priv.info(item.path));
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
      const dir = priv.decode(opts.current);
      const items = fs.readdirSync(dir.absolutePath);
      _.each(items, function (item) {
        const _m = mime.lookup(item);
        if (_m !== false && _m.indexOf('image/') == 0) {
          files.push(path.join(dir.absolutePath, item));
        }
      });
    } else if (opts.targets) {
      _.each(opts.targets, function (target) {
        const _t = priv.decode(target);
        files.push(_t.absolutePath);
      });
    }
    //create.
    const tasks = [];
    _.each(files, function (file) {
      tasks.push(
        Jimp.read(file).then(function (img) {
          const op = priv.encode(file);
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

api.tree = function (opts, res) {
  return new promise(function (resolve, reject) {
    if (!opts.target) return reject('errCmdParams');
    const dir = priv.decode(opts.target);
    priv
      .readdir(dir.absolutePath)
      .then(function (files) {
        const tasks = [];
        _.each(files, function (file) {
          if (file.isdir) {
            tasks.push(priv.info(path.join(dir.absolutePath, file.name)));
          }
        });
        return promise.all(tasks);
      })
      .then(function (folders) {
        resolve({
          tree: folders,
        });
      })
      .catch(function (e) {
        reject(e);
      });
  });
};

api.upload = function (opts, res, files) {
  return new promise(function (resolve, reject) {
    const target = priv.decode(opts.target);

    const tasks = [];
    for (const i = 0; i < files.length; i++) {
      const _file = files[i];
      //const _dest = opts.upload_path[i];
      const _source = path.resolve(_file.path);
      let _filename = _file.originalname;
      let _saveto = target.absolutePath;
      if (opts.upload_path) {
        _saveto = path.join(_saveto, path.dirname(opts.upload_path[i]));
      }
      if (pts.renames?.indexOf(_file.originalname)) {
        _filename = priv.suffix(_file.originalname, opts.suffix);
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
    promise
      .all(tasks)
      .then(function (info) {
        const added = [];
        _.each(info, function (i) {
          added.push(i.added[0]);
        });
        resolve({
          added: added,
        });
      })
      .catch(function (err) {
        console.log(err);
        reject(err);
      });
  });
};

api.zipdl = function (opts, res) {
  return new promise(function (resolve, reject) {
    if (!opts.targets?.[0])
      return reject({
        message: 'errCmdParams',
      });
    if (opts?.download !== 1) {
      let first = opts.targets[0];
      first = priv.decode(first);
      const dir = path.dirname(first.absolutePath);
      const name = path.basename(dir);
      const file = path.join(dir, name + '.zip');
      priv
        .compress(opts.targets, file)
        .then(function () {
          resolve({
            zipdl: {
              file: priv.encode(file),
              name: name + '.zip',
              mime: 'application/zip',
            },
          });
        })
        .catch(function (err) {
          reject(err);
        });
    }
  });
};

//priv
priv.compress = function (files, dest) {
  return new promise(function (resolve, reject) {
    const output = fs.createWriteStream(dest);
    const archive = archiver('zip', {
      store: true, // Sets the compression method to STORE.
    });
    // listen for all archive data to be written
    output.on('close', function () {
      resolve(true);
    });
    archive.on('error', function (err) {
      console.log(err);
      reject(err);
    });
    archive.pipe(output);
    _.each(files, function (file) {
      const target = priv.decode(file);
      //check if target is file or dir
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
priv.decode = function (dir) {
  let root, code, name, volume;
  if (!dir || dir.length < 4) throw Error('Invalid Path');
  if (dir[0] != 'v' || dir[2] != '_') throw Error('Invalid Path');
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
  root = config.volumes[volume];
  return {
    volume: volume,
    dir: root,
    path: relative,
    name: name,
    absolutePath: path.join(root, relative),
  };
};

//Used by priv.info, api.opne, api.tmb, api.zipdl
priv.encode = function (dir) {
  const info = priv.parse(dir);
  const relative = lz
    .compress(info.path, {
      outputEncoding: 'Base64',
    })
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '.');
  return 'v' + info.volume + '_' + relative;
};

priv.filepath = function (volume, filename) {
  if (volume < 0 || volume > 2) return null;
  return path.join(config.volumes[volume], path.normalize(filename));
};

priv.info = function (p) {
  return new promise(function (resolve, reject) {
    const info = priv.parse(p);
    if (info.volume < 0) return reject('Volume not found');

    fs.stat(p, function (err, stat) {
      if (err) return reject(err);
      const r = {
        name: path.basename(p),
        size: stat.size,
        hash: priv.encode(p),
        mime: stat.isDirectory() ? 'directory' : mime.lookup(p),
        ts: Math.floor(stat.mtime.getTime() / 1000),
        volumeid: 'v' + info.volume + '_',
      };
      if (r.mime === false) {
        r.mime = 'application/binary';
      }
      if (r.mime.indexOf('image/') == 0) {
        const filename = priv.encode(p);
        const tmbPath = path.join(config.tmbroot, filename + '.png');
        if (fs.existsSync(tmbPath)) {
          r.tmb = filename + '.png';
        } else {
          r.tmb = '1';
        }
      }

      if (!info.isRoot) {
        const parent = path.dirname(p);
        // if (parent == root) parent = parent + path.sep;
        r.phash = priv.encode(parent);
      } else {
        r.options = {
          disabled: config.disabled,
          archivers: {
            create: ['application/zip'],
            createext: {
              'application/zip': 'zip',
            },
          },
          url: config.roots[info.volume].URL,
        };
        if (config.volumeicons[info.volume]) {
          r.options.csscls = config.volumeicons[info.volume];
        }
      }
      const acl = config.acl(p);
      r.read = acl.read;
      r.write = acl.write;
      r.locked = acl.locked;
      //check if this folder has child.
      r.isdir = r.mime == 'directory';

      if (r.isdir) {
        const items = fs.readdirSync(p);
        for (let i = 0; i < items.length; i++) {
          if (fs.lstatSync(path.join(p, items[i])).isDirectory()) {
            r.dirs = 1;
            break;
          }
        }
      }
      resolve(r);
    });
  });
};

priv.init = function () {
  const tasks = [];
  _.each(config.volumes, function (volume) {
    tasks.push(priv.info(volume));
  });

  return promise.all(tasks).then(function (results) {
    _.each(results, function (result) {
      result.phash = '';
    });
    return promise.resolve(results);
  });
};

//Used by priv.encode & priv.info
priv.parse = function (p) {
  const v = priv.volume(p);
  const root = config.volumes[v] || '';
  let relative = p.substr(root.length, p.length - root.length);
  if (!relative.indexOf(path.sep) == 0) relative = path.sep + relative;
  return {
    volume: v,
    dir: root,
    path: relative,
    isRoot: relative == path.sep,
  };
};

/**
 * dir: absolute path
 */
priv.readdir = function (dir) {
  return new promise(function (resolve, reject) {
    fs.readdir(dir, function (err, items) {
      if (err) return reject(err);
      const files = [];
      _.each(items, function (item) {
        const info = fs.lstatSync(path.join(dir, item));
        files.push({
          name: item,
          isdir: info.isDirectory(),
        });
      });
      resolve(files);
    });
  });
};

priv.suffix = function (name, suff) {
  const ext = path.extname(name);
  const fil = path.basename(name, ext);
  return fil + suff + ext;
};

priv.tmbfile = function (filename) {
  return path.join(config.tmbroot, filename);
};

//Used by priv.parse & config.acl
priv.volume = function (p) {
  for (let i = 0; i < config.volumes.length; i++) {
    if (i > 9) return -1;
    if (p.indexOf(config.volumes[i]) == 0) {
      return i;
    }
  }
  return -1;
};

module.exports = function (options) {
  Object.assign(config, options);
};
module.exports.api = api;
