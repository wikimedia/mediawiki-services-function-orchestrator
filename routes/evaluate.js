'use strict';

const sUtil = require( '../lib/util' );

const orchestrate = require( '../src/orchestrate.js' );

const { getLogger } = require( '../src/logger.js' );
const { makeWrappedResultEnvelope } = require( '../src/utils.js' );

const evaluatorWs = process.env.FUNCTION_EVALUATOR_WS || null;
const evaluatorUri = process.env.FUNCTION_EVALUATOR_URL || null;
const wikiUri = process.env.WIKI_API_URL || null;

/**
 * The main router object
 */
const router = sUtil.router();

async function propagateResult( res, result, logger ) {
	logger( result );
	res.json( result );
}

/** ROUTE DECLARATIONS GO HERE */
router.post( '/', async function ( req, res ) {
	req.body.wikiUri = wikiUri;
	req.body.evaluatorUri = evaluatorUri;
	req.body.evaluatorWs = evaluatorWs;

	const logger = getLogger();
	const logFn = function ( response ) {
		logger.log(
			'trace/req', {
				msg: 'Outgoing response',
				response: response,
				// We repeat the incoming request ID so we can match up load
				'x-request-id': req.context.reqId
			} );
	};
	setTimeout(
		async function () {
			await propagateResult(
				res,
				makeWrappedResultEnvelope(
					null,
					{
						Z1K1: {
							Z1K1: 'Z9',
							Z9K1: 'Z5'
						},
						// TODO (T327275): Figure out what error this should actually be.
						Z5K1: {
							Z1K1: 'Z9',
							Z9K1: 'Z558'
						},
						Z5K2: {
							Z1K1: 'Z6',
							Z6K1: 'Function call timed out'
						}
					}
				).asJSON(),
				logFn
			);
		},
		// TODO (T323049): Parameterize this.
		20000
	);

	const response = await orchestrate( req.body );
	await propagateResult( res, response, logFn );
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
