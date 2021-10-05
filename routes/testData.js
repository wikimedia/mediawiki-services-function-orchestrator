'use strict';

const fs = require( 'fs' );
const sUtil = require( '../lib/util' );

/**
 * The main router object
 */
const router = sUtil.router();

/**
 * GET /test-data/:fileName
 * Retrieves test data JSON file as a string.
 */
router.get( '/test-data/:fileName', function ( req, res ) {
	const jsonFile = `${__dirname}/../test/features/v1/test_data/${req.params.fileName}.json`;
	if ( !fs.existsSync( jsonFile ) ) {
		res.status( 404 ).end( `No file named ${req.params.fileName} exists.` );
		return;
	}
	const contents = fs.readFileSync( jsonFile, { encoding: 'utf8' } );
	const result = { value: JSON.stringify( JSON.parse( contents ) ) };
	res.json( result );
} );

module.exports = ( appObj ) => {

	return {
		path: '/',
		skip_domain: true,
		router
	};

};
