var lz = require('lzutf8'),	//Remove after decoupling
	path = require('path'), //Remove
	mime = require('mime-types'),
	promise = require('promise'),
	_ = require('underscore'),
	Jimp = require('jimp'),
	fsextra = require('fs-extra'),
	archiver = require('archiver'),
	fs = require('fs');

elFinder = require("./elfinder");

var api = {};
var private = {}
config = {
	router: '/connector',
	disabled: ['chmod', 'mkfile', 'zipdl', 'edit', 'put', 'size'],
	volumeicons: ['elfinder-navbar-root-local', 'elfinder-navbar-root-local']
}
config.acl = function(path) {
	var volume = private.volume(path);
	return config.roots[volume].permissions || {
		read: 1,
		write: 1,
		locked: 0
	};

}



api.archive = function(opts, res) {
	return new promise(function(resolve, reject) {
		var target = private.decode(opts.target);
		private.compress(opts.targets, path.join(target.absolutePath, opts.name))
			.then(function() {
				return private.info(path.join(target.absolutePath, opts.name));
			})
			.then(function(info) {
				resolve({
					added: [info]
				});
			})
			.catch(function(err) {
				reject(err);
			})
	})
}

api.dim = function(opts, res) {
	return new promise(function(resolve, reject) {
		var target = private.decode(opts.target);
		Jimp.read(target.absolutePath)
			.then(function(img) {
				resolve({
					dim: img.bitmap.width + 'x' + img.bitmap.height
				});
			})
	})
}

api.copy = function(opts, res) {
	return new promise(function(resolve, reject) {
		if (fs.existsSync(opts.dst)) {
			return reject('Destination exists');
		}
		fsextra.copy(opts.src, opts.dst, function(err) {
			if (err) return reject(err);
			private.info(opts.dst)
				.then(function(info) {
					resolve({
						added: [info],
						changed: [m.encode(path.dirname(opts.dst))]
					});
				})
				.catch(function(err) {
					reject(err);
				})
		})
	})
}

api.duplicate = function(opt) {
	return new promise(function(resolve, reject) {
		var tasks = [];
		_.each(opt.targets, function(target) {
			var _t = private.decode(target);
			var ext = path.extname(_t.name);
			var fil = path.basename(_t.name, ext);
			var name = fil + '(copy)' + ext;
			var base = path.dirname(_t.absolutePath);
			tasks.push(api.copy({
				src: _t.absolutePath,
				dst: path.join(base, name)
			}));
		})
		promise.all(tasks)
			.then(function(info) {
				var rtn = {
					added: []
				};
				_.each(info, function(i) {
					rtn.added.push(i.added[0]);
				})
				resolve(rtn);
			})
			.catch(function(e) {
				reject(e);
			})
	})
}

api.file = function(opts, res) {
	return new promise(function(resolve, reject) {
		var target = private.decode(opts.target);
		res.sendFile(target.absolutePath);
	})
}

api.get = function(opts, res) {
	return new promise(function(resolve, reject) {
		var target = private.decode(opts.target);
		fs.readFile(target.absolutePath, 'utf8', function(err, data) {
			if (err) return reject(err);
			resolve({
				content: data
			});
		})
	})
}

//TODO: Implement this
api.info = function(opts, res){

}

api.ls = function(opts, res) {
	return new promise(function(resolve, reject) {
		if (!opts.target) return reject('errCmdParams');
		var info = private.decode(opts.target);
		private.readdir(info.absolutePath)
			.then(function(files) {
				var _files = files.map(function(e) {
					return e.name
				});
				if (opts.intersect) {
					_files = _.intersection(_files, opts.intersect);
				}
				resolve({
					list: _files
				});
			})
	})
}

//TODO check permission.
api.mkdir = function(opts, res) {
	return new promise(function(resolve, reject) {
		var dir = private.decode(opts.target);
		var tasks = [];
		var dirs = opts.dirs || [];
		if (opts.name) {
			dirs.push(opts.name);
		}
		_.each(dirs, function(name) {
			var _dir = path.join(dir.absolutePath, name);
			if (!fs.existsSync(_dir)) {
				fs.mkdirSync(_dir);
				tasks.push(private.info(_dir));
			}
		})
		promise.all(tasks)
			.then(function(added) {
				resolve({
					added: added
				});
			})
	})
}

