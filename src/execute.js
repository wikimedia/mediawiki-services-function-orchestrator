'use strict';

const { ArgumentState } = require( './argumentState.js' );
const { Invariants } = require( './Invariants' );
const ImplementationSelector = require( './implementationSelector.js' );
const { BaseFrame, EmptyFrame } = require( './frame.js' );
const { Composition, Implementation, Evaluated, ZResponseError } = require( './implementation.js' );
const { FirstImplementationSelector } = require( './implementationSelector.js' );
const {
	createZObjectKey,
	isRefOrString,
	makeWrappedResultEnvelope,
	returnOnFirstError,
	responseEnvelopeContainsError,
	responseEnvelopeContainsValue,
	setMetadataValues
} = require( './utils.js' );
const { MutationType, ZWrapper } = require( './ZWrapper' );
const { resolveListType } = require( './builtins.js' );
const { error, makeErrorInNormalForm } = require( '../function-schemata/javascript/src/error.js' );
const { convertZListToItemArray, getError, isString, setZMapValue } = require( '../function-schemata/javascript/src/utils.js' );
const { validatesAsArgumentReference, validatesAsFunctionCall, validatesAsReference, validatesAsString, validatesAsType } = require( '../function-schemata/javascript/src/schema.js' );
const { compareTypes } = require( '../function-schemata/javascript/src/compareTypes.js' );

let execute = null;

async function validateAsType( Z1, invariants, typeZObject = null ) {
	const wrapInZ9 = ( ZID ) => {
		// A lone reference doesn't need any scope.
		return ZWrapper.create( {
			Z1K1: 'Z9',
			Z9K1: ZID
		}, new EmptyFrame() );
	};
	const callTuples = [];
	let resolvedType = Z1.getNameEphemeral( 'Z1K1' );

	// TODO (T292787): Make this more elegant--should be possible to avoid
	// passing strings in the first place.
	if ( isString( typeZObject ) ) {
		typeZObject = wrapInZ9( typeZObject );
	}
	if ( isString( resolvedType ) ) {
		resolvedType = wrapInZ9( resolvedType );
	}
	if ( typeZObject instanceof ZWrapper ) {
		typeZObject = typeZObject.asJSON();
	}
	let resolvedTypeJSON = resolvedType;
	if ( resolvedType instanceof ZWrapper ) {
		resolvedTypeJSON = resolvedType.asJSON();
	}

	// Run type comparison if typeZObject is provided.
	if ( typeZObject !== null ) {
		const runTypeComparison = ( comparand, comparator ) => {
			const typeComparison = compareTypes( comparand, comparator );
			if ( typeComparison ) {
				return makeWrappedResultEnvelope( Z1, null );
			} else {
				return makeWrappedResultEnvelope(
					null,
					makeErrorInNormalForm(
						error.object_type_mismatch,
						[ Z1.getNameEphemeral( 'Z1K1' ) ] ) );
			}
		};
		callTuples.push(
			[
				runTypeComparison,
				[ resolvedTypeJSON, typeZObject ],
				'runTypeComparison' ] );
	}
	const genericSchemaValidatorZID = 'Z831';

	// TODO (T301532): Find a more reliable way to signal that no additional
	// validation needs to be run. Here we just make sure that we won't run the
	// same function twice by comparing Z8K5 references.
	//
	// TODO (T327870): Also run the validator for typeZObject?
	if ( validatesAsType( resolvedTypeJSON ).isValid() ) {
		await ( resolvedType.resolveEphemeral( [ 'Z4K3' ], invariants ) );
		const validatorZ8 = resolvedType.Z4K3;
		if ( validatorZ8.Z8K5.Z9K1 !== genericSchemaValidatorZID ) {
			const { runTypeValidatorDynamic } = require( './validation.js' );
			callTuples.push(
				[
					runTypeValidatorDynamic,
					// [ Z1ToValidate, typeToValidate, invariants ],
					[ Z1, resolvedType, invariants ],
					'runTypeValidator' ] );
		}
	}

	const Z22 = makeWrappedResultEnvelope( Z1, null );
	return await returnOnFirstError( Z22, callTuples, /* callback= */null, /* addZ22= */false );
}

