"use strict";

const jshint = require("jshint").JSHINT;
const assert = require("chai").assert;
const fs = require("fs-extra");

// Test all js files

var files = fs.readdirSync("./");
const config = JSON.parse( fs.readFileSync("./.jshintrc","utf-8") );

for( var i=0; files[i]; i++){
	// Only test javascript files
	if( !( files[i].match(/.js$/) || files[i].match(/.json$/) )  ){
		continue;
	}

	var content = fs.readFileSync( files[i], "utf-8" );
	console.log("testing ", files[i]);
	
	assert.equal( jshint(content, config), true );
}
