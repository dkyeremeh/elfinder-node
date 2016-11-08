var lz = require('lzutf8'),
    path = require('path'),
    mime = require('mime-types'),
    promise = require('promise'),
    _ = require('underscore'),
    Jimp = require('jimp'),
    fsextra = require('fs-extra'),
    archiver = require('archiver'),
    fs = require('fs');

var m = {};
m.config = {
    router: '/connector',
    disabled: ['chmod', 'zipdl', 'mkfile'],
    volumeicons: ['elfinder-navbar-root-local', 'elfinder-navbar-root-local']   
}
m.config.acl = function(user, dir){
    var volume = -1;
    for(var i=0; i<m.config.volumes.length; i++){
        if (dir.indexOf(m.config.volumes[i]) == 0){
            volume = i;
        }
    }
    if (volume == 0){//public
        return { read: 1, write: 1, locked: 0 }
    }else if (volume == 1){
        var mypath = path.join(m.config.volumes[1], user);
        if (dir.indexOf(mypath) == 0){
            return {read: 1, write: 1, locked: 0}
        }else{
            return {read: 1, write: 0, locked: 1}
        }
    }else if (volume == 2){
        if (dir.indexOf(m.config.volumes[2]) == 0){
            return {read: 1, write: 1, locked: 0}
        }else{
            return {read: 0, write: 0, locked: 1}
        }
    }
    return {}
}

m.setup = function(opts){
    Object.assign(m.config, opts);
}

m.open = function(user, opts){
    return new promise(function(resolve, reject){
        var data = {};
        data.options = {
            uiCmdMap: [],
            tmbUrl: m.config.router + '/tmb/'
        }
        var _init = opts.init && opts.init == true;
        var _target = opts.target;
        
        if (_init){
            if (m.config.init) m.config.init();
            data.api = "2.1";
            if (!_target){
                _target = m.encode(m.config.volumes[0] + path.sep);
            }
        }
        if (!_target){
            return reject('errCmdParams');
        }
        //NOTE target must always be directory
        _target = m.decode(_target);

        m.info(_target.absolutePath, user).then(function(result){
            data.cwd = result;
            var files;
            try{
                files = fs.readdirSync(_target.absolutePath);
            }catch(e){
                //errors.
                console.log(e);
                files = [];
            }
            var tasks = [];
            _.each(files, function(file){
                tasks.push(m.info(path.join(_target.absolutePath, file), user));
            })
            return promise.all(tasks);
        }).then(function(files){
            data.files = files;
            if (_init){
                return m.init(user);
            }else{
                return promise.resolve(null);
            }
        }).then(function(volumes){
            if (volumes != null){
                data.files = volumes.concat(data.files);
            }
        }).then(function(){
            resolve(data);
        })
    })
}

m.tree = function(user, opts){
    return new promise(function(resolve, reject){
        if (!opts.target) return reject('errCmdParams');
        var dir = m.decode(opts.target);
        m.readdir(dir.absolutePath, user).then(function(files){
            var tasks = [];
            _.each(files, function(file){
                if (file.isdir){
                    tasks.push(m.info(path.join(dir.absolutePath, file.name), user));
                }
            })
            return promise.all(tasks);
        }).then(function(folders){
            resolve({tree: folders});
        }).catch(function(e){
            reject(e);
        })
    })
}

m.tmb = function(user, opts){
    return new promise(function(resolve, reject){
        var files = [];
        if (opts.current){
            var dir = m.decode(opts.current);
            var items = fs.readdirSync(dir.absolutePath);
            _.each(items, function(item){
                var _m = mime.lookup(item);
                if (_m !== false && _m.indexOf('image/') == 0){
                    files.push(path.join(dir.absolutePath, item));
                }
            })
        }else if (opts.targets){
            _.each(opts.targets, function(target){
                var _t = m.decode(target);
                files.push(_t.absolutePath);
            })
        }
        //create.
        var tasks = [];
        _.each(files, function(file){
            tasks.push(Jimp.read(file).then(function(img){
                var op = m.encode(file);
                img.resize(48, 48)
                   .write(path.join(m.config.tmbroot, op + ".png"));
                return promise.resolve(op);
            }));
        })
        promise.all(tasks).then(function(hashes){
            var rtn = {};
            _.each(hashes, function(hash){
                rtn[hash] = hash + '.png';
            })
            resolve({images: rtn});
        }).catch(function(err){
            console.log(err);
            reject(err);
        })
    })
}

