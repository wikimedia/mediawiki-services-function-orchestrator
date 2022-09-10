'use strict';

const fs = require( 'fs' );
const path = require( 'path' );

function readJSON( fileName ) {
	return JSON.parse( fs.readFileSync( fileName, { encoding: 'utf8' } ) );
}

/**
 * @param {string} directory The file directory that contains many ZObject json files.
 * @return {*} A map of ZObject name to JSON objects from a file directory.
 */
function readZObjectsFromDirectory( directory ) {
	const fileNameFilter = ( f ) => f.startsWith( 'Z' );
	const paths = fs.readdirSync( directory ).filter( fileNameFilter );

	const result = {};
	for ( const p of paths ) {
		result[ path.basename( p, '.json' ) ] = readJSON( path.join( directory, p ) );
	}

	return result;
}

module.exports = { readJSON, readZObjectsFromDirectory };
