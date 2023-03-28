'use strict';

const canonicalize = require( '../function-schemata/javascript/src/canonicalize.js' );
const normalize = require( '../function-schemata/javascript/src/normalize.js' );
const { makeMappedResultEnvelope, setMetadataValue } = require( '../function-schemata/javascript/src/utils.js' );
const { validatesAsFunctionCall } = require( '../function-schemata/javascript/src/schema.js' );
const { error, makeErrorInNormalForm } = require( '../function-schemata/javascript/src/error' );
const ErrorFormatter = require( '../function-schemata/javascript/src/errorFormatter' );
const { validate } = require( './validation.js' );
const { execute } = require( './execute.js' );
const { responseEnvelopeContainsError, isError, makeWrappedResultEnvelope, returnOnFirstError } = require( './utils.js' );
const { Invariants } = require( './Invariants' );
const { ZWrapper } = require( './ZWrapper' );
const ImplementationSelector = require( './implementationSelector.js' );
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
		makeErrorInNormalForm(
			error.wrong_content_type,
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
 * @param {Object} zobject the function call
 * @param {Invariants} invariants encapsulates global orchestrator config and wrappers
 *      for evaluator and Wiki services
 * @param {ImplementationSelector} implementationSelector
 * @param {boolean} returnNormal return normal form if true; canonical form otherwise
 * @return {Object} a Z22 containing the result of function evaluation or a Z5 (in Z22K2/metadata)
 */
async function orchestrate(
	zobject, invariants, implementationSelector = null, returnNormal = false ) {
	const startTime = new Date();
	const startUsage = cpuUsage();
	const logger = getLogger();

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

	const callTuples = [
		[ normalize, [ /* generically= */true, /* withVoid= */ true ], 'normalize' ],
		// TODO (T296685): Dereference top-level object if it is a Z9?
		[ Z7OrError, [], 'Z7OrError' ],
		[ makeWrappedResultEnvelope, [], 'wrapAsZObject' ],
		[ maybeValidate, [ invariants.orchestratorConfig.doValidate, invariants ], 'maybeValidate' ],
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
		logger.error( e );
		const message = `Call tuples failed in returnOnFirstError. Error: ${e}.`;
		logger.error( message );
		// The zobject provides context for a Z507/Evaluation error (and will be quoted there)
		const zerror = ErrorFormatter.wrapMessageInEvaluationError( message, zobject );
		// This currentResponseEnvelope will be JSON, not a ZWrapper.
		// makeMappedResultEnvelope will put zerror into a metadata map.
		currentResponseEnvelope = makeMappedResultEnvelope( null, zerror );
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

	if ( returnNormal ) {
		return currentResponseEnvelope;
	}
	const canonicalized = canonicalize( currentResponseEnvelope, /* withVoid= */ true );

	if ( responseEnvelopeContainsError( canonicalized ) ) {
		// If canonicalization fails, return normalized form instead.
		logger.info( 'Could not canonicalize; outputting in normal form.' );
	} else {
		currentResponseEnvelope = canonicalized.Z22K1;
	}
	return currentResponseEnvelope;
}

module.exports = {
	orchestrate
};
