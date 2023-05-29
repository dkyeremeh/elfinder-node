const lz = require('lzutf8'); //Remove after decoupling
const path = require('path'); //Remove
const mime = require('mime-types');
const promise = require('promise');
const _ = require('underscore');
const fs = require('fs-extra');
const archiver = require('archiver');

const config = {};
exports.config = config;

exports.compress = function (files, dest) {
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
      const target = exports.decode(file);
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

exports.copy = async function (opts) {
  const fileExists = await fs.exists(opts.dst);
  if (fileExists) throw new Error('Destination exists');

  await fs.copy(opts.src, opts.dst);
  const info = exports.info(opts.dst);

  return {
    added: [info],
    changed: [exports.encode(path.dirname(opts.dst))],
  };
};

exports.decode = function (dir) {
  let root, name, volume;
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

//Used by exports.info, api.opne, api.tmb, api.zipdl
exports.encode = function (dir) {
  const info = exports.parse(dir);
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

exports.filepath = function (volume, filename) {
  if (volume < 0 || volume > 2) return null;
  return path.join(config.volumes[volume], path.normalize(filename));
};

exports.info = function (p) {
  return new promise(function (resolve, reject) {
    const info = exports.parse(p);
    if (info.volume < 0) return reject('Volume not found');

    fs.stat(p, function (err, stat) {
      if (err) return reject(err);
      const r = {
        name: path.basename(p),
        size: stat.size,
        hash: exports.encode(p),
        mime: stat.isDirectory() ? 'directory' : mime.lookup(p),
        ts: Math.floor(stat.mtime.getTime() / 1000),
        volumeid: 'v' + info.volume + '_',
      };
      if (r.mime === false) {
        r.mime = 'application/binary';
      }
      if (r.mime.indexOf('image/') == 0) {
        const filename = exports.encode(p);
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
        r.phash = exports.encode(parent);
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

exports.init = function () {
  const tasks = [];
  _.each(config.volumes, function (volume) {
    tasks.push(exports.info(volume));
  });

  return Promise.all(tasks).then(function (results) {
    _.each(results, function (result) {
      result.phash = '';
    });
    return promise.resolve(results);
  });
};

exports.move = async function (opts) {
  if (await fs.exists(opts.dst)) {
    throw new Error('Destination exists');
  }

  await fs.move(opts.src, opts.dst);
  const info = await exports.info(opts.dst);
  return {
    added: [info],
    removed: opts.upload ? [] : [exports.encode(opts.src)],
  };
};

//Used by exports.encode & exports.info
exports.parse = function (p) {
  const v = exports.volume(p);
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
exports.readdir = function (dir) {
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

exports.suffix = function (name, suff) {
  const ext = path.extname(name);
  const fil = path.basename(name, ext);
  return fil + suff + ext;
};

exports.tmbfile = function (filename) {
  return path.join(config.tmbroot, filename);
};

//Used by exports.parse & config.acl
exports.volume = function (p) {
  for (let i = 0; i < config.volumes.length; i++) {
    if (i > 9) return -1;
    if (p.indexOf(config.volumes[i]) == 0) {
      return i;
    }
  }
  return -1;
};
