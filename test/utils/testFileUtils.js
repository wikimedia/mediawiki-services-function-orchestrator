'use strict';

const fs = require( 'fs' );
const path = require( 'path' );

const { readJSON } = require( '../../src/fileUtils.js' );

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
		'features', 'v1', 'test_data', ...pathComponents );
}

function schemataDefinitionsDir( ...pathComponents ) {
	return path.join(
		path.dirname( path.dirname( path.dirname( __filename ) ) ),
		'function-schemata', 'data', 'definitions', ...pathComponents );
}

function writeJSON( object, fileName ) {
	fs.writeFile( fileName, JSON.stringify( object, null, '\t' ) + '\n', () => {} );
}

module.exports = { readZObjectsFromDirectory, testDataDir, schemataDefinitionsDir, writeJSON };
