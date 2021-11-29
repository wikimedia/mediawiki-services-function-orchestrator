'use strict';

const canonicalize = require( '../function-schemata/javascript/src/canonicalize.js' );
const normalize = require( '../function-schemata/javascript/src/normalize.js' );
const { arrayToZ10, makeResultEnvelope } = require( '../function-schemata/javascript/src/utils.js' );
const { error, normalError } = require( '../function-schemata/javascript/src/error' );
const { validate } = require( './validation.js' );
const { execute } = require( './execute.js' );
const { containsError, isError, isFunctionCall, isNothing, makePair } = require( './utils.js' );
const { ReferenceResolver } = require( './db.js' );

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
		const errors = await validate( zobject, resolver );
		if ( errors.length > 0 ) {
			// TODO(T296681): Wrap errors in a Z5.
			return makeResultEnvelope( null, arrayToZ10( errors ) );
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
	if ( isFunctionCall( zobject ) ) {
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
 * @param {string} input the input for a function call
 * @return {Object} a Z22 containing the result of function evaluation or a Z5
 */
async function orchestrate( input ) {

	let zobject = input.zobject;
	if ( zobject === undefined ) {
		zobject = input;
	}

	let currentPair;

	if ( isError( zobject ) ) {
		currentPair = makePair( null, zobject, /* canonicalize= */true );
	} else {
		currentPair = makePair( zobject, null, /* canonicalize= */true );
	}

	// TODO(T286752): Receiving the evaluator and wiki URIs as parameters
	// (especially a GET param!) is no good. Find a way to share config among
	// services.
	const evaluatorUri = input.evaluatorUri || null;
	const wikiUri = input.wikiUri || null;
	const resolver = new ReferenceResolver( wikiUri );
	const doValidate = typeof input.doValidate === 'boolean' ? input.doValidate : true;

	const callTuples = [
		[ normalize, [], 'normalize' ],
		// TODO(T296685): Dereference top-level object if it is a Z9?
		[ Z7OrError, [], 'Z7OrError' ],
		[ maybeValidate, [ doValidate, resolver ], 'maybeValidate' ],
		[ execute, [ evaluatorUri, resolver ], 'execute' ]
	];

	for ( const callTuple of callTuples ) {
		// TODO(T287986): isNothing check is redundant once validation returns
		// correct type.
		if ( containsError( currentPair ) || isNothing( currentPair.Z22K1 ) ) {
			break;
		}
		console.log( 'calling function', callTuple[ 2 ], 'on currentPair:', currentPair );
		const callable = callTuple[ 0 ];
		const args = callTuple[ 1 ];
		const zobject = currentPair.Z22K1;
		currentPair = await callable( ...[ zobject, ...args ] );
	}

	const canonicalized = canonicalize( currentPair );

	if ( containsError( canonicalized ) ) {
		// If canonicalization fails, return normalized form instead.
		console.log( 'Could not canonicalize; outputting in normal form.' );
		return currentPair;
	} else {
		return canonicalized.Z22K1;
	}
}

module.exports = orchestrate;
