var express = require('express');
var router = express.Router();
var connector = require('./connector'),
	path = require('path'),
	promise = require('promise'),
	multer = require('multer'),
	fs = require('fs-extra'),
	_ = require('underscore');

module.exports = function( roots ){

	var volumes = roots.map( (r)=>r.path );
		
	/* GET users listing. */
	var media = path.resolve( volumes[0] );
	var user = "public";

	connector.setup({
		roots: roots,
		tmbroot: path.join(media, '.tmb'),
		volumes: volumes
	})

	var upload = multer({ dest: 'media/.tmp/' });

	router.get('/', function (req, res, next) {
		var cmd = req.query.cmd;
		if (cmd == 'file') {
			var target = connector.decode(req.query.target);
			res.sendFile(target.absolutePath);
		} else if (connector[cmd]) {
			connector[cmd](user, req.query).then(function (result) {
				res.json(result);
			}).catch(function (e) {
				res.json({ error: e.message });
			})
		}
	});

	router.post('/', upload.array('upload[]', 10), function (req, res, next) {
		var cmd = req.body.cmd;
		if (cmd && connector[cmd]) {
			connector[cmd](user, req.body, req.files).then(function (result) {
				res.json(result);
			}).catch(function (e) {
				res.json({ error: e.message });
			})
		}
	})

	router.get('/tmb/:filename', function (req, res, next) {
		res.sendFile(connector.tmbfile(req.params.filename));
	})

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