api.move = function(opts, res) {
	return new promise(function(resolve, reject) {
		if (fs.existsSync(opts.dst)) {
			return reject('Destination exists');
		}
		fsextra.move(opts.src, opts.dst, function(err) {
			if (err) return reject(err);
			private.info(opts.dst)
				.then(function(info) {
					resolve({
						added: [info],
						removed: opts.upload ? [] : [m.encode(opts.src)]
					});
				})
				.catch(function(err) {
					reject(err);
				})
		})
	})
}

api.open = function(opts, res) {
	return new promise(function(resolve, reject) {
		var data = {};
		data.options = {
			uiCmdMap: [],
			tmbUrl: path.join(config.roots[0].URL, '.tmb/', )
		}
		var _init = opts.init && opts.init == true;
		var _target = opts.target;

		if (_init) {
			if (config.init) config.init();
			data.api = "2.1";
			if (!_target) {
				_target = private.encode(config.volumes[0] + path.sep);
			}
		}
		if (!_target) {
			return reject('errCmdParams');
		}
		//NOTE target must always be directory
		_target = private.decode(_target);

		private.info(_target.absolutePath)
			.then(function(result) {
				data.cwd = result;
				var files;
				try {
					files = fs.readdirSync(_target.absolutePath);
				} catch (e) {
					//errors.
					console.log(e);
					files = [];
				}
				var tasks = [];
				_.each(files, function(file) {
					tasks.push(private.info(path.join(_target.absolutePath, file)));
				})
				return promise.all(tasks);
			})
			.then(function(files) {
				data.files = files;
				if (_init) {
					return private.init();
				} else {
					return promise.resolve(null);
				}
			})
			.then(function(volumes) {
				if (volumes != null) {
					data.files = volumes.concat(data.files);
				}
			})
			.then(function() {
				resolve(data);
			})
	})
}

api.parents = function(opts, res) {
	return new promise(function(resolve, reject) {
		if (!opts.target) return reject('errCmdParams');
		var dir = private.decode(opts.target);
		var tree;
		private.init()
			.then(function(results) {
				tree = results;
				var read = function(t) {
					var folder = path.dirname(t);
					var isRoot = config.volumes.indexOf(t) >= 0;
					if (isRoot) {
						return resolve({
							tree: tree
						});
					} else {
						private.readdir(folder)
							.then(function(files) {
								var tasks = [];
								_.each(files, function(file) {
									if (file.isdir) {
										tasks.push(private.info(path.join(folder, file.name)));
									}
								})
								promise.all(tasks)
									.then(function(folders) {
										tree = tree.concat(folders);
										read(folder);
									});
							})
							.catch(function(e) {
								reject(e);
							})
					}
				}
				read(dir.absolutePath);
			})
	})
}

api.paste = function(opts, res) {
	return new promise(function(resolve, reject) {
		var tasks = [];
		var dest = private.decode(opts.dst);
		_.each(opts.targets, function(target) {
			var info = private.decode(target);
			var name = info.name;
			if (opts.renames && opts.renames.indexOf(info.name) >= 0) {
				var ext = path.extname(name);
				var fil = path.basename(name, ext);
				name = fil + opts.suffix + ext;
			}
			if (opts.cut == 1) {
				tasks.push(api.move({
					src: info.absolutePath,
					dst: path.join(dest.absolutePath, name)
				}));
			} else {
				tasks.push(api.copy({
					src: info.absolutePath,
					dst: path.join(dest.absolutePath, name)
				}));
			}
		})
		promise.all(tasks)
			.then(function(results) {
				var rtn = {
					added: [],
					removed: [],
					changed: []
				}
				_.each(results, function(r) {
					rtn.added.push(r.added[0]);
					if (r.removed && r.removed[0]) {
						rtn.removed.push(r.removed[0]);
					}
					if (r.changed && r.changed[0] && rtn.changed.indexOf(r.changed[0]) < 0) {
						rtn.changed.push(r.changed[0]);
					}
				})
				resolve(rtn);
			})
			.catch(function(e) {
				reject(e);
			})
	})
}

