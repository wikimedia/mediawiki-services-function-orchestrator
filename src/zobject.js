'use strict';

const { containsError, createSchema, isGenericType } = require( './utils.js' );
const { isUserDefined, makeResultEnvelope } = require( '../function-schemata/javascript/src/utils' );
const { error, normalError } = require( '../function-schemata/javascript/src/error.js' );
const {
	validatesAsFunctionCall,
	validatesAsReference,
	validatesAsArgumentReference,
	validatesAsType
} = require( '../function-schemata/javascript/src/schema.js' );

let mutate = null;

async function resolveFunctionCallsAndReferences(
	nextObject, evaluatorUri, resolver, scope = null, originalObject = null,
	key = null ) {
	if ( ( originalObject === null + key === null ) % 2 !== 0 ) {
		throw new Error( 'originalObject and key must both be null if one is' );
	}
	while ( true ) {
		const argumentReferenceStatus = await validatesAsArgumentReference( nextObject );
		if ( argumentReferenceStatus.isValid() && scope !== null ) {
			const refKey = nextObject.Z18K1.Z6K1;
			const dereferenced = await scope.retrieveArgument( refKey, evaluatorUri, resolver );
			if ( dereferenced.state === 'ERROR' ) {
				return makeResultEnvelope( null, dereferenced.error );
			}
			nextObject = dereferenced.argumentDict.argument;
			continue;
		}
		// TODO (T296686): isUserDefined call here is only an
		// optimization/testing expedient; it would be better to pre-populate
		// the cache with builtin types.
		const referenceStatus = await validatesAsReference( nextObject );
		if ( referenceStatus.isValid() && isUserDefined( nextObject.Z9K1 ) ) {
			const refKey = nextObject.Z9K1;
			const dereferenced = await resolver.dereference( [ refKey ] );
			nextObject = dereferenced[ refKey ].Z2K2;
			if ( originalObject !== null ) {
				originalObject[ key ] = nextObject;
			}
			continue;
		}
		const functionCallStatus = await validatesAsFunctionCall( nextObject );
		if ( functionCallStatus.isValid() ) {
			const { execute } = require( './execute.js' );
			const Z22 = await execute( nextObject, evaluatorUri, resolver, scope );
			if ( containsError( Z22 ) ) {
				return Z22;
			}
			nextObject = Z22.Z22K1;
			if ( originalObject !== null ) {
				originalObject[ key ] = nextObject;
			}
			continue;
		}
		if ( await isGenericType( nextObject ) ) {
			const executionResult = await mutate( nextObject, [ 'Z1K1' ], evaluatorUri, resolver, scope );
			if ( containsError( executionResult ) ) {
				return executionResult;
			}
			const Z4 = executionResult.Z22K1;
			const typeStatus = await validatesAsType( Z4 );
			if ( !typeStatus.isValid() ) {
				// TODO (T2966681): Return typeStatus.getZ5() as part of this result.
				return makeResultEnvelope(
					null,
					normalError(
						[ error.argument_type_mismatch ],
						[ 'Generic type function did not return a Z4: ' + JSON.stringify( Z4 ) ] ) );
			}
			nextObject.Z1K1 = Z4;
			continue;
		}
		break;
	}
	return makeResultEnvelope( nextObject, null );
}

mutate = async function ( zobject, keys, evaluatorUri, resolver, scope = null ) {
	if ( keys.length <= 0 ) {
		return makeResultEnvelope( zobject, null );
	}
	const key = keys.shift();
	const nextObjectEnvelope = await resolveFunctionCallsAndReferences(
		zobject[ key ], evaluatorUri, resolver, scope, zobject, key );

	if ( containsError( nextObjectEnvelope ) ) {
		return nextObjectEnvelope;
	}
	const nextObject = nextObjectEnvelope.Z22K1;

	// Validate that the newly-mutated object validates in accordance with the
	// original object's key declaration.
	const theSchema = await createSchema( zobject );
	// We validate elsewhere that Z1K1 must be a type, so the schemata do not
	// surface separate validators for Z1K1.
	if ( key !== 'Z1K1' ) {
		const subValidator = theSchema.subValidator( key );
		if ( subValidator === undefined ) {
			// Should never happen?
			return makeResultEnvelope(
				null,
				normalError(
					[ error.invalid_key ],
					[ `ZObject does not have the key ${key}` ] ) );
		}
		const theStatus = await subValidator.validateStatus( nextObject );
		if ( !theStatus.isValid() ) {
			// TODO (T302015): Find a way to incorporate information about where this
			// error came from.
			return makeResultEnvelope( null, theStatus.getZ5() );
		}
	}
	return await mutate( nextObject, keys, evaluatorUri, resolver, scope );
};

module.exports = { mutate, resolveFunctionCallsAndReferences };
