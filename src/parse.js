'use strict';

const { generateError } = require( './utils' );

// any serialized string as input
// the output is either an error object of error type Z401, or the JSON object parsed
function parse( str ) {
	try {
		const zobject = JSON.parse( str );
		return zobject;
	} catch ( err ) {
		const m = ( err.name === 'SyntaxError' ) ? err.message : err.name;
		return generateError( m );
	}
}

module.exports = parse;
