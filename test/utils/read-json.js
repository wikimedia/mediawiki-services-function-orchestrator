'use strict';

const fs = require('fs');

function readJSON(fileName) {
	return JSON.parse(fs.readFileSync(fileName, { encoding: 'utf8' }));
}

module.exports = { readJSON };