m.init = function(user){
    var tasks = [];
    _.each(m.config.volumes, function(volume){
        tasks.push(m.info(volume, user));
    })

    return promise.all(tasks).then(function(results){
        _.each(results, function(result){
            result.phash = '';
        })
        return promise.resolve(results);
    })
}

m.parents = function(user, opts){
    return new promise(function(resolve, reject){
        if (!opts.target) return reject('errCmdParams');
        var dir = m.decode(opts.target);
        var tree;
        m.init(user).then(function(results){
            tree = results;
            var read = function(t){
                var folder = path.dirname(t);
                var isRoot = m.config.volumes.indexOf(t) >= 0;
                if (isRoot){
                    return resolve({tree: tree});
                }else{
                    m.readdir(folder, user).then(function(files){
                        var tasks = [];
                        _.each(files, function(file){
                            if (file.isdir){
                                tasks.push(m.info(path.join(folder, file.name), user));
                            }
                        })
                        promise.all(tasks).then(function(folders){
                            tree = tree.concat(folders);
                            read(folder);
                        });
                    }).catch(function(e){
                        reject(e);
                    })
                }
            }
            read(dir.absolutePath);
        })
    })
}

m.ls = function(user, opts){
    return new promise(function(resolve, reject){
        if (!opts.target) return reject('errCmdParams');
        var info = m.decode(opts.target);
        m.readdir(info.absolutePath, user).then(function(files){
            var _files = files.map(function(e){ return e.name});
            if (opts.intersect){
                _files = _.intersection(_files, opts.intersect);
            }
            resolve({list: _files});
        })
    })
}
//TODO check permission.
m.mkdir = function(user, opts){
    return new promise(function(resolve, reject){
        var dir = m.decode(opts.target);
        var tasks = [];
        var dirs = opts.dirs || [];
        if (opts.name){
            dirs.push(opts.name);
        }
        _.each(dirs, function(name){
            var _dir = path.join(dir.absolutePath, name);
            if (!fs.existsSync(_dir)){
                fs.mkdirSync(_dir);
                tasks.push(m.info(_dir, user));
            }
        })
        promise.all(tasks).then(function(added){
            resolve({added: added});
        })
    })
}

m.rm = function(user, opts){
    return new promise(function(resolve, reject){
        var removed = [];
        _.each(opts.targets, function(hash){
            var target = m.decode(hash);
            try{
                fsextra.removeSync(target.absolutePath);
                removed.push(hash);
            }catch(err){
                console.log(err);  
                reject(err); 
            }
        })
        resolve({removed: removed});
    })
}

m.duplicate = function(user, opt){
    return new promise(function(resolve, reject){
        var tasks = [];
        _.each(opt.targets, function(target){
            var _t = m.decode(target);
            var ext = path.extname(_t.name);
            var fil = path.basename(_t.name, ext);
            var name = fil + '(copy)' + ext;
            var base = path.dirname(_t.absolutePath);
            tasks.push(m.copy(user, {src: _t.absolutePath,dst: path.join(base, name)}));
        })
        promise.all(tasks).then(function(info){
            var rtn = {added: []};
            _.each(info, function(i){
                rtn.added.push(i.added[0]);
            })
            resolve(rtn);
        }).catch(function(e){
            reject(e);
        })
    })
}

