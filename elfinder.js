"use strict";

var express = require('express');
var router = express.Router();
var LFS = require('./LocalFileStorage'),
	utils = require("./utils"),
	path = require('path'),
	multer = require('multer');
	

function initDrivers( roots, result ){

	roots.forEach( function( config, volume ){
		config.volume = volume;
		var driver = roots[ volume ].driver || LFS;
		var volumeInfo = driver.init( config );
		result.files.splice( volume, 0, volumeInfo );
	});

	return result;
}

module.exports = function( roots ){

	var driver;

	router.use( function( req, res, next ){

		// Ensure roots has at least one volume
		if( ! roots.length ){
			res.json({ error: "No roots were specified" });
			return;
		}

		//Detect targeted volume
		var target = req.query.target || req.body && req.body.target	//When target is specified in request
			|| ( req.query.targets && req.query.targets[0] ) || req.body.targets && req.body.targets //When targets is specified instead
			|| utils.encode( 0, path.sep );	//When none are specified
		
		var volume = utils.decode( target ).volume;

		//Setup the driver for targeted volume

		var config = Object.assign( 
			roots[ volume ],
			{ volume, router }
		);
		driver = roots[ volume ].driver || LFS;

		driver( config );

		//Call next middleware
		next();
	});

	router.get('/', function (req, res, next) {
		var cmd = req.query.cmd;
		if (cmd && driver.api[cmd]) {
			driver.api[cmd]( req.query, res)
			.then(function (result){
				//Init all drives when init is set
				return req.query.init ? initDrivers( roots, result ) : result;
			})
			//Send result
			.then(function (result) {
				res.json(result);
			})
			.catch(function (e) {
				console.log(e);
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
		if (cmd && driver.api[cmd]) {
			driver.api[cmd](req.body, res, req.files)
			.then(function (result) {
				res.json(result);
			})
			.catch(function (e) {
				console.log(e);
				res.json({ error: e.message });
			})
		}
		else{
			res.json({ error: cmd + " is not implemented by volume driver"});
		}
	})

	router.get('/tmb/:filename', function (req, res, next) {
		res.sendFile(driver.api.tmbfile(req.params.filename));
	})

	//TODO: Remove this code after removing its dependency in LFS
	router.get('/file/:volume/*', function (req, res, next) {
		var file = driver.api.filepath(req.params.volume, req.params['0']);
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
