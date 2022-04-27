'use strict';

const { EmptyFrame } = require( './frame.js' );
const { ZWrapper } = require( './ZWrapper.js' );
const { containsError, createSchema, isGenericType, makeWrappedResultEnvelope } = require( './utils.js' );
const { isUserDefined } = require( '../function-schemata/javascript/src/utils' );
const { error, normalError } = require( '../function-schemata/javascript/src/error.js' );
const {
	validatesAsFunctionCall,
	validatesAsReference,
	validatesAsArgumentReference,
	validatesAsType
} = require( '../function-schemata/javascript/src/schema.js' );

let mutate = null;

const MutationType = Object.freeze( {
	REFERENCE: Symbol( 'REFERENCE' ),
	ARGUMENT_REFERENCE: Symbol( 'ARGUMENT_REFERENCE' ),
	FUNCTION_CALL: Symbol( 'FUNCTION_CALL' ),
	GENERIC_INSTANCE: Symbol( 'GENERIC_INSTANCE' )
} );

async function resolveFunctionCallsAndReferencesInternal(
	nextObject, evaluatorUri, resolver, scope, originalObject, key, ignoreList,
	resolveInternals, doValidate ) {
	if ( ignoreList === null ) {
		ignoreList = new Set();
	}
	if ( ( originalObject === null + key === null ) % 2 !== 0 ) {
		throw new Error( 'originalObject and key must both be null if one is' );
	}
	while ( true ) {
		let nextJSON = nextObject;
		if ( nextJSON instanceof ZWrapper ) {
			nextJSON = nextJSON.asJSON();
		}
		if ( !ignoreList.has( MutationType.ARGUMENT_REFERENCE ) ) {
			const argumentReferenceStatus = await validatesAsArgumentReference( nextJSON );
			if ( argumentReferenceStatus.isValid() && scope !== null ) {
				const refKey = nextObject.Z18K1.Z6K1;
				const dereferenced = await scope.retrieveArgument( refKey, evaluatorUri,
					resolver, /* lazily= */ false, doValidate, resolveInternals, ignoreList );
				if ( dereferenced.state === 'ERROR' ) {
					return makeWrappedResultEnvelope( null, dereferenced.error );
				}
				nextObject = dereferenced.argumentDict.argument;
				continue;
			}
		}
		if ( !ignoreList.has( MutationType.REFERENCE ) ) {
			const referenceStatus = await validatesAsReference( nextJSON );
			// TODO (T296686): isUserDefined call here is only an
			// optimization/testing expedient; it would be better to pre-populate
			// the cache with builtin types.
			if ( referenceStatus.isValid() && isUserDefined( nextObject.Z9K1 ) ) {
				const refKey = nextObject.Z9K1;
				const dereferenced = await resolver.dereference( [ refKey ] );
				nextObject = dereferenced[ refKey ].Z2K2;
				if ( originalObject !== null ) {
					originalObject[ key ] = nextObject;
				}
				continue;
			}
		}
		if ( !ignoreList.has( MutationType.FUNCTION_CALL ) ) {
			const functionCallStatus = await validatesAsFunctionCall( nextJSON );
			if ( functionCallStatus.isValid() ) {
				const { execute } = require( './execute.js' );
				const Z22 = await execute(
					nextObject, evaluatorUri, resolver, scope, doValidate,
					/* implementationSelector= */ null, resolveInternals );
				if ( containsError( Z22 ) ) {
					return Z22;
				}
				nextObject = Z22.Z22K1;
				if ( originalObject !== null ) {
					originalObject[ key ] = nextObject;
				}
				continue;
			}
		}
		if ( await isGenericType( nextObject ) ) {
			const executionResult = await mutate( nextObject, [ 'Z1K1' ], evaluatorUri, resolver, scope, ignoreList, resolveInternals, doValidate );
			if ( containsError( executionResult ) ) {
				return executionResult;
			}
			const Z4 = executionResult.Z22K1;
			const typeStatus = await validatesAsType( Z4.asJSON() );
			if ( !typeStatus.isValid() ) {
				// TODO (T2966681): Return typeStatus.getZ5() as part of this result.
				return makeWrappedResultEnvelope(
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
	return makeWrappedResultEnvelope( nextObject, null );
}

async function resolveFunctionCallsAndReferences(
	nextObject, evaluatorUri, resolver, scope = null, originalObject = null,
	key = null, ignoreList = null, resolveInternals = true, doValidate = true ) {
	let innerScope = null;
	if ( nextObject instanceof ZWrapper ) {
		innerScope = nextObject.getScope();
	}
	if ( innerScope === null ) {
		innerScope = new EmptyFrame();
	}
	if ( scope === null ) {
		scope = new EmptyFrame();
	}
	scope = innerScope.mergedCopy( scope );
	return await resolveFunctionCallsAndReferencesInternal(
		nextObject, evaluatorUri, resolver, scope, originalObject,
		key, ignoreList, resolveInternals, doValidate );
}

mutate = async function (
	zobject, keys, evaluatorUri, resolver, scope = null, ignoreList = null,
	resolveInternals = true, doValidate = true ) {
	if ( ignoreList === null ) {
		ignoreList = new Set();
	}
	if ( keys.length <= 0 ) {
		return makeWrappedResultEnvelope( zobject, null );
	}
	const key = keys.shift();
	const nextObjectEnvelope = await resolveFunctionCallsAndReferences( zobject[ key ],
		evaluatorUri, resolver, scope, zobject, key, ignoreList, resolveInternals, doValidate );

	if ( containsError( nextObjectEnvelope ) ) {
		return nextObjectEnvelope;
	}
	const nextObject = nextObjectEnvelope.Z22K1;

	if ( resolveInternals ) {
		// Validate that the newly-mutated object validates in accordance with the
		// original object's key declaration.
		const theSchema = await createSchema( zobject.asJSON() );
		// We validate elsewhere that Z1K1 must be a type, so the schemata do not
		// surface separate validators for Z1K1.
		if ( key !== 'Z1K1' ) {
			const subValidator = theSchema.subValidator( key );
			if ( subValidator === undefined ) {
				// Should never happen?
				return makeWrappedResultEnvelope(
					null,
					normalError(
						[ error.invalid_key ],
						[ `ZObject does not have the key ${key}` ] ) );
			}

			let toValidate;
			if ( nextObject instanceof ZWrapper ) {
				toValidate = nextObject.asJSON();
			} else {
				toValidate = nextObject;
			}
			const theStatus = await subValidator.validateStatus( toValidate );

			if ( !theStatus.isValid() ) {
				// TODO (T302015): Find a way to incorporate information about where this
				// error came from.
				return makeWrappedResultEnvelope( null, theStatus.getZ5() );
			}
		}
	}
	return await mutate(
		nextObject, keys, evaluatorUri, resolver, scope, ignoreList, resolveInternals, doValidate );
};
module.exports = { mutate, resolveFunctionCallsAndReferences, MutationType };