m.paste = function(user, opts){
    return new promise(function(resolve, reject){
        var tasks = [];
        var dest = m.decode(opts.dst);
        _.each(opts.targets, function(target){
            var info = m.decode(target);
            var name = info.name;
            if (opts.renames && opts.renames.indexOf(info.name) >= 0){
                var ext = path.extname(name);
                var fil = path.basename(name, ext);
                name = fil + opts.suffix + ext;
            }
            if (opts.cut == 1){
                tasks.push(m.move(user, {src: info.absolutePath, dst: path.join(dest.absolutePath, name)}));
            }else{
                tasks.push(m.copy(user, {src: info.absolutePath, dst: path.join(dest.absolutePath, name)}));
            }
        })
        promise.all(tasks).then(function(results){
            var rtn = {added: [], removed: [], changed: []}
            _.each(results, function(r){
                rtn.added.push(r.added[0]);
                if (r.removed && r.removed[0]){
                    rtn.removed.push(r.removed[0]);
                }
                if (r.changed && r.changed[0] && rtn.changed.indexOf(r.changed[0]) < 0){
                    rtn.changed.push(r.changed[0]);
                }
            })
            resolve(rtn);
        }).catch(function(e){ reject(e);})
    })
}

m.rename = function(user, opts){
    if (!opts.target) return promise.reject('errCmdParams');
    var dir = m.decode(opts.target);
    var dirname = path.dirname(dir.absolutePath);
    return m.move(user, {src: dir.absolutePath, dst: path.join(dirname, opts.name)})
}
m.upload = function(user, opts, files){
    return new promise(function(resolve, reject){
        var target = m.decode(opts.target);
        var tasks = [];
        for(var i=0; i<files.length; i++){
            var _file = files[i];
            var _dest = opts.upload_path[i];
            var _source = path.resolve(_file.path);
            var _filename = _file.originalname;
            var _saveto = target.absolutePath;

            if (opts.target != _dest){
                _saveto = path.join(_saveto, path.dirname(_dest));
            }
            if (opts.renames && opts.renames.indexOf(_file.originalname)){
                _filename = m.suffix(_file.originalname, opts.suffix);
            }
            _saveto = path.join(_saveto, _filename);
            tasks.push(m.move(user, {src: _source, dst: _saveto, upload: true}));
        }
        promise.all(tasks).then(function(info){
            var added = [];
            _.each(info, function(i){
                added.push(i.added[0]);
            })
            resolve({added: added});
        }).catch(function(err){
            console.log(err);
            reject(err);
        })
    })
}
m.search = function(user, opts){
    return new promise(function(resolve, reject){
        if (!opts.q || opts.q.length < 1) reject({message: 'errCmdParams'});
        var target = m.decode(opts.target);
        var tasks = [];
        
        fsextra.walk(target.absolutePath).on('data', function (item) {
            var name = path.basename(item.path);
            if (name.indexOf(opts.q) >= 0){
                tasks.push(m.info(item.path, user));
            }
        })
        .on('end', function () {
            promise.all(tasks).then(function(files){
                resolve({files: files})
            }).catch(function(err){
                reject(err);
            })
        })
    })
}
m.zipdl = function(user, opts){
    return new promise(function(resolve, reject){
        if (!opts.targets || !opts.targets[0]) return reject({message: 'errCmdParams'});
        if (opts.download && opts.download == 1)
        {

        }else
        {
            var first = opts.targets[0];
            first = m.decode(first);
            var dir = path.dirname(first.absolutePath);
            var name = path.basename(dir);
            var file = path.join(dir, name + '.zip');
            m.compress(opts.targets, file).then(function(){
                resolve({
                        zipdl: {
                            file: m.encode(file),
                            name: name + '.zip',
                            mime: 'application/zip'
                    }
                })
            }).catch(function(err){
                reject(err);
            })
        }
    })
}
m.archive = function(user, opts){
    return new promise(function(resolve, reject){
        var target = m.decode(opts.target);
        m.compress(opts.targets, path.join(target.absolutePath, opts.name)).then(function(){
            return m.info(path.join(target.absolutePath, opts.name), user);
        }).then(function(info){
            resolve({added: [info]});
        }).catch(function(err){
            reject(err);
        })
    })
}
m.get = function(user, opts){
    return new promise(function(resolve, reject){
        var target = m.decode(opts.target);
        fs.readFile(target.absolutePath, 'utf8', function(err, data){
            if (err) return reject(err);
            resolve({content: data});
        })
    })
}
m.dim = function(user, opts){
    return new promise(function(resolve, reject){
        var target = m.decode(opts.target);
        Jimp.read(target.absolutePath).then(function(img){
            resolve({
                dim: img.bitmap.width + 'x' + img.bitmap.height
            });
        })
    })
}

