'use strict';

const { ArgumentState } = require( './argumentState.js' );
const { BaseFrame, EmptyFrame } = require( './frame.js' );
const { Composition, Implementation } = require( './implementation.js' );
const { RandomImplementationSelector } = require( './implementationSelector.js' );
const { containsError, containsValue, createZObjectKey, isRefOrString, makeWrappedResultEnvelope, quoteZObject, returnOnFirstError } = require( './utils.js' );
const { MutationType, ZWrapper } = require( './ZWrapper' );
const { resolveListType } = require( './builtins.js' );
const { error, normalError } = require( '../function-schemata/javascript/src/error.js' );
const { convertZListToItemArray, getError } = require( '../function-schemata/javascript/src/utils.js' );
const { validatesAsArgumentReference, validatesAsType } = require( '../function-schemata/javascript/src/schema.js' );

let execute = null;

async function validateAsType( Z1, invariants, typeZObject = null ) {
	const wrapInZ9 = ( ZID ) => {
		// A lone reference doesn't need any scope.
		return ZWrapper.create( {
			Z1K1: 'Z9',
			Z9K1: ZID
		}, new EmptyFrame() );
	};
	const genericSchemaValidatorZID = 'Z831';
	const genericValidatorZ8Reference = wrapInZ9( genericSchemaValidatorZID );
	const genericValidatorZ8 = ( await ( genericValidatorZ8Reference.resolve(
		invariants ) ) ).Z22K1;

	if ( typeZObject === null ) {
		typeZObject = Z1.Z1K1;
	}
	// TODO (T292787): Make this more elegant--should be possible to avoid
	// passing strings in the first place.
	if ( typeof typeZObject === 'string' || typeZObject instanceof String ) {
		typeZObject = wrapInZ9( typeZObject );
	}
	const { runValidationFunction } = require( './validation.js' );
	const callTuples = [];
	callTuples.push(
		[
			runValidationFunction,
			[
				genericValidatorZ8, invariants,
				quoteZObject( Z1 ), quoteZObject( typeZObject ) ],
			'runValidationFunction' ] );
	// TODO (T301532): Find a more reliable way to signal that no additional
	// validation needs to be run. Here we just make sure that we won't run the
	// same function twice by comparing Z8K5 references.
	const resolvedType = ( await ( typeZObject.resolve( invariants ) ) ).Z22K1;
	if ( validatesAsType( resolvedType.asJSON() ).isValid() ) {
		await ( resolvedType.resolveKey( [ 'Z4K3' ], invariants ) );
		const validatorZ8 = resolvedType.Z4K3;
		if ( validatorZ8.Z8K5.Z9K1 !== genericValidatorZ8.Z8K5.Z9K1 ) {
			const { runTypeValidatorDynamic } = require( './validation.js' );
			callTuples.push(
				[
					runTypeValidatorDynamic,
					[ Z1, typeZObject, invariants ],
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
 * @return {ArgumentState|null} error state or null if no error encountered
 */
async function resolveTypes( Z1, invariants, doValidate = true ) {
	const objectQueue = [ Z1 ];
	while ( objectQueue.length > 0 ) {
		const nextObject = objectQueue.shift();
		if ( isRefOrString( nextObject ) ) {
			continue;
		}
		await ( nextObject.resolveKey(
			[ 'Z1K1' ], invariants, /* ignoreList= */ null,
			/* resolveInternals= */ false, doValidate ) );
		const typeEnvelope = nextObject.Z1K1;
		if ( containsError( typeEnvelope ) ) {
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
			invariants, ignoreList, resolveInternals, doValidate ) );
		if ( containsError( argumentEnvelope ) ) {
			return ArgumentState.ERROR( getError( argumentEnvelope ) );
		}
		const argument = argumentEnvelope.Z22K1;
		if ( doValidate && resolveInternals ) {
			const typeError = await resolveTypes( argument, invariants );
			if ( typeError !== null ) {
				return typeError;
			}
			const actualResult = await validateAsType( argument, invariants );
			if ( containsError( actualResult ) ) {
				return ArgumentState.ERROR(
					normalError(
						[ error.object_type_mismatch ],
						[ argument.Z1K1, argument, getError( actualResult ) ] ) );
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
					if ( containsError( declaredResult ) ) {
						boundValue = ArgumentState.ERROR(
							normalError(
								[ error.argument_type_mismatch ],
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
	if ( containsError( Z7K1Envelope ) ) {
		return [ ArgumentState.ERROR( 'Could not dereference Z7K1' ) ];
	}
	const Z7K1 = Z7K1Envelope.Z22K1;
	const Z8K1Envelope = await ( Z7K1.resolveKey(
		[ 'Z8K1' ], invariants, /* ignoreList= */ null, /* resolveInternals= */ false, doValidate ) );
	// This usually happens because dereferencing can't occur during validation
	// (and is expected).
	if ( containsError( Z8K1Envelope ) ) {
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
	if ( !containsError( result ) ) {
		if ( !containsValue( result ) ) {
			// Neither value nor error.
			return makeWrappedResultEnvelope(
				null,
				normalError(
					[ error.not_wellformed_value ],
					[ 'Function evaluation returned an empty object.' ]
				)
			);
		}

		// Value returned; validate its return type..
		await ( zobject.resolveKey( [ 'Z7K1', 'Z8K2' ], invariants ) );
		const returnType = zobject.Z7K1.Z8K2;
		const returnTypeValidation = await validateAsType(
			result.Z22K1, invariants, returnType
		);
		if ( containsError( returnTypeValidation ) ) {
			return makeWrappedResultEnvelope(
				null,
				normalError(
					[ error.return_type_mismatch ],
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

	if ( containsValue( result ) ) {
		// Both value and error.
		return makeWrappedResultEnvelope(
			null,
			normalError(
				[ error.not_wellformed_value ],
				[ 'Function evaluation returned both a value and an error.' ]
			)
		);
	}

	// No value but some error.
	return result;
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
 * @return {ZWrapper}
 */
async function executeInternal(
	zobject, invariants, doValidate = true,
	implementationSelector = null, resolveInternals = true ) {

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
				normalError(
					[ error.error_in_evaluation ],
					[ argumentState.error ]
				)
			);
		}
	}

	// Ensure Z8 (Z7K1) is dereferenced. Also ensure implementations are
	// dereferenced (Z8K4 and all elements thereof).
	const Z7K1Envelope = await ( zobject.Z7K1.resolve(
		invariants, /* ignoreList= */ null, /* resolveInternals= */ false, doValidate ) );
	if ( containsError( Z7K1Envelope ) ) {
		return Z7K1Envelope;
	}
	const Z7K1 = Z7K1Envelope.Z22K1;
	const Z8K4Envelope = await ( Z7K1.Z8K4.resolve(
		invariants, /* ignoreList= */ null, /* resolveInternals= */ false, doValidate ) );
	if ( containsError( Z8K4Envelope ) ) {
		return Z8K4Envelope;
	}
	const Z8K4 = Z8K4Envelope.Z22K1;
	const implementations = [];

	for ( const Z14 of convertZListToItemArray( Z8K4 ) ) {
		const Z14Envelope = ( await ( Z14.resolve(
			invariants, /* ignoreList= */null, /* resolveInternals= */ false, doValidate
		) ) );
		if ( containsError( Z14Envelope ) ) {
			return Z14Envelope;
		}
		implementations.push( Z14Envelope.Z22K1 );
	}

	if ( implementations.length === 0 ) {
		return makeWrappedResultEnvelope(
			null,
			normalError(
				[ error.error_in_evaluation ],
				[ 'Could not find any implementations for ' + zobject.Z7K1.Z8K5.Z9K1 + '.' ]
			)
		);
	}

	if ( implementationSelector === null ) {
		implementationSelector = new RandomImplementationSelector();
	}
	const implementationZObject = implementationSelector.select( implementations );
	const implementation = Implementation.create( implementationZObject );

	if ( implementation === null ) {
		return makeWrappedResultEnvelope(
			null,
			normalError(
				[ error.error_in_evaluation ],
				[ 'Could not create an implementation for ' + zobject.Z7K1.Z8K5.Z9K1 + '.' ]
			)
		);
	}

	const newScope = new Frame( implementationZObject.getScope() );
	for ( const argumentState of argumentStates ) {
		newScope.setArgument( argumentState.argumentDict.name, argumentState );
	}

	const argumentInstantiations = [];
	if ( !( implementation instanceof Composition ) ) {
		// Populate arguments from scope.
		const instantiationPromises = [];
		for ( const argumentState of argumentStates ) {
			const argumentDict = argumentState.argumentDict;
			instantiationPromises.push(
				newScope.retrieveArgument(
					argumentDict.name, invariants,
					implementation.hasLazyVariable( argumentDict.name ),
					doValidate
				) );
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
	}
	if ( doValidate && resolveInternals ) {
		result = await validateReturnType( result, zobject, invariants );
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
			if ( !containsError( valueEnvelope ) ) {
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
 * @return {ZWrapper} result of executing function call
 */
execute = async function (
	zobject, invariants = null, doValidate = true,
	implementationSelector = null, resolveInternals = true, topLevel = false ) {
	const result = await executeInternal(
		zobject, invariants, doValidate,
		implementationSelector, resolveInternals );
	if ( topLevel ) {
		await resolveDanglingReferences( result.Z22K1, invariants );
	}
	return result;
};

module.exports = { execute, getArgumentStates };
