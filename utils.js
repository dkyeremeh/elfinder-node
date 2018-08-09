"use strict";

var lz = require('lzutf8'),
	path = require('path');
const utils ={};


//Encode a given directory for client
utils.encode = function( volume, p ) {
	var relative = lz.compress(p, {
			outputEncoding: "Base64"
		})
		.replace(/=+$/g, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '.');
	return 'v' + volume + '_' + relative;
}

//Decode the query target supplied by the client into {volume, path, name}
utils.decode = function(dir) {
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
	return {
		volume: volume,
		path: relative,
		name: name,
	}
}

module.exports = utils;