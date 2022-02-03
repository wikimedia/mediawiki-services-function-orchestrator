'use strict';

const { containsError, isGenericType } = require( './utils.js' );
const { isUserDefined, makeResultEnvelope } = require( '../function-schemata/javascript/src/utils' );
const { error, normalError } = require( '../function-schemata/javascript/src/error.js' );
const {
	validatesAsFunctionCall,
	validatesAsReference,
	validatesAsArgumentReference,
	validatesAsType
} = require( '../function-schemata/javascript/src/schema.js' );

async function mutate( zobject, keys, evaluatorUri, resolver, scope = null ) {
	const { execute } = require( './execute.js' );
	if ( keys.length <= 0 ) {
		return makeResultEnvelope( zobject, null );
	}
	const key = keys.shift();
	let nextObject = zobject[ key ];
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
			zobject[ key ] = nextObject;
			continue;
		}
		const functionCallStatus = await validatesAsFunctionCall( nextObject );
		if ( functionCallStatus.isValid() ) {
			const Z22 = await execute( nextObject, evaluatorUri, resolver, scope );
			if ( containsError( Z22 ) ) {
				return Z22;
			}
			nextObject = Z22.Z22K1;
			zobject[ key ] = nextObject;
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
	return await mutate( nextObject, keys, evaluatorUri, resolver, scope );
}

module.exports = { mutate };