api.rename = function(opts, res) {
	if (!opts.target) return promise.reject('errCmdParams');
	var dir = private.decode(opts.target);
	var dirname = path.dirname(dir.absolutePath);
	return api.move({
		src: dir.absolutePath,
		dst: path.join(dirname, opts.name)
	})
}

api.resize = function(opts, res) {
	return new promise(function(resolve, reject) {
		var target = private.decode(opts.target);
		Jimp.read(target.absolutePath)
			.then(function(image) {
				if (opts.mode == 'resize') {
					image = image.resize(parseInt(opts.width), parseInt(opts.height))
				} else if (opts.mode == 'crop') {
					image = image.crop(parseInt(opts.x), parseInt(opts.y), parseInt(opts.width), parseInt(opts.height));
				} else if (opts.mode == 'rotate') {
					image = image.rotate(parseInt(opts.degree));
					if (opts.bg) {
						image = image.background(parseInt(opts.bg.substr(1, 6), 16));
					}
				}
				image.quality(parseInt(opts.quality))
					.write(target.absolutePath);
				return private.info(target.absolutePath);
			})
			.then(function(info) {
				info.tmb = 1;
				resolve({
					changed: [info]
				});
			})
			.catch(function(err) {
				reject(err);
			})
	})
}

api.rm = function(opts, res) {
	return new promise(function(resolve, reject) {
		var removed = [];
		_.each(opts.targets, function(hash) {
			var target = private.decode(hash);
			try {
				fsextra.removeSync(target.absolutePath);
				removed.push(hash);
			} catch (err) {
				console.log(err);
				reject(err);
			}
		})
		resolve({
			removed: removed
		});
	})
}

//not impletemented
api.size = function(opts, res) {
	return promise.resolve({
		size: 'unkown'
	});
}

api.search = function(opts, res) {
	return new promise(function(resolve, reject) {
		if (!opts.q || opts.q.length < 1) reject({
			message: 'errCmdParams'
		});
		var target = private.decode(opts.target);
		var tasks = [];

		fsextra.walk(target.absolutePath)
			.on('data', function(item) {
				var name = path.basename(item.path);
				if (name.indexOf(opts.q) >= 0) {
					tasks.push(private.info(item.path));
				}
			})
			.on('end', function() {
				promise.all(tasks)
					.then(function(files) {
						resolve({
							files: files
						})
					})
					.catch(function(err) {
						reject(err);
					})
			})
	})
}

api.tmb = function(opts, res) {
	return new promise(function(resolve, reject) {
		var files = [];
		if (opts.current) {
			var dir = private.decode(opts.current);
			var items = fs.readdirSync(dir.absolutePath);
			_.each(items, function(item) {
				var _m = mime.lookup(item);
				if (_m !== false && _m.indexOf('image/') == 0) {
					files.push(path.join(dir.absolutePath, item));
				}
			})
		} else if (opts.targets) {
			_.each(opts.targets, function(target) {
				var _t = private.decode(target);
				files.push(_t.absolutePath);
			})
		}
		//create.
		var tasks = [];
		_.each(files, function(file) {
			tasks.push(Jimp.read(file)
				.then(function(img) {
					var op = private.encode(file);
					img.resize(48, 48)
						.write(path.join(config.tmbroot, op + ".png"));
					return promise.resolve(op);
				}));
		})
		promise.all(tasks)
			.then(function(hashes) {
				var rtn = {};
				_.each(hashes, function(hash) {
					rtn[hash] = hash + '.png';
				})
				resolve({
					images: rtn
				});
			})
			.catch(function(err) {
				console.log(err);
				reject(err);
			})
	})
}

