'use strict';

const error = require('./error.js');

// any serialized string as input
// the output is either an error object of error type Z401, or the JSON object parsed
function parse(str) {
	try {
		const zobject = JSON.parse(str);
		return zobject;
	} catch (err) {
		const m = (err.name === 'SyntaxError') ? err.message : err.name;
		return error([ error.syntax_error ], [ m, str ]);
	}
}

module.exports = parse;
