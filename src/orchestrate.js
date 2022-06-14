'use strict';

const canonicalize = require( '../function-schemata/javascript/src/canonicalize.js' );
const normalize = require( '../function-schemata/javascript/src/normalize.js' );
const { makeMappedResultEnvelope, setMetadataValue, maybeDowngradeResultEnvelope } = require( '../function-schemata/javascript/src/utils.js' );
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
async function Z7OrError( zobject ) {
	if ( ( await validatesAsFunctionCall( zobject ) ).isValid() ) {
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

	let zobject = input.zobject;
	if ( zobject === undefined ) {
		zobject = input;
	}
	let currentPair;

	if ( isError( zobject ) ) {
		currentPair = makeMappedResultEnvelope(
			null, zobject, /* canonicalize= */true
		);
	} else {
		currentPair = makeMappedResultEnvelope(
			zobject, null, /* canonicalize= */true
		);
	}

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
				invariants, /* oldScope= */null, /* doValidate= */true,
				/* implementationSelector= */implementationSelector,
				/* resolveInternals= */true, /* topLevel= */true ],
			'execute'
		]
	];

	currentPair = await returnOnFirstError( currentPair, callTuples );

	if ( currentPair instanceof ZWrapper ) {
		currentPair = currentPair.asJSON();
	}

	const endTime = new Date();
	const duration = endTime.getTime() - startTime.getTime();
	const startTimeStr = startTime.toISOString();
	const endTimeStr = endTime.toISOString();
	const durationStr = duration + 'ms';
	currentPair = setMetadataValue( currentPair, { Z1K1: 'Z6', Z6K1: 'orchestrationStartTime' }, { Z1K1: 'Z6', Z6K1: startTimeStr } );
	currentPair = setMetadataValue( currentPair, { Z1K1: 'Z6', Z6K1: 'orchestrationEndTime' }, { Z1K1: 'Z6', Z6K1: endTimeStr } );
	currentPair = setMetadataValue( currentPair, { Z1K1: 'Z6', Z6K1: 'orchestrationDuration' }, { Z1K1: 'Z6', Z6K1: durationStr } );

	currentPair = maybeDowngradeResultEnvelope( currentPair );

	const canonicalized = await canonicalize( currentPair, /* withVoid= */ true );

	if ( containsError( canonicalized ) ) {
		// If canonicalization fails, return normalized form instead.
		console.log( 'Could not canonicalize; outputting in normal form.' );
	} else {
		currentPair = canonicalized.Z22K1;
	}
	return currentPair;
}

module.exports = orchestrate;