api.tree = function(opts, res) {
	return new promise(function(resolve, reject) {
		if (!opts.target) return reject('errCmdParams');
		var dir = private.decode(opts.target);
		private.readdir(dir.absolutePath)
			.then(function(files) {
				var tasks = [];
				_.each(files, function(file) {
					if (file.isdir) {
						tasks.push(private.info(path.join(dir.absolutePath, file.name)));
					}
				})
				return promise.all(tasks);
			})
			.then(function(folders) {
				resolve({
					tree: folders
				});
			})
			.catch(function(e) {
				reject(e);
			})
	})
}

api.upload = function(opts, res, files) {
	return new promise(function(resolve, reject) {
		var target = private.decode(opts.target);

		var tasks = [];
		for (var i = 0; i < files.length; i++) {
			var _file = files[i];
			//var _dest = opts.upload_path[i];
			var _source = path.resolve(_file.path);
			var _filename = _file.originalname;
			var _saveto = target.absolutePath;
			if (opts.upload_path) {
				_saveto = path.join(_saveto, path.dirname(opts.upload_path[i]));
			}
			if (opts.renames && opts.renames.indexOf(_file.originalname)) {
				_filename = private.suffix(_file.originalname, opts.suffix);
			}
			_saveto = path.join(_saveto, _filename);
			tasks.push(api.move({
				src: _source,
				dst: _saveto,
				upload: true
			}));
		}
		promise.all(tasks)
			.then(function(info) {
				var added = [];
				_.each(info, function(i) {
					added.push(i.added[0]);
				})
				resolve({
					added: added
				});
			})
			.catch(function(err) {
				console.log(err);
				reject(err);
			})
	})
}

api.zipdl = function(opts, res) {
	return new promise(function(resolve, reject) {
		if (!opts.targets || !opts.targets[0]) return reject({
			message: 'errCmdParams'
		});
		if (opts.download && opts.download == 1) {

		} else {
			var first = opts.targets[0];
			first = private.decode(first);
			var dir = path.dirname(first.absolutePath);
			var name = path.basename(dir);
			var file = path.join(dir, name + '.zip');
			private.compress(opts.targets, file)
				.then(function() {
					resolve({
						zipdl: {
							file: private.encode(file),
							name: name + '.zip',
							mime: 'application/zip'
						}
					})
				})
				.catch(function(err) {
					reject(err);
				})
		}
	})
}



//private
private.compress = function(files, dest) {
	return new promise(function(resolve, reject) {
		var output = fs.createWriteStream(dest);
		var archive = archiver('zip', {
			store: true // Sets the compression method to STORE.
		});
		// listen for all archive data to be written
		output.on('close', function() {
			resolve(true);
		});
		archive.on('error', function(err) {
			console.log(err);
			reject(err);
		});
		archive.pipe(output);
		_.each(files, function(file) {
			var target = private.decode(file);
			//check if target is file or dir
			if (fs.lstatSync(target.absolutePath)
				.isDirectory()) {
				var name = path.basename(target.absolutePath);
				archive.directory(path.normalize(target.absolutePath + path.sep), name);
			} else {
				archive.file(target.absolutePath, {
					name: target.name
				});
			}
		});
		archive.finalize();
	})
}
private.decode = function(dir) {
	var root, code, name, volume;
	if (!dir || dir.length < 4) throw Error('Invalid Path');
	if (dir[0] != 'v' || dir[2] != '_') throw Error('Invalid Path');
	volume = parseInt(dir[1]);

	var relative = dir.substr(3, dir.length - 3)
		.replace(/-/g, '+')
		.replace(/_/g, '/')
		.replace(/\./g, '=');

	relative = lz.decompress(relative + '==', {
		inputEncoding: "Base64"
	});
	name = path.basename(relative);
	root = config.volumes[volume];
	return {
		volume: volume,
		dir: root,
		path: relative,
		name: name,
		absolutePath: path.join(root, relative)
	}
}

