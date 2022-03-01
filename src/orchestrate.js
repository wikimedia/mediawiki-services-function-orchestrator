'use strict';

const canonicalize = require( '../function-schemata/javascript/src/canonicalize.js' );
const normalize = require( '../function-schemata/javascript/src/normalize.js' );
const { convertArrayToZList, makeResultEnvelope } = require( '../function-schemata/javascript/src/utils.js' );
const { validatesAsFunctionCall } = require( '../function-schemata/javascript/src/schema.js' );
const { error, normalError } = require( '../function-schemata/javascript/src/error' );
const { validate } = require( './validation.js' );
const { execute } = require( './execute.js' );
const { containsError, isError, makeResultEnvelopeAndMaybeCanonicalise, makeWrappedResultEnvelope, returnOnFirstError } = require( './utils.js' );
const { ReferenceResolver } = require( './db.js' );
const { ZWrapper } = require( './zobject.js' );

/**
 * Decides whether to validate a function. Returns the pair
 * <original ZObject, Unit> if validation succeeds; otherwise returns the pair
 * <Unit, Z5>.
 *
 * @param {Object} zobject
 * @param {boolean} doValidate whether to run validation; succeeds trivially if false
 * @param {ReferenceResolver} resolver for resolving Z9s
 * @return {Object} a Z22
 */
async function maybeValidate( zobject, doValidate, resolver ) {
	if ( doValidate ) {
		const errors = (
			await validate( zobject, resolver )
		).map( ( errorWrapper ) => errorWrapper.asJSON() );
		if ( errors.length > 0 ) {
			// TODO (T296681): Wrap errors in a Z5.
			return makeResultEnvelope( null, await convertArrayToZList( errors ) );
		}
	}
	return makeResultEnvelope( zobject, null );
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
		return makeResultEnvelope( zobject, null );
	}
	return makeResultEnvelope(
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
 * @param {string} input the input for a function call
 * @param {ImplementationSelector} implementationSelector
 * @return {Object} a Z22 containing the result of function evaluation or a Z5
 */
async function orchestrate( input, implementationSelector = null ) {

	let zobject = input.zobject;
	if ( zobject === undefined ) {
		zobject = input;
	}
	let currentPair;

	if ( isError( zobject ) ) {
		currentPair = makeResultEnvelopeAndMaybeCanonicalise(
			null, zobject, /* canonicalize= */true
		);
	} else {
		currentPair = makeResultEnvelopeAndMaybeCanonicalise(
			zobject, null, /* canonicalize= */true
		);
	}

	const evaluatorUri = input.evaluatorUri || null;
	const wikiUri = input.wikiUri || null;

	const resolver = new ReferenceResolver( wikiUri );
	const doValidate = typeof input.doValidate === 'boolean' ? input.doValidate : true;

	const callTuples = [
		[ normalize, [ /* generically= */true ], 'normalize' ],
		// TODO (T296685): Dereference top-level object if it is a Z9?
		[ Z7OrError, [], 'Z7OrError' ],
		[ makeWrappedResultEnvelope, [], 'wrapAsZObject' ],
		[ maybeValidate, [ doValidate, resolver ], 'maybeValidate' ],
		[ execute, [ evaluatorUri, resolver, /* oldScope= */null, /* doValidate= */true, /* implementationSelector= */implementationSelector ], 'execute' ]
	];

	currentPair = await returnOnFirstError( currentPair, callTuples );

	if ( currentPair instanceof ZWrapper ) {
		currentPair = currentPair.asJSON();
	}
	const canonicalized = await canonicalize( currentPair );

	if ( containsError( canonicalized ) ) {
		// If canonicalization fails, return normalized form instead.
		console.log( 'Could not canonicalize; outputting in normal form.' );
	} else {
		currentPair = canonicalized.Z22K1;
	}
	return currentPair;
}

module.exports = orchestrate;
