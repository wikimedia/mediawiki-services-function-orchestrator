'use strict';

const { ArgumentState } = require( './argumentState.js' );
const { BaseFrame, EmptyFrame } = require( './frame.js' );
const { Composition, Implementation } = require( './implementation.js' );
const { RandomImplementationSelector } = require( './implementationSelector.js' );
const { containsError, containsValue, createZObjectKey, isRefOrString, makeWrappedResultEnvelope, quoteZObject, returnOnFirstError } = require( './utils.js' );
const { mutate, resolveFunctionCallsAndReferences, MutationType, ZWrapper } = require( './zobject.js' );
const { resolveListType } = require( './builtins.js' );
const { error, normalError } = require( '../function-schemata/javascript/src/error.js' );
const { convertZListToArray } = require( '../function-schemata/javascript/src/utils.js' );
const { validatesAsArgumentReference, validatesAsType } = require( '../function-schemata/javascript/src/schema.js' );

let execute = null;

async function validateAsType( Z1, evaluatorUri, resolver, scope, typeZObject = null ) {
	const wrapInZ9 = ( ZID ) => {
		return ZWrapper.create( {
			Z1K1: 'Z9',
			Z9K1: ZID
		} );
	};
	const genericSchemaValidatorZID = 'Z831';
	const genericValidatorZ8Reference = wrapInZ9( genericSchemaValidatorZID );
	const genericValidatorZ8 = ( await resolveFunctionCallsAndReferences(
		genericValidatorZ8Reference, evaluatorUri, resolver, scope,
		/* originalObject= */ null, /* key= */ null,
		/* ignoreList= */ null ) ).Z22K1;

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
				genericValidatorZ8, evaluatorUri, resolver, scope,
				quoteZObject( Z1 ), quoteZObject( typeZObject ) ],
			'runValidationFunction' ] );
	// TODO (T301532): Find a more reliable way to signal that no additional
	// validation needs to be run. Here we just make sure that we won't run the
	// same function twice by comparing Z8K5 references.
	const resolvedType = ( await resolveFunctionCallsAndReferences(
		typeZObject, evaluatorUri, resolver, scope ) ).Z22K1;
	if ( ( await validatesAsType( resolvedType.asJSON() ) ).isValid() ) {
		const validatorZ8 = ( await mutate( resolvedType, [ 'Z4K3' ], evaluatorUri, resolver, scope ) ).Z22K1;
		if ( validatorZ8.Z8K5.Z9K1 !== genericValidatorZ8.Z8K5.Z9K1 ) {
			const { runTypeValidatorDynamic } = require( './validation.js' );
			callTuples.push(
				[
					runTypeValidatorDynamic,
					[ Z1, typeZObject, evaluatorUri, resolver, scope ],
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
 * @param {string} evaluatorUri URI of native code evaluator service
 * @param {ReferenceResolver} resolver handles resolution of Z9s
 * @param {Frame} scope current variable bindings
 * @param {boolean} doValidate whether to validate types of arguments and return values
 * @return {ArgumentState|null} error state or null if no error encountered
 */
async function resolveTypes( Z1, evaluatorUri, resolver, scope, doValidate = true ) {
	Z1 = ZWrapper.create( Z1 );
	const objectQueue = [ Z1 ];
	while ( objectQueue.length > 0 ) {
		const nextObject = objectQueue.shift();
		if ( await isRefOrString( nextObject ) ) {
			continue;
		}
		const typeEnvelope = await mutate(
			nextObject, [ 'Z1K1' ], evaluatorUri, resolver, scope,
			/* ignoreList= */ null, /* resolveInternals= */ false, doValidate );
		if ( containsError( typeEnvelope ) ) {
			return ArgumentState.ERROR( typeEnvelope.Z22K2 );
		}
		nextObject.Z1K1 = typeEnvelope.Z22K1;
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

	copy( lastFrame = null ) {
		if ( lastFrame === null ) {
			lastFrame = this.lastFrame_.copy();
		}
		const result = new Frame( lastFrame );
		result.names_ = new Map( this.names_ );
		return result;
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

	async processArgument( argumentDict, evaluatorUri, resolver, doValidate, resolveInternals ) {
		// TODO (T296675): "doValidate" is a heavy-handed hack to avoid infinite
		// recursion. Better solutions include
		//  -   validating directly with schemata if the type is built-in,
		//      otherwise using a Function;
		//  -   validating directly with schemata in all the cases where
		//      doValidate is currently false, otherwise using a Function;
		//  -   caching and reusing the results of function calls
		const argumentEnvelope = await resolveFunctionCallsAndReferences(
			argumentDict.argument, evaluatorUri, resolver, this.lastFrame_,
			/* originalObject= */ null, /* key= */ null, /* ignoreList= */ null,
			resolveInternals, doValidate );
		if ( containsError( argumentEnvelope ) ) {
			return ArgumentState.ERROR( argumentEnvelope.Z22K2 );
		}
		const argument = ZWrapper.create( argumentEnvelope.Z22K1 );
		if ( doValidate && resolveInternals ) {
			const typeError = await resolveTypes(
				argument, evaluatorUri, resolver, this.lastFrame_ );
			if ( typeError !== null ) {
				return typeError;
			}
			const actualResult = await validateAsType(
				argument, evaluatorUri, resolver, this.lastFrame_ );
			if ( containsError( actualResult ) ) {
				return ArgumentState.ERROR(
					normalError(
						[ error.object_type_mismatch ],
						[ argument.Z1K1, argument, actualResult.Z22K2 ] ) );
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
	 * @param {string} evaluatorUri URI of native code evaluator service
	 * @param {ReferenceResolver} resolver handles resolution of Z9s
	 * @param {boolean} lazily
	 * @param {boolean} doValidate if false, then the argument will be executed
	 *      without validating return type (if it's a Z7)
	 * @param {boolean} resolveInternals if false, will evaluate typed lists via shortcut
	 *      and will not validate attributes of Z7s
	 * @return {Object} argument instantiated with given name in lowest enclosing scope
	 * along with enclosing scope
	 */
	async retrieveArgument(
		argumentName, evaluatorUri, resolver, lazily = false,
		doValidate = true, resolveInternals = true ) {
		let boundValue = this.names_.get( argumentName );
		let doSetBoundValue = false;

		// Name does not exist in this scope; look in the previous one
		// (or return null if no previous scope).
		if ( boundValue === undefined ) {
			doSetBoundValue = true;
			boundValue = await this.lastFrame_.retrieveArgument(
				argumentName, evaluatorUri, resolver, lazily, doValidate, resolveInternals );
		} else if ( boundValue.state === 'UNEVALUATED' && !lazily ) {
			doSetBoundValue = true;
			// If boundValue is in the ERROR or EVALUATED state, it has already
			// been evaluated and can be returned directly.
			// If state is UNEVALUATED and evaluation is not lazy, the argument
			// may need to be evaluated before returning (e.g., if a Z9, Z18,
			// or Z7).
			const argumentDict = boundValue.argumentDict;
			const evaluatedArgument = await this.processArgument(
				argumentDict, evaluatorUri, resolver, doValidate, resolveInternals );
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
						argument, evaluatorUri, resolver, this.lastFrame_, declaredType );
					if ( containsError( declaredResult ) ) {
						boundValue = ArgumentState.ERROR(
							normalError(
								[ error.argument_type_mismatch ],
								[ declaredType, argument.Z1K1, argument, declaredResult.Z22K2 ] ) );
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
 * @param {string} evaluatorUri URI of native code evaluator service
 * @param {ReferenceResolver} resolver handles resolution of Z9s
 * @param {Frame} scope current variable bindings
 * @param {boolean} doValidate whether to validate types of arguments and return values
 * @return {Array} list of objects containing argument names
 */
async function getArgumentStates( zobject, evaluatorUri, resolver, scope, doValidate = true ) {
	const argumentStates = [];
	const Z7K1Envelope = ( await mutate( zobject, [ 'Z7K1' ], evaluatorUri, resolver, scope, /* ignoreList= */ null, /* resolveInternals= */ true, doValidate ) );
	if ( containsError( Z7K1Envelope ) ) {
		return [ ArgumentState.ERROR( 'Could not dereference Z7K1' ) ];
	}
	const Z8K1Envelope = ( await mutate( Z7K1Envelope.Z22K1, [ 'Z8K1' ], evaluatorUri, resolver, scope, /* ignoreList= */ null, /* resolveInternals= */ false, doValidate ) );
	// This usually happens because dereferencing can't occur during validation
	// (and is expected).
	if ( containsError( Z8K1Envelope ) ) {
		return [ ArgumentState.ERROR( 'Could not dereference Z8K1' ) ];
	}
	const Z8K1 = Z8K1Envelope.Z22K1;
	const foundKeys = new Set( zobject.keys() );
	foundKeys.delete( 'Z1K1' );
	foundKeys.delete( 'Z7K1' );
	for ( const Z17 of convertZListToArray( Z8K1 ) ) {
		const argumentDict = {};
		const argumentName = ( await mutate(
			Z17, [ 'Z17K2', 'Z6K1' ], evaluatorUri, resolver, scope,
			/* ignoreList= */ null, /* resolveInternals= */ false, doValidate ) ).Z22K1;
		argumentDict.name = argumentName;
		// TODO (T292787): This is flaky to rely on; find a better way to determine type.
		const declaredType = ( await mutate(
			Z17, [ 'Z17K1' ], evaluatorUri, resolver, scope,
			/* ignoreList= */ null, /* resolveInternals= */ false, doValidate ) ).Z22K1;
		argumentDict.declaredType = declaredType;
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
 * @param {Object} result
 * @param {Object} zobject
 * @param {string} evaluatorUri URI of native code evaluator service
 * @param {ReferenceResolver} resolver handles resolution of Z9s
 * @param {Frame} scope current variable bindings
 * @return {Object} zobject if validation succeeds; error tuple otherwise
 */
async function validateReturnType( result, zobject, evaluatorUri, resolver, scope ) {
	// eslint-disable-next-line no-bitwise
	const thebits = ( ( await containsValue( result ) ) << 1 ) | containsError( result );

	if ( thebits === 0 ) {
		// Neither value nor error.
		return makeWrappedResultEnvelope(
			null,
			normalError(
				[ error.not_wellformed_value ],
				[ 'Function evaluation returned an empty object.' ] ) );
	} else if ( thebits === 2 ) {
		// Value returned; validate its return type..
		const Z7K1 = ( await mutate( zobject, [ 'Z7K1' ], evaluatorUri, resolver, scope ) ).Z22K1;
		const returnType = ( await mutate( Z7K1, [ 'Z8K2' ], evaluatorUri, resolver, scope ) ).Z22K1;
		const returnTypeValidation = await validateAsType(
			result.Z22K1, evaluatorUri, resolver, scope, returnType );
		if ( containsError( returnTypeValidation ) ) {
			return makeWrappedResultEnvelope(
				null,
				normalError(
					[ error.return_type_mismatch ],
					[ returnType, result.Z22K1.Z1K1, result.Z22K1, returnTypeValidation.Z22K2 ] ) );
		}
	} else if ( thebits === 3 ) {
		// Both value and error.
		return makeWrappedResultEnvelope(
			null,
			normalError(
				[ error.not_wellformed_value ],
				[ 'Function evaluation returned both a value and an error.' ] ) );
	}
	return result;
}

async function executeInternal(
	zobject, evaluatorUri, resolver, scope, doValidate = true,
	implementationSelector = null, resolveInternals = true ) {

	const typeKey = await createZObjectKey( zobject );
	if ( typeKey.ZID_ === 'Z881' && !resolveInternals ) {
		// TODO (T305459): Tighten number cases where `resolveInternals` is set to false.
		return ZWrapper.create( await resolveListType( zobject.Z881K1 ) );
	}

	// Retrieve argument declarations and instantiations.
	const argumentStates = await getArgumentStates( zobject, evaluatorUri, resolver, scope );
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
		scope.setArgument( argumentState.argumentDict.name, argumentState );
	}

	// Ensure Z8 (Z7K1) is dereferenced. Also ensure implementations are
	// dereferenced (Z8K4 and all elements thereof).
	const Z8K4Envelope = await mutate(
		zobject, [ 'Z7K1', 'Z8K4' ], evaluatorUri, resolver, scope,
		/* ignoreList= */ null, /* resolveInternals= */ false, doValidate );
	if ( containsError( Z8K4Envelope ) ) {
		return Z8K4Envelope;
	}
	const Z8K4 = Z8K4Envelope.Z22K1;
	const implementations = [];

	for ( let Z14 of convertZListToArray( Z8K4 ) ) {
		Z14 = ( await resolveFunctionCallsAndReferences(
			Z14, evaluatorUri, resolver, scope, /* originalObject= */null,
			/* key= */null, /* ignoreList= */null, /* resolveInternals= */ false,
			doValidate ) ).Z22K1;
		for ( const key of [ 'Z14K2', 'Z14K3', 'Z14K4' ] ) {
			if ( Z14[ key ] !== undefined ) {
				const implementationInternalEnvelope = (
					await resolveFunctionCallsAndReferences(
						Z14[ key ], evaluatorUri, resolver, scope, /* originalObject= */null,
						/* key= */null, /* ignoreList= */null, /* resolveInternals= */ false,
						doValidate ) );
				if ( containsError( implementationInternalEnvelope ) ) {
					return implementationInternalEnvelope;
				}
				Z14[ key ] = implementationInternalEnvelope.Z22K1;
			}
		}
		implementations.push( Z14 );
	}

	if ( implementations === [] ) {
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

	const argumentInstantiations = [];
	if ( !( implementation instanceof Composition ) ) {
		// Populate arguments from scope.
		const instantiationPromises = [];
		for ( const argumentState of argumentStates ) {
			const argumentDict = argumentState.argumentDict;
			instantiationPromises.push(
				scope.retrieveArgument(
					argumentDict.name, evaluatorUri, resolver,
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
	implementation.setScope( scope );
	implementation.setResolver( resolver );
	implementation.setEvaluatorUri( evaluatorUri );
	implementation.setDoValidate( doValidate );
	let result = await implementation.execute( zobject, argumentInstantiations );

	// Execute result if implementation is lazily evaluated.
	if ( implementation.returnsLazy() ) {
		result = await mutate( result, [ 'Z22K1' ], evaluatorUri, resolver, scope,
			/* ignoreList= */ null, /* resolveInternals= */ true, doValidate );
	}
	if ( doValidate && resolveInternals ) {
		result = await validateReturnType( result, zobject, evaluatorUri, resolver, scope );
	}
	return result;
}

async function resolveDanglingReferences( zobject, evaluatorUri, resolver, scope ) {
	let keys = [];
	if ( zobject instanceof ZWrapper ) {
		keys = zobject.keys();
	}
	for ( const key of keys ) {
		let oldValue = zobject[ key ];
		let oldValueJSON = oldValue;
		if ( oldValueJSON instanceof ZWrapper ) {
			oldValueJSON = oldValueJSON.asJSON();
		}
		if ( ( await validatesAsArgumentReference( oldValueJSON ) ).isValid() ) {
			const valueEnvelope = await resolveFunctionCallsAndReferences(
				oldValue, evaluatorUri, resolver, scope,
				/* originalObject= */ null, /* key= */ null,
				/* ignoreList= */ new Set( [
					MutationType.REFERENCE, MutationType.FUNCTION_CALL,
					MutationType.GENERIC_INSTANCE
				] ), /* resolveInternals= */ false, /* doValidate= */ true
			);
			if ( valueEnvelope.Z22K1 instanceof ZWrapper ) {
				if ( oldValue instanceof ZWrapper ) {
					valueEnvelope.Z22K1.setScope( oldValue.getScope() );
				} else {
					valueEnvelope.Z22K1.setScope( zobject.getScope() );
				}
			}
			oldValue = valueEnvelope.Z22K1;
		}
		const newValue = await resolveDanglingReferences(
			oldValue, evaluatorUri, resolver, scope );
		zobject[ key ] = newValue;
	}
	return zobject;
}

/**
 * Accepts a function call, retrieves the appropriate implementation, and tries
 * to execute with supplied arguments.
 *
 * @param {Object} zobject object describing a function call
 * @param {string} evaluatorUri URI of native code evaluator service
 * @param {ReferenceResolver} resolver handles resolution of Z9s
 * @param {Frame} oldScope current variable bindings
 * @param {boolean} doValidate whether to validate types of arguments and return value
 * @param {ImplementationSelector} implementationSelector
 * @param {boolean} resolveInternals if false, will evaluate typed lists via shortcut
 *      and will not validate attributes of Z7s
 * @param {boolean} topLevel whether this is the top-level Z7 sent to the orchestrator
 * @return {Object} result of executing function call
 */
execute = async function (
	zobject, evaluatorUri, resolver, oldScope = null, doValidate = true,
	implementationSelector = null, resolveInternals = true, topLevel = false ) {
	const scope = new Frame( oldScope );
	const result = ZWrapper.create( await executeInternal(
		zobject, evaluatorUri, resolver, scope, doValidate,
		implementationSelector, resolveInternals ) );
	result.setScope( scope );
	if ( topLevel ) {
		result.Z22K1 = await resolveDanglingReferences(
			result.Z22K1, evaluatorUri, resolver, scope );
	}
	return result;
};

module.exports = { execute, getArgumentStates };