m.resize = function(user, opts){
    return new promise(function(resolve, reject){
        var target = m.decode(opts.target);
        Jimp.read(target.absolutePath).then(function(image){
            if (opts.mode == 'resize'){
                image = image.resize(parseInt(opts.width), parseInt(opts.height))
            }else if (opts.mode == 'crop'){
                image = image.crop(parseInt(opts.x), parseInt(opts.y), parseInt(opts.width), parseInt(opts.height));
            }else if (opts.mode == 'rotate'){
                image = image.rotate(parseInt(opts.degree));
                if (opts.bg){
                    image = image.background(parseInt(opts.bg.substr(1, 6), 16));
                }
            }
            image.quality(parseInt(opts.quality))
                 .write(target.absolutePath);
            return m.info(target.absolutePath, user);
        }).then(function(info){
            info.tmb = 1;
            resolve({changed: [info]});
        }).catch(function(err){
            reject(err);
        })
    })
}
//not impletemented
m.size = function(user, opts){
    return promise.resolve({size: 'unkown'});
}
//private
m.compress = function(files, dest){
    return new promise(function(resolve, reject){
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
        _.each(files, function(file){
            var target = m.decode(file);
            //check if target is file or dir
            if (fs.lstatSync(target.absolutePath).isDirectory()){
                var name = path.basename(target.absolutePath);
                archive.directory(path.normalize(target.absolutePath + path.sep), name);
            }else{
                archive.file(target.absolutePath, {name: target.name});
            }
        });
        archive.finalize();
    })
}
m.suffix = function(name, suff){
    var ext = path.extname(name);
    var fil = path.basename(name, ext);
    return fil + suff + ext;
}
m.copy = function(user, opts){
    return new promise(function(resolve, reject){
        if (fs.existsSync(opts.dst)){
            return reject('Destination exists');
        }
        fsextra.copy(opts.src, opts.dst, function(err){
            if (err) return reject(err);
            m.info(opts.dst, user).then(function(info){
                resolve({
                    added: [info],
                    changed: [m.encode(path.dirname(opts.dst))]
                });
            }).catch(function(err){
                reject(err);
            })
        })
    })
}
m.move = function(user, opts){
    return new promise(function(resolve, reject){
        if (fs.existsSync(opts.dst)){
            return reject('Destination exists');
        }
        fsextra.move(opts.src, opts.dst, function(err){
            if (err) return reject(err);
            m.info(opts.dst, user).then(function(info){
                resolve({
                    added: [info],
                    removed: opts.upload ? [] : [m.encode(opts.src)]
                });
            }).catch(function(err){
                reject(err);
            })
        })
    })
}
/**
 * dir: absolute path
 */
m.readdir = function(dir, user){
    return new promise(function(resolve, reject){
        var current;
        fs.readdir(dir, function(err, items){
            if (err) return reject(err);
            var files = [];
            _.each(items, function(item){
                var info = fs.lstatSync(path.join(dir, item));
                files.push({name: item, isdir: info.isDirectory()});
            })
            resolve(files);
        })
    })
}
/**
 * p is absolute path.
 */