/**
 * Traverses a ZObject and resolves all Z1K1s.
 *
 * @param {Object} Z1 object whose Z1K1s are to be resolved
 * @param {Invariants} invariants evaluator, resolver: invariants preserved over all function calls
 * @param {boolean} doValidate whether to validate types of arguments and return values
 * @return {Promise<ArgumentState|null>} error state or null if no error encountered
 */
async function resolveTypes( Z1, invariants, doValidate = true ) {
	const objectQueue = [ Z1 ];
	while ( objectQueue.length > 0 ) {
		const nextObject = objectQueue.shift();
		if ( isRefOrString( nextObject ) ) {
			continue;
		}
		await ( nextObject.resolveEphemeral(
			[ 'Z1K1' ], invariants, /* ignoreList= */ null,
			/* resolveInternals= */ false, doValidate ) );
		const typeEnvelope = nextObject.Z1K1;
		if ( responseEnvelopeContainsError( typeEnvelope ) ) {
			return ArgumentState.ERROR( getError( typeEnvelope ) );
		}
		for ( const key of nextObject.keys() ) {
			if ( key === 'Z1K1' ) {
				continue;
			}
			objectQueue.push( nextObject[ key ] );
		}
	}
	return null;
}

class KeyList {

	constructor( key, lastList ) {
		this.key = key;
		this.lastList = lastList;
		this.seenKeys = new Set( lastList === null ? undefined : lastList.seenKeys );
		this.seenKeys.add( this.key );
		this.length = 1 + ( lastList === null ? 0 : lastList.length );
	}

	getAllKeys() {
		let result;
		if ( this.lastList !== null ) {
			result = this.lastList.getAllKeys();
		}
		result.push( this.key );
		return result;
	}

}

async function eagerlyEvaluate(
	zobject, invariants, ignoreList, resolveInternals, doValidate, keyList = null ) {
	if (
		!( zobject instanceof ZWrapper ) ||
            validatesAsString( zobject ).isValid() ||
            validatesAsReference( zobject ).isValid() ) {
		return null;
	}

	if ( ignoreList === null ) {
		ignoreList = new Set();
	}
	const ignoreKeys = new Set( [
		'Z1K1', 'Z4K1', 'Z4K2', 'Z4K3',
		'Z8K1', 'Z8K2', 'Z8K3', 'Z8K4', 'Z8K5',
		'Z40K1', 'Z99K1' ] );

	function doResolve( key, someObject, someObjectJSON ) {
		if (
			validatesAsArgumentReference( someObjectJSON ).isValid() &&
            !( ignoreList.has( MutationType.ARGUMENT_REFERENCE ) ) ) {
			if ( someObject.getScope().hasVariable( someObjectJSON.Z18K1.Z6K1 ) ) {
				return true;
			}
			return false;
		}
		if (
			validatesAsReference( someObjectJSON ).isValid() &&
            !( ignoreList.has( MutationType.REFERENCE ) ) ) {
			return true;
		}
		if (
			validatesAsFunctionCall( someObjectJSON ).isValid() &&
            !( ignoreList.has( MutationType.FUNCTION_CALL ) ) ) {
			return true;
		}
		return false;
	}

	const subResultPromises = [];
	for ( const key of zobject.keys() ) {
		if ( ignoreKeys.has( key ) ) {
			continue;
		}
		if ( keyList !== null && keyList.seenKeys.has( key ) && keyList.length > 20 ) {
			return makeWrappedResultEnvelope(
				makeErrorInNormalForm(
					error.argument_value_error,
					[
						'Aborting because argument resolution contains cyclical references:',
						keyList.getAllKeys().join( ',' ) ] ) );
		}
		const nextKeyList = new KeyList( key, keyList );
		const oldValue = zobject[ key ];
		let oldValueJSON = oldValue;
		if ( oldValueJSON instanceof ZWrapper ) {
			oldValueJSON = oldValueJSON.asJSON();
		}
		if ( doResolve( key, oldValue, oldValueJSON ) ) {
			const valueEnvelope = await ( oldValue.resolve(
				invariants, ignoreList, resolveInternals, doValidate ) );
			// It's okay for some Z18s not to have values assigned.
			// TODO (T305981): We should formally distinguish between unbound
			// and unassigned variables. This will constrain further the errors
			// that we let slide here.
			if ( responseEnvelopeContainsError( valueEnvelope ) ) {
				return valueEnvelope;
			} else {
				const newValue = valueEnvelope.Z22K1;
				zobject.setName( key, newValue );
				if ( newValue instanceof ZWrapper ) {
					let newScope;
					if ( oldValue instanceof ZWrapper ) {
						newScope = oldValue.getScope();
					} else {
						newScope = zobject.getScope();
					}
					zobject[ key ].setScope( newScope );
				}
			}
		}
		subResultPromises.push( eagerlyEvaluate(
			zobject[ key ], invariants, ignoreList, resolveInternals, doValidate, nextKeyList ) );
	}

	for ( const subResult of await ( Promise.all( subResultPromises ) ) ) {
		if ( subResult !== null ) {
			return subResult;
		}
	}

	return null;
}

