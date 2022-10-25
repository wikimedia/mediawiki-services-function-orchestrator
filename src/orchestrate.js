'use strict';

const canonicalize = require( '../function-schemata/javascript/src/canonicalize.js' );
const normalize = require( '../function-schemata/javascript/src/normalize.js' );
const { makeMappedResultEnvelope, setMetadataValue } = require( '../function-schemata/javascript/src/utils.js' );
const { validatesAsFunctionCall } = require( '../function-schemata/javascript/src/schema.js' );
const { error, normalError } = require( '../function-schemata/javascript/src/error' );
const ErrorFormatter = require( '../function-schemata/javascript/src/errorFormatter' );
const { validate } = require( './validation.js' );
const { execute } = require( './execute.js' );
const { containsError, isError, makeWrappedResultEnvelope, returnOnFirstError } = require( './utils.js' );
const { Evaluator } = require( './Evaluator.js' );
const { Invariants } = require( './Invariants.js' );
const { ReferenceResolver } = require( './db.js' );
const { ZWrapper } = require( './ZWrapper' );
const { cpuUsage, memoryUsage } = require( 'node:process' );
const { getLogger } = require( './logger.js' );
const os = require( 'os' );

/**
 * Decides whether to validate a function. Returns the pair
 * <original ZObject, Unit> if validation succeeds; otherwise returns the pair
 * <Unit, Z5>.
 *
 * @param {Object} zobject
 * @param {boolean} doValidate whether to run validation; succeeds trivially if false
 * @param {Invariants} invariants for resolving Z9s
 * @return {Object} a Z22
 */
async function maybeValidate( zobject, doValidate, invariants ) {
	if ( doValidate ) {
		const errors = (
			await validate( zobject, invariants )
		).map( ( errorWrapper ) => errorWrapper.asJSON() );

		if ( errors.length > 0 ) {
			return makeMappedResultEnvelope(
				null,
				errors.length === 1 ?
					errors[ 0 ] :
					ErrorFormatter.createZErrorList( errors )
			);
		}
	}
	return makeMappedResultEnvelope( zobject, null );
}

/**
 * Returns the pair <original ZObject, Unit> if the input object is a Z7;
 * otherwise returns the pair <Unit, Z5>.
 *
 * @param {Object} zobject
 * @return {Object} a Z22 as described above
 */
function Z7OrError( zobject ) {
	if ( validatesAsFunctionCall( zobject ).isValid() ) {
		return makeMappedResultEnvelope( zobject, null );
	}
	return makeMappedResultEnvelope(
		null,
		normalError(
			[ error.wrong_content_type ],
			[ 'The provided object is not a function call' ]
		)
	);
}

/**
 * Main orchestration workflow. Executes an input Z7 and returns either the
 * results of function evaluation or the relevant error(s).
 *
 * Takes and returns JSON representation; not ZWrapper.
 *
 * @param {Object} input the input for a function call
 * @param {ImplementationSelector} implementationSelector
 * @return {Object} a Z22 containing the result of function evaluation or a Z5
 */
async function orchestrate( input, implementationSelector = null ) {
	const startTime = new Date();
	const startUsage = cpuUsage();
	const logger = getLogger();

	let zobject = input.zobject;
	if ( zobject === undefined ) {
		zobject = input;
	}
	let currentResponseEnvelope;

	if ( isError( zobject ) ) {
		currentResponseEnvelope = makeMappedResultEnvelope(
			null, zobject, /* canonicalize= */true
		);
	} else {
		currentResponseEnvelope = makeMappedResultEnvelope(
			zobject, null, /* canonicalize= */true
		);
	}

	logger.info( 'Z7K1 is: ' + JSON.stringify( zobject.Z7K1 ) );

	const evaluator = new Evaluator( input.evaluatorUri || null );
	const resolver = new ReferenceResolver( input.wikiUri || null );
	const invariants = new Invariants( evaluator, resolver );

	const doValidate = typeof input.doValidate === 'boolean' ? input.doValidate : true;

	const callTuples = [
		[ normalize, [ /* generically= */true, /* withVoid= */ true ], 'normalize' ],
		// TODO (T296685): Dereference top-level object if it is a Z9?
		[ Z7OrError, [], 'Z7OrError' ],
		[ makeWrappedResultEnvelope, [], 'wrapAsZObject' ],
		[ maybeValidate, [ doValidate, invariants ], 'maybeValidate' ],
		[
			execute, [
				invariants, /* doValidate= */true,
				/* implementationSelector= */implementationSelector,
				/* resolveInternals= */true, /* topLevel= */true ],
			'execute'
		]
	];

	try {
		currentResponseEnvelope = await returnOnFirstError( currentResponseEnvelope, callTuples );
	} catch ( e ) {
		logger.error( `Call tuples failed in returnOnFirstError. Error: ${e}.` );
	}

	if ( currentResponseEnvelope instanceof ZWrapper ) {
		currentResponseEnvelope = currentResponseEnvelope.asJSON();
	}

	const cpuUsageStats = cpuUsage( startUsage );
	const cpuUsageStr = ( ( cpuUsageStats.user + cpuUsageStats.system ) / 1000 ) + ' ms';
	const memoryUsageStr = Math.round( memoryUsage.rss() / 1024 / 1024 * 100 ) / 100 + ' MiB';
	const endTime = new Date();
	const startTimeStr = startTime.toISOString();
	const endTimeStr = endTime.toISOString();
	const durationStr = ( endTime.getTime() - startTime.getTime() ) + ' ms';
	const hostname = os.hostname();

	// Note: Keep this block in sync with the 'standardMetaData' list in mswOrchestrateTest
	currentResponseEnvelope = setMetadataValue( currentResponseEnvelope, { Z1K1: 'Z6', Z6K1: 'orchestrationMemoryUsage' }, { Z1K1: 'Z6', Z6K1: memoryUsageStr } );
	currentResponseEnvelope = setMetadataValue( currentResponseEnvelope, { Z1K1: 'Z6', Z6K1: 'orchestrationCpuUsage' }, { Z1K1: 'Z6', Z6K1: cpuUsageStr } );
	currentResponseEnvelope = setMetadataValue( currentResponseEnvelope, { Z1K1: 'Z6', Z6K1: 'orchestrationStartTime' }, { Z1K1: 'Z6', Z6K1: startTimeStr } );
	currentResponseEnvelope = setMetadataValue( currentResponseEnvelope, { Z1K1: 'Z6', Z6K1: 'orchestrationEndTime' }, { Z1K1: 'Z6', Z6K1: endTimeStr } );
	currentResponseEnvelope = setMetadataValue( currentResponseEnvelope, { Z1K1: 'Z6', Z6K1: 'orchestrationDuration' }, { Z1K1: 'Z6', Z6K1: durationStr } );
	currentResponseEnvelope = setMetadataValue( currentResponseEnvelope, { Z1K1: 'Z6', Z6K1: 'orchestrationHostname' }, { Z1K1: 'Z6', Z6K1: hostname } );

	const canonicalized = canonicalize( currentResponseEnvelope, /* withVoid= */ true );

	if ( containsError( canonicalized ) ) {
		// If canonicalization fails, return normalized form instead.
		logger.info( 'Could not canonicalize; outputting in normal form.' );
	} else {
		currentResponseEnvelope = canonicalized.Z22K1;
	}
	return currentResponseEnvelope;
}

module.exports = orchestrate;