m.info = function(p, user){
    return new promise(function(resolve, reject){
        var info = m.parse(p);
        if (info.volume < 0) return reject('Volume not found');

        fs.stat(p, function(err, stat){
            if (err) return reject(err);
            var r = {
                name: path.basename(p),
                size: stat.size,
                hash: m.encode(p),
                mime: stat.isDirectory() ? 'directory' : mime.lookup(p),
                ts: Math.floor(stat.mtime.getTime() / 1000),
                volumeid: 'v' + info.volume + '_'
            }
            if (r.mime === false){
                r.mime = 'application/binary';
            }
            if (r.mime.indexOf('image/') == 0){
                var filename = m.encode(p);
                var tmbPath = path.join(m.config.tmbroot, filename + ".png");
                if (fs.existsSync(tmbPath)){
                    r.tmb = filename + '.png';
                }else{
                    r.tmb = "1";
                }
            }

            if (!info.isRoot){
                var parent = path.dirname(p);
                if (parent == root) parent = parent + path.sep;
                r.phash = m.encode(parent);
            }else{
                r.options = {
                    disabled: m.config.disabled,
                    archivers: {
                        create: ['application/zip'],
                        createext: {'application/zip': 'zip'}
                    },
                    url: m.config.router + '/file/' + info.volume + '/'
                }
                if (m.config.volumeicons[info.volume]){
                    r.options.csscls = m.config.volumeicons[info.volume];
                }
            }
            var acl = m.config.acl(user, p);
            r.read = acl.read;
            r.write = acl.write;
            r.locked = acl.locked;
            //check if this folder has child.
            r.isdir = (r.mime == 'directory');

            if (r.isdir){
                var items = fs.readdirSync(p);
                for(var i=0; i<items.length; i++){
                    if (fs.lstatSync(path.join(p, items[i])).isDirectory()){
                        r.dirs = 1;
                        break;
                    }
                }
            }
            resolve(r);
        })
    })
}

m.volume = function(p){
    for(var i=0; i<m.config.volumes.length; i++){
        if (i > 9) return -1;
        if (p.indexOf(m.config.volumes[i]) == 0){
            return i;
        }
    }
    return -1;
}
m.encode = function(dir){
    var info = m.parse(dir);
    relative = lz.compress(info.path, {outputEncoding: "Base64"})
                 .replace(/=+$/g, '')
                 .replace(/\+/g, '-')
                 .replace(/\//g, '_')
                 .replace(/=/g, '.');
    return 'v' + info.volume + '_' + relative;
}
m.decode = function(dir){
    var root, code, name, volume;
    if (!dir || dir.length < 4) throw Error('Invalid Path');
    if (dir[0] != 'v' || dir[2] != '_') throw Error('Invalid Path');
    volume = parseInt(dir[1]);
    
    var relative = dir.substr(3, dir.length - 3)
                    .replace(/-/g, '+')
                    .replace(/_/g, '/')
                    .replace(/\./g, '=');

    relative = lz.decompress(relative + '==', {inputEncoding: "Base64"});
    name = path.basename(relative);    
    root = m.config.volumes[volume];
    return {
        volume: volume,
        dir: root,
        path: relative,
        name: name,
        absolutePath: path.join(root, relative)     
    }
}
m.parse = function(p){
    var v = m.volume(p);
    var root = m.config.volumes[v];
    var relative = p.substr(root.length, p.length - root.length);
    if (!relative.indexOf(path.sep) == 0) relative = path.sep + relative;
    return {
        volume: v,
        dir: root,
        path: relative,
        isRoot: relative == path.sep
    }
}
m.tmbfile = function(filename){
    return path.join(m.config.tmbroot, filename);
}
m.filepath = function(volume, filename){
    if (volume < 0 || volume > 2) return null;
    return path.join(m.config.volumes[volume], path.normalize(filename));
}

module.exports = m;