class Frame extends BaseFrame {

	constructor( lastFrame = null ) {
		if ( lastFrame === null ) {
			lastFrame = new EmptyFrame();
		}
		super( lastFrame );
	}

	/**
	 * Add new name and argument to this frame.
	 *
	 * @param {string} name
	 * @param {ArgumentState} argumentState an ArgumentState, what else?
	 */
	setArgument( name, argumentState ) {
		this.names_.set( name, argumentState );
	}

	async processArgument(
		argumentDict, invariants, doValidate, resolveInternals,
		ignoreList ) {
		// TODO (T296675): "doValidate" is a heavy-handed hack to avoid infinite
		// recursion. Better solutions include
		//  -   validating directly with schemata if the type is built-in,
		//      otherwise using a Function;
		//  -   validating directly with schemata in all the cases where
		//      doValidate is currently false, otherwise using a Function;
		//  -   caching and reusing the results of function calls
		const argumentEnvelope = await ( argumentDict.argument.resolve(
			invariants, ignoreList, resolveInternals, doValidate,
			/* evenBuiltins= */ true ) );
		if ( responseEnvelopeContainsError( argumentEnvelope ) ) {
			return ArgumentState.ERROR( getError( argumentEnvelope ) );
		}
		const argument = argumentEnvelope.Z22K1;
		if ( doValidate && resolveInternals ) {
			const typeError = await resolveTypes( argument, invariants );
			if ( typeError !== null ) {
				return typeError;
			}
			const actualResult = await validateAsType( argument, invariants );
			if ( responseEnvelopeContainsError( actualResult ) ) {
				return ArgumentState.ERROR(
					makeErrorInNormalForm(
						error.object_type_mismatch,
						[ argument.getName( 'Z1K1' ), argument, getError( actualResult ) ]
					)
				);
			}
		}
		return ArgumentState.EVALUATED( {
			name: argumentDict.name,
			argument: argument
		} );
	}

