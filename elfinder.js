var express = require('express');
var router = express.Router();
var LFS = require('./LocalFileStorage'),
	connector = LFS.api,
	utils = require("./utils");
	path = require('path'),
	promise = require('promise'),
	multer = require('multer'),
	fs = require('fs-extra'),
	_ = require('underscore');
	

module.exports = function( roots ){

	var volumes = roots.map( (r)=>r.path );
	var media = path.resolve( volumes[0] );

	LFS({
		roots: roots,
		tmbroot: path.join(media, '.tmb'),
		volumes: volumes
	})

	router.get('/', function (req, res, next) {
		var cmd = req.query.cmd;
		if (cmd && connector[cmd]) {
			connector[cmd]( req.query, res).then(function (result) {
				res.json(result);
			}).catch(function (e) {
				res.json({ error: e.message });
			})
		}
		else{
			res.json({ error: cmd + " is not implemented by volume driver"});
		}
	});

	var upload = multer({ dest: 'media/.tmp/' });

	router.post('/', upload.array('upload[]', 10), function (req, res, next) {
		var cmd = req.body.cmd;
		if (cmd && connector[cmd]) {
			connector[cmd](req.body, res, req.files).then(function (result) {
				res.json(result);
			}).catch(function (e) {
				res.json({ error: e.message });
			})
		}
		else{
			res.json({ error: cmd + " is not implemented by volume driver"});
		}
	})

	router.get('/tmb/:filename', function (req, res, next) {
		res.sendFile(connector.tmbfile(req.params.filename));
	})

	//TODO: Remove this code after removing its dependency in LFS
	router.get('/file/:volume/*', function (req, res, next) {
		var file = connector.filepath(req.params.volume, req.params['0']);
		if (file)
			res.sendFile(file);
		else {
			res.status(404);
			res.send();
		}
	})

	return router;

}

module.exports.LocalFileStorage = LFS;
module.exports.utils = utils;
