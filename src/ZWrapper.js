'use strict';

const { containsError, createSchema, isGenericType, makeWrappedResultEnvelope } = require( './utils.js' );
const { error, normalError } = require( '../function-schemata/javascript/src/error.js' );
const { isString, isUserDefined } = require( '../function-schemata/javascript/src/utils' );
const {
	validatesAsFunctionCall,
	validatesAsReference,
	validatesAsArgumentReference,
	validatesAsType
} = require( '../function-schemata/javascript/src/schema.js' );

const MutationType = Object.freeze( {
	REFERENCE: Symbol( 'REFERENCE' ),
	ARGUMENT_REFERENCE: Symbol( 'ARGUMENT_REFERENCE' ),
	FUNCTION_CALL: Symbol( 'FUNCTION_CALL' ),
	GENERIC_INSTANCE: Symbol( 'GENERIC_INSTANCE' )
} );

/**
 * Wrapper around ZObjects that should be used instead of bare ZObjects during evaluation.
 *
 * The wrapper keeps track of the scope under which the object should be evaluated, and caches
 * the results of resolving subobjects for future use.
 */
class ZWrapper {

	// Private. Use {@link ZWrapper#create} instead.
	constructor() {
		// Each value in original_ (and eventually in resolved_) points to another ZWrapper
		// representing the corresponding subobject with its own scope. Initially they all point
		// to the same scope, but they diverge as subobjects get resolved.
		this.original_ = new Map();
		this.resolved_ = new Map();
		this.keys_ = new Set();
		this.scope_ = null;
	}

	// Creates an equivalent ZWrapper representation for the given ZObject and its subobjects.
	// The resulting ZWrapper has the same fields as the ZObject, each of which is itself a
	// ZWrapper, and so on.
	static create( zobjectJSON, scope ) {
		if ( scope === null ) {
			throw new Error( 'Missing scope argument' );
		}
		if ( isString( zobjectJSON ) || zobjectJSON instanceof ZWrapper ) {
			return zobjectJSON;
		}
		const result = new ZWrapper();
		result.scope_ = scope;
		for ( const key of Object.keys( zobjectJSON ) ) {
			const value = ZWrapper.create( zobjectJSON[ key ], scope );
			result.original_.set( key, value );
			result.keys_.add( key );
			Object.defineProperty( result, key, {
				get: function () {
					return this.getName( key );

				}
			} );
		}
		return result;
	}

	getName( key ) {
		if ( this.resolved_.has( key ) ) {
			return this.resolved_.get( key );
		}
		return this.original_.get( key );
	}

	setName( key, value ) {
		this.resolved_.set( key, value );
	}

	// private
	async resolveInternal_( invariants, ignoreList, resolveInternals, doValidate ) {
		if ( ignoreList === null ) {
			ignoreList = new Set();
		}
		let nextObject = this;
		while ( true ) {
			let nextJSON = nextObject;
			if ( nextJSON instanceof ZWrapper ) {
				nextJSON = nextJSON.asJSON();
			}
			if ( !ignoreList.has( MutationType.ARGUMENT_REFERENCE ) ) {
				const argumentReferenceStatus = await validatesAsArgumentReference( nextJSON );
				if ( argumentReferenceStatus.isValid() ) {
					const refKey = nextObject.Z18K1.Z6K1;
					const dereferenced = await this.scope_.retrieveArgument(
						refKey, invariants, /* lazily= */ false, doValidate,
						resolveInternals, ignoreList );
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
					const dereferenced = await invariants.resolver.dereference( [ refKey ] );
					nextObject = dereferenced[ refKey ].Z2K2;
					continue;
				}
			}
			if ( !ignoreList.has( MutationType.FUNCTION_CALL ) ) {
				const functionCallStatus = await validatesAsFunctionCall( nextJSON );
				if ( functionCallStatus.isValid() ) {
					const { execute } = require( './execute.js' );
					const Z22 = await execute(
						nextObject, invariants, doValidate,
						/* implementationSelector= */ null, resolveInternals );
					if ( containsError( Z22 ) ) {
						return Z22;
					}
					nextObject = Z22.Z22K1;
					continue;
				}
			}
			if ( await isGenericType( nextObject ) ) {
				const executionResult = await nextObject.resolveKey( [ 'Z1K1' ], invariants, ignoreList, resolveInternals, doValidate );
				if ( containsError( executionResult ) ) {
					return executionResult;
				}
				const Z4 = nextObject.Z1K1;
				const typeStatus = await validatesAsType( Z4.asJSON() );
				if ( !typeStatus.isValid() ) {
					// TODO (T2966681): Return typeStatus.getZ5() as part of this result.
					return makeWrappedResultEnvelope(
						null,
						normalError(
							[ error.argument_type_mismatch ],
							[ 'Generic type function did not return a Z4: ' + JSON.stringify( Z4.asJSON() ) ] ) );
				}
				continue;
			}
			break;
		}
		return makeWrappedResultEnvelope( nextObject, null );
	}