	/**
	 * Ascend enclosing scopes to find instantiation of argument with provided name.
	 *
	 * @param {string} argumentName
	 * @param {Invariants} invariants evaluator, resolver: invariants preserved
	 *      over all function calls
	 * @param {boolean} lazily
	 * @param {boolean} doValidate if false, then the argument will be executed
	 *      without validating return type (if it's a Z7)
	 * @param {boolean} resolveInternals if false, will evaluate typed lists via shortcut
	 *      and will not validate attributes of Z7s
	 * @param {Set(MutationType)} ignoreList which types of mutations to ignore
	 *      when resolving function calls and references
	 * @return {Object} argument instantiated with given name in lowest enclosing scope
	 * along with enclosing scope
	 */
	async retrieveArgument(
		argumentName, invariants, lazily = false,
		doValidate = true, resolveInternals = true, ignoreList = null ) {
		let boundValue = this.names_.get( argumentName );
		let doSetBoundValue = false;

		// Name does not exist in this scope; look in the previous one
		// (or return null if no previous scope).
		if ( boundValue === undefined ) {
			doSetBoundValue = true;
			boundValue = await this.lastFrame_.retrieveArgument(
				argumentName, invariants, lazily, doValidate,
				resolveInternals, ignoreList );
		} else if ( boundValue.state === 'UNEVALUATED' && !lazily ) {
			doSetBoundValue = true;
			// If boundValue is in the ERROR or EVALUATED state, it has already
			// been evaluated and can be returned directly.
			// If state is UNEVALUATED and evaluation is not lazy, the argument
			// may need to be evaluated before returning (e.g., if a Z9, Z18,
			// or Z7).
			const argumentDict = boundValue.argumentDict;
			const evaluatedArgument = await this.processArgument(
				argumentDict, invariants, doValidate, resolveInternals, ignoreList );
			if ( evaluatedArgument.state === 'ERROR' ) {
				boundValue = evaluatedArgument;
			} else if ( evaluatedArgument.state === 'EVALUATED' ) {
				const newDict = {
					name: argumentName,
					argument: evaluatedArgument.argumentDict.argument,
					declaredType: argumentDict.declaredType
				};
				boundValue = ArgumentState.EVALUATED( newDict );
				if ( doValidate && resolveInternals ) {
					const argument = newDict.argument;
					const declaredType = newDict.declaredType;
					const declaredResult = await validateAsType(
						argument, invariants, declaredType );
					if ( responseEnvelopeContainsError( declaredResult ) ) {
						boundValue = ArgumentState.ERROR(
							makeErrorInNormalForm(
								error.argument_type_mismatch,
								[ declaredType, argument.Z1K1, argument,
									getError( declaredResult ) ] ) );
					}
				}
			} else {
				// TODO (T296676): Throw error here, since this shouldn't happen.
			}
		}
		if ( doSetBoundValue ) {
			this.setArgument( argumentName, boundValue );
		}
		return boundValue;
	}

}

/**
 * Retrieve argument declarations and instantiations from a Z7.
 *
 * @param {Object} zobject
 * @param {Invariants} invariants evaluator, resolver: invariants preserved over all function calls
 * @param {boolean} doValidate whether to validate types of arguments and return values
 * @return {Array} list of objects containing argument names
 */
async function getArgumentStates( zobject, invariants, doValidate = true ) {
	const argumentStates = [];
	const Z7K1Envelope = await ( zobject.resolveKey(
		[ 'Z7K1' ], invariants, /* ignoreList= */ null, /* resolveInternals= */ true, doValidate ) );
	if ( responseEnvelopeContainsError( Z7K1Envelope ) ) {
		return [ ArgumentState.ERROR( 'Could not dereference Z7K1' ) ];
	}
	const Z7K1 = Z7K1Envelope.Z22K1;
	const Z8K1Envelope = await ( Z7K1.resolveKey(
		[ 'Z8K1' ], invariants, /* ignoreList= */ null, /* resolveInternals= */ false, doValidate ) );
	// This usually happens because dereferencing can't occur during validation
	// (and is expected).
	if ( responseEnvelopeContainsError( Z8K1Envelope ) ) {
		return [ ArgumentState.ERROR( 'Could not dereference Z8K1' ) ];
	}
	const Z8K1 = Z8K1Envelope.Z22K1;
	const foundKeys = new Set( zobject.keys() );
	foundKeys.delete( 'Z1K1' );
	foundKeys.delete( 'Z7K1' );
	for ( const Z17 of convertZListToItemArray( Z8K1 ) ) {
		const argumentDict = {};
		await ( Z17.resolveKey(
			[ 'Z17K2' ], invariants,
			/* ignoreList= */ null, /* resolveInternals= */ false, doValidate ) );
		const argumentName = Z17.Z17K2.Z6K1;
		argumentDict.name = argumentName;
		// TODO (T292787): This is flaky to rely on; find a better way to determine type.
		await ( Z17.resolveKey(
			[ 'Z17K1' ], invariants,
			/* ignoreList= */ null, /* resolveInternals= */ false, doValidate ) );
		argumentDict.declaredType = Z17.Z17K1;
		let key = argumentName;
		if ( zobject[ key ] === undefined ) {
			const localKeyRegex = /K[1-9]\d*$/;
			key = key.match( localKeyRegex )[ 0 ];
		}

		const argument = zobject[ key ];

		if ( argument === undefined ) {
			argumentStates.push( ArgumentState.ERROR( `Could not find argument ${argumentName}.` ) );
		} else {
			foundKeys.delete( key );
			argumentDict.argument = argument;
			argumentStates.push( ArgumentState.UNEVALUATED( argumentDict ) );
		}
	}

	for ( const extraKey of foundKeys ) {
		argumentStates.push( ArgumentState.ERROR( `Invalid key for function call: ${extraKey}.` ) );
	}

	return argumentStates;
}

