'use strict';

const sUtil = require( '../lib/util' );

const { ReferenceResolver } = require( '../src/db.js' );
const { Evaluator } = require( '../src/Evaluator.js' );
const { Invariants } = require( '../src/Invariants.js' );
const { getLogger } = require( '../src/logger.js' );
const { orchestrate } = require( '../src/orchestrate.js' );
const { makeWrappedResultEnvelope } = require( '../src/utils.js' );
const { ZWrapper } = require( '../src/ZWrapper.js' );

const evaluatorWs = process.env.FUNCTION_EVALUATOR_WS || null;
const evaluatorUri = process.env.FUNCTION_EVALUATOR_URL || null;
const wikiUri = process.env.WIKI_API_URL || null;
const allConfig = JSON.parse( process.env.ORCHESTRATOR_CONFIG || '{}' );

/**
 * The main router object
 */
const router = sUtil.router();

async function propagateResult( req, res, result, logger ) {
	if ( res.writableEnded ) {
		return;
	}

	// result should be bare JSON (never a ZWrapper), so convert to JSON and log
	// an error if it is a ZWrapper.
	if ( result instanceof ZWrapper ) {
		logger.error(
			'trace/req', {
				msg: 'propagateResult has erroneously received a ZWrapper',
				response: result,
				// We repeat the incoming request ID so we can match up load
				'x-request-id': req.context.reqId
			} );
		result = result.asJSON();
	}
	logger.log(
		'trace/req', {
			msg: 'Outgoing response',
			response: result,
			// We repeat the incoming request ID so we can match up load
			'x-request-id': req.context.reqId
		} );
	res.json( result );
}

/** ROUTE DECLARATIONS GO HERE */
router.post( '/', async function ( req, res ) {

	const logger = getLogger();
	const timer = setTimeout(
		async function () {
			await propagateResult(
				req,
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
				logger
			);
		},
		// TODO (T323049): Parameterize this.
		20000
	);

	function getRemainingTime() {
		return timer._idleStart + timer._idleTimeout - Date.now();
	}

	const ZObject = req.body.zobject;
	const useReentrance = req.body.useReentrance || false;

	let evaluatorConfigs = allConfig.evaluatorConfigs;
	if ( evaluatorConfigs === undefined ) {
		// Legacy request: request does not supply evaluatorConfigs.
		evaluatorConfigs = [];
		evaluatorConfigs.push(
			{
				programmingLanguages: [
					'javascript-es2020', 'javascript-es2019', 'javascript-es2018',
					'javascript-es2017', 'javascript-es2016', 'javascript-es2015',
					'javascript' ],
				evaluatorUri: evaluatorUri,
				evaluatorWs: evaluatorWs,
				useReentrance: useReentrance } );
		evaluatorConfigs.push(
			{
				programmingLanguages: [
					'python-3-9', 'python-3-8', 'python-3-7', 'python-3',
					'python' ],
				evaluatorUri: evaluatorUri,
				evaluatorWs: evaluatorWs,
				useReentrance: useReentrance } );
	}

	// Capture all stray config.
	const orchestratorConfig = {
		doValidate: req.body.doValidate || false
	};

	// Initialize invariants.
	const resolver = new ReferenceResolver( wikiUri );
	const evaluators = evaluatorConfigs.map(
		( evaluatorConfig ) => new Evaluator( evaluatorConfig ) );
	const invariants = new Invariants( resolver, evaluators, orchestratorConfig, getRemainingTime );

	// Orchestrate!
	const response = await orchestrate( ZObject, invariants );
	clearTimeout( timer );
	await propagateResult( req, res, response, logger );
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