	// private
	async resolveKeyInternal_(
		key, invariants, ignoreList, resolveInternals, doValidate ) {
		let newValue, resultPair;
		const currentValue = this.getName( key );
		if ( currentValue instanceof ZWrapper ) {
			resultPair = await ( currentValue.resolveInternal_(
				invariants, ignoreList, resolveInternals, doValidate ) );
			if ( containsError( resultPair ) ) {
				return resultPair;
			}
			newValue = resultPair.Z22K1;
		} else {
			resolveInternals = false;
			resultPair = makeWrappedResultEnvelope( this, null );
			newValue = currentValue;
		}
		if ( resolveInternals ) {
			// Validate that the newly-mutated object validates in accordance with the
			// original object's key declaration.
			const theSchema = await createSchema( this.asJSON() );
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
				if ( newValue instanceof ZWrapper ) {
					toValidate = newValue.asJSON();
				} else {
					toValidate = newValue;
				}
				const theStatus = await subValidator.validateStatus( toValidate );
				if ( !theStatus.isValid() ) {
					// TODO (T302015): Find a way to incorporate information about where this
					// error came from.
					return makeWrappedResultEnvelope( null, theStatus.getZ5() );
				}
			}
		}
		this.setName( key, newValue );
		return resultPair;
	}

	/**
	 * Repeatedly evaluates the top-level object according to its evaluation rules.
	 *
	 * The returned object does not have any evaluation rule that applies to it (i.e. it is not a
	 * reference, argument reference, function call, etc.) but the same is not true for its
	 * subobjects; they should be resolved separately. Moreover, it is wrapped in a result envelope
	 * to indicate any errors.
	 *
	 * @param {Invariants} invariants
	 * @param {Set(MutationType)} ignoreList
	 * @param {boolean} resolveInternals
	 * @param {boolean} doValidate
	 * @return {ZWrapper} A result envelope zobject representing the result.
	 */
	async resolve(
		invariants, ignoreList = null, resolveInternals = true, doValidate = true
	) {
		// TODO: Remove this intermediate call?
		return this.resolveInternal_(
			invariants, ignoreList, resolveInternals, doValidate );
	}

	/**
	 * Recursively traverses and resolves the current object along the given keys, caching the
	 * results for future calls.
	 *
	 * The returned object does not have any evaluation rule that applies to it (i.e. it is not a
	 * reference, argument reference, function call, etc.) but the same is not true for its
	 * subobjects; they should be resolved separately. Moreover, it is wrapped in a result envelope
	 * to indicate any errors.
	 *
	 * @param {Array(string)} keys Path of subobjects to resolve
	 * @param {Invariants} invariants
	 * @param {Set(MutationType)} ignoreList
	 * @param {booleanl} resolveInternals
	 * @param {boolean} doValidate
	 * @return {ZWrapper} A result envelope zobject representing the result.
	 */
	async resolveKey(
		keys, invariants, ignoreList = null,
		resolveInternals = true, doValidate = true ) {
		let result;
		if ( keys.length <= 0 ) {
			return makeWrappedResultEnvelope( this, null );
		}
		const key = keys.shift();
		if ( !( this.keys_.has( key ) ) ) {
			// TODO (T309809): Return an error in this case.
			return makeWrappedResultEnvelope( this, null );
		}
		if ( !this.resolved_.has( key ) ) {
			result = await this.resolveKeyInternal_(
				key, invariants, ignoreList, resolveInternals, doValidate );
			if ( containsError( result ) ) {
				return result;
			}
		}
		const nextValue = this.getName( key );
		if ( nextValue instanceof ZWrapper ) {
			result = await (
				nextValue.resolveKey(
					keys, invariants, ignoreList, resolveInternals, doValidate )
			);
		}
		return result;
	}

	// Returns the JSON representation of the zobject.
	// WARNING: The resulting object loses all information in the attached scopes and may therefore
	// have unbound argument references. In particular, if subobjects have already been resolved
	// with `resolveKey()`, their scope might have diverged. This means that `zwrapper.asJSON()` may
	// have argument references that are not captured even in `zwrapper.getScope()`. Using this
	// method should hence only be used judiciously where such effects can be taken into account.
	// You have been warned.
	asJSON() {
		const result = {};
		for ( const key of this.keys() ) {
			let value = this.getName( key );
			if ( value instanceof ZWrapper ) {
				value = value.asJSON();
			}
			result[ key ] = value;
		}
		return result;
	}

	keys() {
		return this.keys_.values();
	}

	getScope() {
		return this.scope_;
	}

	setScope( scope ) {
		this.scope_ = scope;
	}

}

module.exports = { MutationType, ZWrapper };