/**
 * Ensure that result of a function call comports with declared type.
 *
 * FIXME (T311055): validateReturn might require normal form. Check and document.
 *
 * @param {Object} result
 * @param {Object} zobject
 * @param {Invariants} invariants evaluator, resolver: invariants preserved over all function calls
 * @return {Object} zobject if validation succeeds; error tuple otherwise
 */
async function validateReturnType( result, zobject, invariants ) {
	if ( !responseEnvelopeContainsError( result ) ) {
		if ( !responseEnvelopeContainsValue( result ) ) {
			// Neither value nor error.
			// TODO (T318293): Can we add modification of the Z22 internals to the ZWrapper concept?
			const modifiableResult = result.asJSON();
			const metadataResponse = modifiableResult.Z22K2;
			setZMapValue(
				metadataResponse,
				{ Z1K1: 'Z6', Z6K1: 'errors' },
				makeErrorInNormalForm(
					error.not_wellformed_value,
					[ 'Function evaluation returned an empty object.' ]
				)
			);
			modifiableResult.Z22K2 = metadataResponse;
			result = ZWrapper.create( modifiableResult );
			return modifiableResult;
		}

		// Value returned; validate its return type..
		await ( zobject.resolveKey( [ 'Z7K1', 'Z8K2' ], invariants ) );
		const returnType = zobject.Z7K1.Z8K2;
		await resolveTypes( result.Z22K1, invariants, /* doValidate= */ true );
		const returnTypeValidation = await validateAsType(
			result.Z22K1, invariants, returnType
		);
		if ( responseEnvelopeContainsError( returnTypeValidation ) ) {
			return makeWrappedResultEnvelope(
				null,
				makeErrorInNormalForm(
					error.return_type_mismatch,
					[
						returnType,
						result.Z22K1.Z1K1,
						result.Z22K1,
						getError( returnTypeValidation )
					]
				)
			);
		}
		// If we got here, it's got a value, no error, and validates, so return as-is.
		return result;
	}

	if ( responseEnvelopeContainsValue( result ) ) {
		// Both value and error.
		return makeWrappedResultEnvelope(
			null,
			makeErrorInNormalForm(
				error.not_wellformed_value,
				[ 'Function evaluation returned both a value and an error.' ]
			)
		);
	}

	// No value but some error.
	return result;
}

/**
 * Add implementation-specific metadata elements to the metadata map in the
 * Evaluation result (response envelope).
 *
 * @param {Implementation} implementation
 * @param {ZWrapper} result (Z22 / Evaluation result)
 * @return {ZWrapper}
 */
async function addImplementationMetadata( implementation, result ) {
	const implementationId = implementation.getZID(); // Can be null
	let implementationType;
	if ( implementation instanceof Composition ) {
		implementationType = 'Composition';
	} else if ( implementation instanceof Evaluated ) {
		implementationType = 'Evaluated';
	} else {
		implementationType = 'BuiltIn';
	}
	const newPairs = new Map();
	if ( implementationId !== null ) {
		newPairs.set( { Z1K1: 'Z6', Z6K1: 'implementationId' }, { Z1K1: 'Z6', Z6K1: implementationId } );
	}
	newPairs.set( { Z1K1: 'Z6', Z6K1: 'implementationType' }, { Z1K1: 'Z6', Z6K1: implementationType } );
	return setMetadataValues( result, newPairs );
}

/**
 * Same as {@link execute} but assumes a new frame has already been created in the scope and does
 * not recursively resolve the subobjects.
 *
 * @param {ZWrapper} zobject
 * @param {Invariants} invariants
 * @param {boolean} doValidate
 * @param {ImplementationSelector} implementationSelector
 * @param {boolean} resolveInternals
 * @param {boolean} topLevel whether this is the top-level Z7 sent to the orchestrator
 * @param {boolean} doEagerlyEvaluate whether to expand arguments fully
 * @return {ZWrapper}
 */
