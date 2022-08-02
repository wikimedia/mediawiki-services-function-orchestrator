'use strict';

const fs = require( 'fs' );
const path = require( 'path' );

function readJSON( fileName ) {
	return JSON.parse( fs.readFileSync( fileName, { encoding: 'utf8' } ) );
}

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
