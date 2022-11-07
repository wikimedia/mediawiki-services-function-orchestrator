'use strict';

const sUtil = require( '../lib/util' );

const orchestrate = require( '../src/orchestrate.js' );

const { getLogger } = require( '../src/logger.js' );

const evaluatorWs = process.env.FUNCTION_EVALUATOR_WS || null;
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
	req.body.evaluatorWs = evaluatorWs;

	const response = await orchestrate( req.body );
	const logger = getLogger();
	logger.log(
		'trace/req', {
			msg: 'Outgoing response',
			response: response,
			// We repeat the incoming request ID so we can match up load
			'x-request-id': req.context.reqId
		} );
	res.json( response );
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
