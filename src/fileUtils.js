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

function testDataDir( ...pathComponents ) {
	return path.join(
		path.dirname( path.dirname( __filename ) ),
		'test', 'features', 'v1', 'test_data', ...pathComponents );
}

function writeJSON( object, fileName ) {
	fs.writeFile( fileName, JSON.stringify( object, null, 4 ), ( err ) => {} );
}

module.exports = { readJSON, readZObjectsFromDirectory, testDataDir, writeJSON };