async function executeInternal(
	zobject, invariants, doValidate = true,
	implementationSelector = null, resolveInternals = true,
	topLevel = false, doEagerlyEvaluate = true ) {

	const typeKey = createZObjectKey( zobject );
	if ( typeKey.ZID_ === 'Z881' && !resolveInternals ) {
		// TODO (T305459): Tighten number of cases where `resolveInternals` is set to false.
		// Use an empty scope for the outer object, the nested object should already have its own
		// scope, if any.
		return ZWrapper.create( await resolveListType( zobject.Z881K1 ), new EmptyFrame() );
	}

	// Retrieve argument declarations and instantiations.
	const argumentStates = await getArgumentStates( zobject, invariants );
	for ( const argumentState of argumentStates ) {
		if ( argumentState.state === 'ERROR' ) {
			return makeWrappedResultEnvelope(
				null,
				makeErrorInNormalForm(
					error.error_in_evaluation,
					[ argumentState.error ]
				)
			);
		}
	}

	// Ensure Z8 (Z7K1) is dereferenced. Also ensure implementations are
	// dereferenced (Z8K4 and all elements thereof).
	const Z7K1Envelope = await ( zobject.Z7K1.resolve(
		invariants, /* ignoreList= */ null, /* resolveInternals= */ false, doValidate ) );
	if ( responseEnvelopeContainsError( Z7K1Envelope ) ) {
		return Z7K1Envelope;
	}
	const Z7K1 = Z7K1Envelope.Z22K1;
	const Z8K4Envelope = await ( Z7K1.Z8K4.resolve(
		invariants, /* ignoreList= */ null, /* resolveInternals= */ false, doValidate ) );
	if ( responseEnvelopeContainsError( Z8K4Envelope ) ) {
		return Z8K4Envelope;
	}
	const Z8K4 = Z8K4Envelope.Z22K1;
	const implementations = [];

	for ( const Z14 of convertZListToItemArray( Z8K4 ) ) {
		let impl;
		try {
			impl = await ( Implementation.create( Z14, invariants, doValidate ) );
		} catch ( err ) {
			if ( err instanceof ZResponseError ) {
				return err.envelope;
			} else {
				throw err; // unknown error; rethrow
			}
		}
		implementations.push( impl );
	}

	if ( implementations.length === 0 ) {
		return makeWrappedResultEnvelope(
			null,
			makeErrorInNormalForm(
				error.error_in_evaluation,
				[ 'Could not find any implementations for ' + zobject.Z7K1.Z8K5.Z9K1 + '.' ]
			)
		);
	}

	if ( implementationSelector === null ) {
		implementationSelector = new FirstImplementationSelector();
	}
	const implementation = implementationSelector.select( implementations );

	if ( implementation === null ) {
		return makeWrappedResultEnvelope(
			null,
			makeErrorInNormalForm(
				error.error_in_evaluation,
				[ 'Could not create an implementation for ' + zobject.Z7K1.Z8K5.Z9K1 + '.' ]
			)
		);
	}

	const newScope = new Frame( implementation.getZ14().getScope() );
	for ( const argumentState of argumentStates ) {
		newScope.setArgument( argumentState.argumentDict.name, argumentState );
	}

	const argumentInstantiations = [];
	if ( !( implementation instanceof Composition ) ) {
		// Populate arguments from scope.
		const instantiationPromises = [];
		for ( const argumentState of argumentStates ) {
			const argumentDict = argumentState.argumentDict;
			instantiationPromises.push( async function () {
				const instantiation = await newScope.retrieveArgument(
					argumentDict.name, invariants,
					implementation.hasLazyVariable( argumentDict.name ),
					doValidate );
				if (
					instantiation.state !== 'ERROR' &&
                        doEagerlyEvaluate &&
                        !( implementation.hasLazyVariable( argumentDict.name ) ) ) {
					const subResult = await eagerlyEvaluate(
						instantiation.argumentDict.argument, invariants,
						/* ignoreList= */ null, resolveInternals, doValidate );
					if ( subResult !== null ) {
						return ArgumentState.ERROR( getError( subResult ) );
					}
				}
				return instantiation;
			}() );
		}
		for ( const instantiation of await Promise.all( instantiationPromises ) ) {
			if ( instantiation.state === 'ERROR' ) {
				return makeWrappedResultEnvelope( null, instantiation.error );
			}
			argumentInstantiations.push( instantiation.argumentDict );
		}
	}

	// Equip the implementation for its journey and execute.
	implementation.setScope( newScope );
	implementation.setInvariants( invariants );
	implementation.setDoValidate( doValidate );
	let result = await implementation.execute( zobject, argumentInstantiations );

	// Execute result if implementation is lazily evaluated.
	if ( implementation.returnsLazy() ) {
		await ( result.resolveKey(
			[ 'Z22K1' ], invariants, /* ignoreList= */ null,
			/* resolveInternals= */ true, doValidate ) );
		if ( doEagerlyEvaluate ) {
			const subResult = await eagerlyEvaluate(
				result.Z22K1, invariants, /* ignoreList= */ null,
				resolveInternals, doValidate );
			if ( subResult !== null ) {
				return subResult;
			}
		}
	}

	if ( topLevel ) {
		result = await addImplementationMetadata( implementation, result );
	}
	return result;
}

