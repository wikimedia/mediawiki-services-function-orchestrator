'use strict';

const { responseEnvelopeContainsError, createSchema, isGenericType, makeWrappedResultEnvelope } = require( './utils.js' );
const { error, makeErrorInNormalForm } = require( '../function-schemata/javascript/src/error.js' );
const { isString, isUserDefined } = require( '../function-schemata/javascript/src/utils' );
const {
	validatesAsFunctionCall,
	validatesAsReference,
	validatesAsArgumentReference,
	validatesAsType
} = require( '../function-schemata/javascript/src/schema.js' );
const canonicalize = require( '../function-schemata/javascript/src/canonicalize.js' );
const util = require( 'util' );
const { Invariants } = require( './Invariants.js' );

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

	/**
	 * Private. Use {@link ZWrapper#create} instead.
	 */
	constructor() {
		// Each value in original_ (and eventually in resolved_) points to another ZWrapper
		// representing the corresponding subobject with its own scope. Initially they all point
		// to the same scope, but they diverge as subobjects get resolved.
		this.original_ = new Map();
		this.resolved_ = new Map();
		this.resolvedEphemeral_ = new Map();
		this.keys_ = new Set();
		this.scope_ = null;
	}

	/**
	 * Creates an equivalent ZWrapper representation for the given ZObject and its subobjects.
	 * The resulting ZWrapper has the same fields as the ZObject, each of which is itself a
	 * ZWrapper, and so on.
	 *
	 * @param {string|Object|ZWrapper} zobjectJSON The JSON representation of the ZObject)
	 * @param {ZWrapper} scope The ZObject with whose scope this wrapped object exists
	 * @return {ZWrapper|string}
	 */
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
					return this.getNameEphemeral( key );
				}
			} );
		}
		return result;
	}

	/**
	 * Get a copy of this object.
	 *
	 * @return {ZWrapper}
	 */
	copy() {
		const result = new ZWrapper();
		result.scope_ = this.getScope();
		for ( const entry of this.original_.entries() ) {
			const key = entry[ 0 ];
			let originalValue = entry[ 1 ];
			if ( originalValue instanceof ZWrapper ) {
				originalValue = originalValue.copy();
			}
			result.original_.set( key, originalValue );
		}
		for ( const entry of this.resolved_.entries() ) {
			const key = entry[ 0 ];
			let resolvedValue = entry[ 1 ];
			if ( resolvedValue instanceof ZWrapper ) {
				resolvedValue = resolvedValue.copy();
			}
			result.resolved_.set( key, resolvedValue );
		}
		for ( const key of this.keys() ) {
			result.keys_.add( key );
			Object.defineProperty( result, key, {
				get: function () {
					return this.getNameEphemeral( key );
				}
			} );
		}
		return result;
	}

	/**
	 * Get the resolved object for the given key, including the ephemeral resolution, if
	 * available.
	 *
	 * @param {string} key The key for the object to fetch
	 * @return {ZWrapper}
	 */
	getNameEphemeral( key ) {
		if ( this.resolvedEphemeral_.has( key ) ) {
			return this.resolvedEphemeral_.get( key );
		}
		if ( this.resolved_.has( key ) ) {
			return this.resolved_.get( key );
		}
		return this.original_.get( key );
	}

	/**
	 * Set the resolved object for the given key.
	 *
	 * WARNING: Do not call this function with keys that were not part of the original object.
	 *
	 * @param {string} key The key to set
	 * @param {ZWrapper} value The value to set
	 */
	setName( key, value ) {
		this.resolved_.set( key, value );
	}

	/**
	 * Set the ephemerally-resolved object for the given key.
	 *
	 * WARNING: Do not call this function with keys that were not part of the original object.
	 *
	 * @param {string} key The key to set
	 * @param {ZWrapper} value The value to set
	 */
	setNameEphemeral( key, value ) {
		this.resolvedEphemeral_.set( key, value );
	}

	/**
	 * Get the resolved object for the given key, if available.
	 *
	 * @param {string} key The key for the object to fetch
	 * @return {ZWrapper}
	 */
	getName( key ) {
		if ( this.resolved_.has( key ) ) {
			return this.resolved_.get( key );
		}
		return this.original_.get( key );
	}

	/**
	 * Private.
	 *
	 * @param {Invariants} invariants
	 * @param {Set(MutationType)} ignoreList
	 * @param {boolean} resolveInternals
	 * @param {boolean} doValidate
	 * @param {boolean} evenBuiltins
	 * @return {Promise<ZWrapper>}
	 */
	async resolveInternal_( invariants, ignoreList, resolveInternals, doValidate, evenBuiltins ) {
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
				const argumentReferenceStatus = validatesAsArgumentReference( nextJSON );
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
				const referenceStatus = validatesAsReference( nextJSON );
				// TODO (T296686): isUserDefined call here is only an
				// optimization/testing expedient; it would be better to pre-populate
				// the cache with builtin types.
				if ( referenceStatus.isValid() ) {
					if ( isUserDefined( nextObject.Z9K1 ) || evenBuiltins ) {
						const refKey = nextObject.Z9K1;
						const dereferenced = await invariants.resolver.dereference( [ refKey ] );
						const Z22 = dereferenced.get( refKey );
						if ( responseEnvelopeContainsError( Z22 ) ) {
							return Z22;
						}
						nextObject = Z22.Z22K1.Z2K2;
						continue;
					}
				}
			}
			if ( !ignoreList.has( MutationType.FUNCTION_CALL ) ) {
				const functionCallStatus = validatesAsFunctionCall( nextJSON );
				if ( functionCallStatus.isValid() ) {
					const { execute } = require( './execute.js' );
					const Z22 = await execute(
						nextObject, invariants, doValidate,
						/* implementationSelector= */ null, resolveInternals );
					if ( responseEnvelopeContainsError( Z22 ) ) {
						return Z22;
					}
					nextObject = Z22.Z22K1;
					continue;
				}
			}
			if ( isGenericType( nextObject ) ) {
				const executionResult = await nextObject.resolveKey( [ 'Z1K1' ], invariants, ignoreList, resolveInternals, doValidate );
				if ( responseEnvelopeContainsError( executionResult ) ) {
					return executionResult;
				}
				const Z4 = nextObject.Z1K1;
				const typeStatus = validatesAsType( Z4.asJSON() );
				if ( !typeStatus.isValid() ) {
					// TODO (T2966681): Return typeStatus.getZ5() as part of this result.
					return makeWrappedResultEnvelope(
						null,
						makeErrorInNormalForm(
							error.argument_type_mismatch,
							[ 'Generic type function did not return a Z4: ' + JSON.stringify( Z4.asJSON() ) ] ) );
				}
				continue;
			}
			break;
		}
		return makeWrappedResultEnvelope( nextObject, null );
	}

	/**
	 * Private.
	 *
	 * @param {Object} key
	 * @param {Invariants} invariants
	 * @param {Set(MutationType)} ignoreList
	 * @param {boolean} resolveInternals
	 * @param {boolean} doValidate
	 * @param {Function} getNameFunction
	 * @param {Function} setNameFunction
	 * @return {Promise<ZWrapper|string>}
	 */
	async resolveInternalHelper_(
		key, invariants, ignoreList, resolveInternals, doValidate, getNameFunction, setNameFunction
	) {
		let newValue, resultEnvelope;
		const currentValue = getNameFunction( key );
		if ( currentValue instanceof ZWrapper ) {
			resultEnvelope = await ( currentValue.resolveInternal_(
				invariants, ignoreList, resolveInternals, doValidate, /* evenBuiltins */ false
			) );
			if ( responseEnvelopeContainsError( resultEnvelope ) ) {
				return resultEnvelope;
			}
			newValue = resultEnvelope.Z22K1;
		} else {
			resolveInternals = false;
			resultEnvelope = makeWrappedResultEnvelope( this, null );
			newValue = currentValue;
		}
		if ( resolveInternals ) {
			// Validate that the newly-mutated object validates in accordance with the
			// original object's key declaration.
			const theSchema = createSchema( this.asJSON() );
			// We validate elsewhere that Z1K1 must be a type, so the schemata do not
			// surface separate validators for Z1K1.
			if ( key !== 'Z1K1' ) {
				const subValidator = theSchema.subValidator( key );
				if ( subValidator === undefined ) {
					// Should never happen?
					return makeWrappedResultEnvelope(
						null,
						makeErrorInNormalForm(
							error.invalid_key,
							[ `ZObject does not have the key ${key}` ] ) );
				}

				let toValidate;
				if ( newValue instanceof ZWrapper ) {
					toValidate = newValue.asJSON();
				} else {
					toValidate = newValue;
				}
				const theStatus = subValidator.validateStatus( toValidate );
				if ( !theStatus.isValid() ) {
					// TODO (T302015): Find a way to incorporate information about where this
					// error came from.
					return makeWrappedResultEnvelope( null, theStatus.getZ5() );
				}
			}
		}
		setNameFunction( key, newValue );
		return resultEnvelope;
	}

	/**
	 * Private.
	 *
	 * @param {Object} key
	 * @param {Invariants} invariants
	 * @param {Set(MutationType)} ignoreList
	 * @param {boolean} resolveInternals
	 * @param {boolean} doValidate
	 * @return {Promise<ZWrapper>}
	 */
	async resolveKeyInternal_(
		key, invariants, ignoreList, resolveInternals, doValidate
	) {
		const selfReference = this;
		function getNameFunction( key ) {
			return selfReference.getName( key );
		}
		function setNameFunction( key, value ) {
			return selfReference.setName( key, value );
		}
		return await this.resolveInternalHelper_(
			key, invariants, ignoreList, resolveInternals, doValidate,
			getNameFunction, setNameFunction
		);
	}

	/**
	 * Private.
	 *
	 * TODO: Collapse common functionality with resolveKeyInternal_.
	 *
	 * @param {Object} key
	 * @param {Invariants} invariants
	 * @param {Set(MutationType)} ignoreList
	 * @param {boolean} resolveInternals
	 * @param {boolean} doValidate
	 * @return {Promise<ZWrapper>}
	 */
	async resolveEphemeralInternal_(
		key, invariants, ignoreList, resolveInternals, doValidate ) {
		const selfReference = this;
		function getNameFunction( key ) {
			return selfReference.getNameEphemeral( key );
		}
		function setNameFunction( key, value ) {
			return selfReference.setNameEphemeral( key, value );
		}
		return await this.resolveInternalHelper_(
			key, invariants, ignoreList, resolveInternals, doValidate,
			getNameFunction, setNameFunction );
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
	 * @param {boolean} evenBuiltins Whether to resolve references to built-in types.
	 * @return {Promise<ZWrapper>} A result envelope zobject representing the result.
	 */
	async resolve(
		invariants, ignoreList = null, resolveInternals = true, doValidate = true,
		evenBuiltins = false
	) {
		// TODO: Remove this intermediate call?
		return this.resolveInternal_(
			invariants, ignoreList, resolveInternals, doValidate, evenBuiltins );
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
	 * @param {boolean} resolveInternals
	 * @param {boolean} doValidate
	 * @return {Promise<ZWrapper>} A result envelope zobject representing the result.
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
			if ( responseEnvelopeContainsError( result ) ) {
				return result;
			}
		}
		const nextValue = this.getNameEphemeral( key );
		if ( nextValue instanceof ZWrapper ) {
			result = await (
				nextValue.resolveKey(
					keys, invariants, ignoreList, resolveInternals, doValidate )
			);
		}
		return result;
	}

	/**
	 * Recursively traverses and resolves the current object along the given keys, caching the
	 * results for future calls.
	 *
	 * This differs from resolveKey() in that the resolved values will not be
	 * represented when asJSON() is called. resolveEphemeral is useful for cases
	 * where it's helpful to cache results, but those results will not be needed
	 * outside of the orchestrator.
	 *
	 * The returned object does not have any evaluation rule that applies to it (i.e. it is not a
	 * reference, argument reference, function call, etc.) but the same is not true for its
	 * subobjects; they should be resolved separately. Moreover, it is wrapped in a result envelope
	 * to indicate any errors.
	 *
	 * @param {Array(string)} keys Path of subobjects to resolve
	 * @param {Invariants} invariants
	 * @param {Set(MutationType)} ignoreList
	 * @param {boolean} resolveInternals
	 * @param {boolean} doValidate
	 * @return {Promise<ZWrapper>} A result envelope zobject representing the result.
	 */
	async resolveEphemeral(
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
		if ( !this.resolvedEphemeral_.has( key ) ) {
			result = await this.resolveEphemeralInternal_(
				key, invariants, ignoreList, resolveInternals, doValidate );
			if ( responseEnvelopeContainsError( result ) ) {
				return result;
			}
		}
		const nextValue = this.getNameEphemeral( key );
		if ( nextValue instanceof ZWrapper ) {
			result = await (
				nextValue.resolveEphemeral(
					keys, invariants, ignoreList, resolveInternals, doValidate )
			);
		}
		return result;
	}

	/**
	 * Returns the JSON representation of the zobject.
	 *
	 * WARNING: The resulting object loses all information in the attached scopes and may therefore
	 * have unbound argument references. In particular, if subobjects have already been resolved
	 * with `resolveKey()`, their scope might have diverged. This means that `zwrapper.asJSON()` may
	 * have argument references that are not captured even in `zwrapper.getScope()`. Using this
	 * method should hence only be used judiciously where such effects can be taken into account.
	 * You have been warned.
	 *
	 * @return {Object}
	 */
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

	/**
	 * Returns the JSON representation of the zobject, based only on the keys' ephemeral values.
	 *
	 * @return {Object}
	 */
	asJSONEphemeral() {
		const result = {};
		for ( const key of this.keys() ) {
			let value = this.getNameEphemeral( key );
			if ( value instanceof ZWrapper ) {
				value = value.asJSONEphemeral();
			}
			result[ key ] = value;
		}
		return result;
	}

	/**
	 * Returns a view of the ZWrapper object of a ZResultEnvelope suitable for debugging:
	 * - ZObjects are canonicalized
	 * - Scopes are flattened
	 *
	 * See also {@link ZWrapper#debug}.
	 *
	 * @return {Object}
	 */
	debugObject() {
		const object_ = canonicalize( this.asJSON() ).Z22K1;
		const scope_ = this.scope_.debugObject();
		return { object_, scope_ };
	}

	/**
	 * Helper function for logging the debug representation of the ZWrapper.
	 *
	 * With it, one can write:
	 *
	 *   `console.log( 'executing:', await zwrapper.debug() );`
	 *
	 * … to log the debug representation of the ZWrapper object without truncating it due to depth.
	 *
	 * See also {@link ZWrapper#debug}.
	 *
	 * @return {Object}
	 */
	debug() {
		const debugObject = this.debugObject();
		return { [ util.inspect.custom ]: ( _, options, inspect ) => {
			return util.inspect( debugObject, Object.assign( {}, options, {
				depth: null
			} ) );
		} };
	}

	/* eslint-disable jsdoc/no-undefined-types */
	/**
	 * Get all the keys set for this ZObject.
	 *
	 * @return {IterableIterator<string>}
	 */
	keys() {
		return this.keys_.values();
	}
	/* eslint-enable jsdoc/no-undefined-types */

	/**
	 * Get the scope ZWrapper set for this ZObject, if any.
	 *
	 * @return {ZWrapper|null}
	 */
	getScope() {
		return this.scope_;
	}

	/**
	 * Set the scope ZWrapper for this ZObject.
	 *
	 * @param {ZWrapper} scope
	 */
	setScope( scope ) {
		this.scope_ = scope;
	}

}

module.exports = { MutationType, ZWrapper };
