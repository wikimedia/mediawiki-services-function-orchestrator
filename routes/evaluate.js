'use strict';

const sUtil = require( '../lib/util' );

const orchestrate = require( '../src/orchestrate.js' );
const getTestResults = require( '../src/performTest.js' );

const evaluatorUri = process.env.FUNCTION_EVALUATOR_URL || null;
const wikiUri = process.env.WIKI_API_URL || null;

/**
 * The main router object
 */
const router = sUtil.router();

/** ROUTE DECLARATIONS GO HERE */
router.post( '/', async function ( req, res ) {
	req.body.wikiUri = wikiUri;
	req.body.evaluatorUri = evaluatorUri;

	const input = await orchestrate( req.body );
	res.json( input );
} );

router.get( '/test/:data', async function ( req, res ) {
	// Leaving this 'right' way to do it commented-out rather than dropping it so that
	// we remember to switch to it when updating this pipeline -- JDF 2022-06-02.
	// req.params.data.wikiUri = wikiUri;
	// req.params.data.evaluatorUri = evaluatorUri;

	const result = await getTestResults( req.params.data, wikiUri, evaluatorUri );
	res.json( result );
} );

router.get( '/', function ( req, res ) {
	res.sendStatus( 200 );
} );

module.exports = function ( appObj ) {

	// the returned object mounts the routes on
	// /{domain}/vX/mount/path
	return {
		path: '/evaluate',
		api_version: 1, // must be a number!
		router: router
	};

};