//Used by private.info, api.opne, api.tmb, api.zipdl
private.encode = function(dir) {
	var info = private.parse(dir);
	relative = lz.compress(info.path, {
			outputEncoding: "Base64"
		})
		.replace(/=+$/g, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '.');
	return 'v' + info.volume + '_' + relative;
}

private.filepath = function(volume, filename) {
	if (volume < 0 || volume > 2) return null;
	return path.join(config.volumes[volume], path.normalize(filename));
}

private.info = function(p) {
	return new promise(function(resolve, reject) {
		var info = private.parse(p);
		if (info.volume < 0) return reject('Volume not found');

		fs.stat(p, function(err, stat) {
			if (err) return reject(err);
			var r = {
				name: path.basename(p),
				size: stat.size,
				hash: private.encode(p),
				mime: stat.isDirectory() ? 'directory' : mime.lookup(p),
				ts: Math.floor(stat.mtime.getTime() / 1000),
				volumeid: 'v' + info.volume + '_'
			}
			if (r.mime === false) {
				r.mime = 'application/binary';
			}
			if (r.mime.indexOf('image/') == 0) {
				var filename = private.encode(p);
				var tmbPath = path.join(config.tmbroot, filename + ".png");
				if (fs.existsSync(tmbPath)) {
					r.tmb = filename + '.png';
				} else {
					r.tmb = "1";
				}
			}

			if (!info.isRoot) {
                var parent = path.dirname(p);
                // if (parent == root) parent = parent + path.sep;
				r.phash = private.encode(parent);
			} else {
				r.options = {
					disabled: config.disabled,
					archivers: {
						create: ['application/zip'],
						createext: {
							'application/zip': 'zip'
						}
					},
					url: config.roots[info.volume].URL
				}
				if (config.volumeicons[info.volume]) {
					r.options.csscls = config.volumeicons[info.volume];
				}
			}
			var acl = config.acl(p);
			r.read = acl.read;
			r.write = acl.write;
			r.locked = acl.locked;
			//check if this folder has child.
			r.isdir = (r.mime == 'directory');

			if (r.isdir) {
				var items = fs.readdirSync(p);
				for (var i = 0; i < items.length; i++) {
					if (fs.lstatSync(path.join(p, items[i]))
						.isDirectory()) {
						r.dirs = 1;
						break;
					}
				}
			}
			resolve(r);
		})
	})
}

private.init = function() {
	var tasks = [];
	_.each(config.volumes, function(volume) {
		tasks.push(private.info(volume));
	})

	return promise.all(tasks)
		.then(function(results) {
			_.each(results, function(result) {
				result.phash = '';
			})
			return promise.resolve(results);
		})
}

//Used by private.encode & private.info
private.parse = function(p) {
	var v = private.volume(p);
	var root = config.volumes[v] || "";
	var relative = p.substr(root.length, p.length - root.length);
	if (!relative.indexOf(path.sep) == 0) relative = path.sep + relative;
	return {
		volume: v,
		dir: root,
		path: relative,
		isRoot: relative == path.sep
	}
}

/**
 * dir: absolute path
 */
private.readdir = function(dir) {
	return new promise(function(resolve, reject) {
		var current;
		fs.readdir(dir, function(err, items) {
			if (err) return reject(err);
			var files = [];
			_.each(items, function(item) {
				var info = fs.lstatSync(path.join(dir, item));
				files.push({
					name: item,
					isdir: info.isDirectory()
				});
			})
			resolve(files);
		})
	})
}

private.suffix = function(name, suff) {
	var ext = path.extname(name);
	var fil = path.basename(name, ext);
	return fil + suff + ext;
}

private.tmbfile = function(filename) {
	return path.join(config.tmbroot, filename);
}

//Used by private.parse & config.acl
private.volume = function(p) {
	for (var i = 0; i < config.volumes.length; i++) {
		if (i > 9) return -1;
		if (p.indexOf(config.volumes[i]) == 0) {
			return i;
		}
	}
	return -1;
}


module.exports = function( options ){
	Object.assign(config, options);
};
module.exports.api = api;