async function resolveDanglingReferences( zobject, invariants ) {
	if ( !( zobject instanceof ZWrapper ) ) {
		return;
	}
	for ( const key of zobject.keys() ) {
		const oldValue = zobject[ key ];
		let oldValueJSON = oldValue;
		if ( oldValueJSON instanceof ZWrapper ) {
			oldValueJSON = oldValueJSON.asJSON();
		}
		if ( validatesAsArgumentReference( oldValueJSON ).isValid() ) {
			const valueEnvelope = await ( oldValue.resolve(
				invariants, /* ignoreList= */ new Set( [
					MutationType.REFERENCE, MutationType.FUNCTION_CALL,
					MutationType.GENERIC_INSTANCE
				] ), /* resolveInternals= */ false, /* doValidate= */ true ) );
			// It's okay for some Z18s not to have values assigned.
			// TODO (T305981): We should formally distinguish between unbound
			// and unassigned variables. This will constrain further the errors
			// that we let slide here.
			if ( !responseEnvelopeContainsError( valueEnvelope ) ) {
				const newValue = valueEnvelope.Z22K1;
				zobject.setName( key, newValue );
				if ( newValue instanceof ZWrapper ) {
					let newScope;
					if ( oldValue instanceof ZWrapper ) {
						newScope = oldValue.getScope();
					} else {
						newScope = zobject.getScope();
					}
					zobject[ key ].setScope( newScope );
				}
			}
		}
		await resolveDanglingReferences( zobject[ key ], invariants );
	}
}

/**
 * Given ZWrapper representing a function call ZObject, resolves the function, selects an
 * implementation, and executes it with the supplied arguments.
 *
 * @param {ZWrapper} zobject object describing a function call
 * @param {Invariants} invariants evaluator, resolver: invariants preserved over all function calls
 * @param {boolean} doValidate whether to validate types of arguments and return value
 * @param {ImplementationSelector} implementationSelector
 * @param {boolean} resolveInternals if false, will evaluate typed lists via shortcut
 *      and will not validate attributes of Z7s
 * @param {boolean} topLevel whether this is the top-level Z7 sent to the orchestrator
 * @param {boolean} doEagerlyEvaluate whether to expand arguments fully
 * @return {ZWrapper} result of executing function call
 */
execute = async function (
	zobject, invariants = null, doValidate = true,
	implementationSelector = null, resolveInternals = true, topLevel = false,
	doEagerlyEvaluate = true ) {
	let result = await executeInternal(
		zobject, invariants, doValidate,
		implementationSelector, resolveInternals, topLevel, doEagerlyEvaluate );
	if ( topLevel ) {
		await resolveDanglingReferences( result.Z22K1, invariants );
		result = await validateReturnType( result, zobject, invariants );
	}
	return result;
};

module.exports = { execute, getArgumentStates };
