'use strict';

const { Composition, Implementation } = require( './implementation.js' );
const { RandomImplementationSelector } = require( './implementationSelector.js' );
const { containsError, containsValue, isRefOrString, traverseZ10 } = require( './utils.js' );
const { mutate } = require( './zobject.js' );
const { error, normalError } = require( '../function-schemata/javascript/src/error.js' );
const { makeResultEnvelope, convertZListToArray } = require( '../function-schemata/javascript/src/utils.js' );

let execute = null;

class ArgumentState {

	constructor() {
		this.state = null;
		this.argumentDict = null;
		this.error = null;
	}

	static UNEVALUATED( argumentDict ) {
		const result = new ArgumentState();
		result.argumentDict = argumentDict;
		result.state = 'UNEVALUATED';
		return result;
	}

	static EVALUATED( argumentDict ) {
		const result = new ArgumentState();
		result.argumentDict = argumentDict;
		result.state = 'EVALUATED';
		return result;
	}

	static ERROR( error ) {
		const result = new ArgumentState();
		result.error = error;
		result.state = 'ERROR';
		return result;
	}

}

class BaseFrame {

	constructor( lastFrame = null ) {
		this.lastFrame_ = lastFrame;
		this.names_ = new Map();
	}

}

class EmptyFrame extends BaseFrame {
	constructor() {
		super();
	}

	async retrieveArgument( argumentName ) {
		return ArgumentState.ERROR(
			normalError(
				// TODO (T287919): Reconsider error type.
				[ error.invalid_key ],
				[ 'No argument called ' + argumentName + ' in scope.' ] ) );
	}
}

async function validateAsType( Z1, resolver, typeZObject = null ) {
	// TODO (T294275): Retrieve Z2s for generic Z4s and call runValidationFunction
	// here; this Z8 here is a nasty hack.
	const Z8Reference = 'Z831';

	if ( typeZObject === null ) {
		typeZObject = Z1.Z1K1;
	}

	// TODO (T292787): Make this more elegant--should be possible to avoid
	// passing strings in the first place.
	if ( typeof typeZObject === 'string' || typeZObject instanceof String ) {
		typeZObject = { Z1K1: 'Z9', Z9K1: typeZObject };
	}
	const { runValidationFunction } = require( './validation.js' );
	return await runValidationFunction( Z8Reference, resolver, Z1, typeZObject );
}

/**
 * Traverses a ZObject and resolves all Z1K1s.
 *
 * @param {Object} Z1 object whose Z1K1s are to be resolved
 * @param {string} evaluatorUri URI of native code evaluator service
 * @param {ReferenceResolver} resolver handles resolution of Z9s
 * @param {Scope} scope current variable bindings
 * @return {ArgumentState|null} error state or null if no error encountered
 */
async function resolveTypes( Z1, evaluatorUri, resolver, scope ) {
	const objectQueue = [ Z1 ];
	while ( objectQueue.length > 0 ) {
		const nextObject = objectQueue.shift();
		if ( isRefOrString( nextObject ) ) {
			continue;
		}
		const typeEnvelope = await mutate(
			nextObject, [ 'Z1K1' ], evaluatorUri, resolver, scope );
		if ( containsError( typeEnvelope ) ) {
			return ArgumentState.ERROR( typeEnvelope.Z22K2 );
		}
		nextObject.Z1K1 = typeEnvelope.Z22K1;
		for ( const key of Object.keys( nextObject ) ) {
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

	async processArgument( argumentDict, evaluatorUri, resolver, doValidate ) {
		// TODO (T296675): "doValidate" is a heavy-handed hack to avoid infinite
		// recursion. Better solutions include
		//  -   validating directly with schemata if the type is built-in,
		//      otherwise using a Function;
		//  -   validating directly with schemata in all the cases where
		//      doValidate is currently false, otherwise using a Function;
		//  -   caching and reusing the results of function calls
		const argumentEnvelope = await mutate( argumentDict, [ 'argument' ], evaluatorUri, resolver, this.lastFrame_ );
		if ( containsError( argumentEnvelope ) ) {
			return ArgumentState.ERROR( argumentEnvelope.Z22K2 );
		}
		const argument = argumentEnvelope.Z22K1;
		const typeError = await resolveTypes( argument, evaluatorUri, resolver, this.lastFrame_ );
		if ( typeError !== null ) {
			return typeError;
		}
		if ( doValidate ) {
			const actualResult = await validateAsType( argument, resolver );
			if ( containsError( actualResult ) ) {
				// TODO (T296676): Include Z5 information from validator in this error.
				return ArgumentState.ERROR(
					normalError(
						[ error.argument_type_mismatch ],
						[ 'Could not validate argument ' + JSON.stringify( argument ) + ' as apparent type ' + JSON.stringify( argument.Z1K1 ) ] ) );
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
	 * @return {Object} argument instantiated with given name in lowest enclosing scope
	 * along with enclosing scope
	 */
	async retrieveArgument(
		argumentName, evaluatorUri, resolver, lazily = false,
		doValidate = true ) {
		let boundValue = this.names_.get( argumentName );
		let doSetBoundValue = false;

		// Name does not exist in this scope; look in the previous one
		// (or return null if no previous scope).
		if ( boundValue === undefined ) {
			doSetBoundValue = true;
			boundValue = await this.lastFrame_.retrieveArgument(
				argumentName, evaluatorUri, resolver, lazily, doValidate );
		} else if ( boundValue.state === 'UNEVALUATED' && !lazily ) {
			doSetBoundValue = true;
			// If boundValue is in the ERROR or EVALUATED state, it has already
			// been evaluated and can be returned directly.
			// If state is UNEVALUATED and evaluation is not lazy, the argument
			// may need to be evaluated before returning (e.g., if a Z9, Z18,
			// or Z7).
			const argumentDict = boundValue.argumentDict;
			const evaluatedArgument = await this.processArgument(
				argumentDict, evaluatorUri, resolver, doValidate );
			if ( evaluatedArgument.state === 'ERROR' ) {
				boundValue = evaluatedArgument;
			} else if ( evaluatedArgument.state === 'EVALUATED' ) {
				const newDict = {
					name: argumentName,
					argument: evaluatedArgument.argumentDict.argument,
					declaredType: argumentDict.declaredType
				};
				boundValue = ArgumentState.EVALUATED( newDict );
				if ( doValidate ) {
					const argument = newDict.argument;
					const declaredType = newDict.declaredType;
					const declaredResult = await validateAsType(
						argument, resolver, declaredType );
					if ( containsError( declaredResult ) ) {
						// TODO (T296676): Include Z5 information from validator in this error.
						boundValue = ArgumentState.ERROR(
							normalError(
								[ error.argument_type_mismatch ],
								[ 'Could not validate argument ' + JSON.stringify( argument ) + ' as declared type ' + JSON.stringify( declaredType ) ] ) );
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
 * @param {Scope} scope current variable bindings
 * @return {Array} list of objects containing argument names
 */
async function getArgumentStates( zobject, evaluatorUri, resolver, scope ) {
	const argumentStates = [];
	const Z8K1Envelope = ( await mutate( zobject, [ 'Z7K1', 'Z8K1' ], evaluatorUri, resolver, scope ) );
	// This usually happens because dereferencing can't occur during validation
	// (and is expected).
	if ( containsError( Z8K1Envelope ) ) {
		return [ ArgumentState.ERROR( 'Could not dereference Z8K1' ) ];
	}
	const Z8K1 = Z8K1Envelope.Z22K1;
	const foundKeys = new Set( Object.keys( zobject ) );
	foundKeys.delete( 'Z1K1' );
	foundKeys.delete( 'Z7K1' );
	for ( const Z17 of convertZListToArray( Z8K1 ) ) {
		const argumentDict = {};
		const argumentName = ( await mutate( Z17, [ 'Z17K2', 'Z6K1' ], evaluatorUri, resolver, scope ) ).Z22K1;
		argumentDict.name = argumentName;
		// TODO (T292787): This is flaky to rely on; find a better way to determine type.
		const declaredType = ( await mutate( Z17, [ 'Z17K1' ], evaluatorUri, resolver, scope ) ).Z22K1;
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
 * @param {Scope} scope current variable bindings
 * @return {Object} zobject if validation succeeds; error tuple otherwise
 */
async function validateReturnType( result, zobject, evaluatorUri, resolver, scope ) {
	// eslint-disable-next-line no-bitwise
	const thebits = ( containsValue( result ) << 1 ) | containsError( result );

	if ( thebits === 0 ) {
		// Neither value nor error.
		return makeResultEnvelope(
			null,
			normalError(
				[ error.not_wellformed_value ],
				[ 'Function evaluation returned an empty object.' ] ) );
	} else if ( thebits === 2 ) {
		// Value returned; validate its return type..
		const Z7K1 = ( await mutate( zobject, [ 'Z7K1' ], evaluatorUri, resolver, scope ) ).Z22K1;
		const returnType = ( await mutate( Z7K1, [ 'Z8K2' ], evaluatorUri, resolver, scope ) ).Z22K1;
		const returnTypeValidation = await validateAsType( result.Z22K1, resolver, returnType );
		if ( containsError( returnTypeValidation ) ) {
			// TODO (T296676): Include Z5 information from validator in this error.
			return makeResultEnvelope(
				null,
				normalError(
					[ error.argument_type_mismatch ],
					[ 'Could not validate return value as type ' + JSON.stringify( returnType ) ] ) );
		}
	} else if ( thebits === 3 ) {
		// Both value and error.
		return makeResultEnvelope(
			null,
			normalError(
				[ error.not_wellformed_value ],
				[ 'Function evaluation returned both a value and an error.' ] ) );
	}
	return result;
}

/**
 * Accepts a function call, retrieves the appropriate implementation, and tries
 * to execute with supplied arguments.
 *
 * @param {Object} zobject object describing a function call
 * @param {string} evaluatorUri URI of native code evaluator service
 * @param {ReferenceResolver} resolver handles resolution of Z9s
 * @param {Scope} oldScope current variable bindings
 * @param {boolean} doValidate whether to validate types of arguments and return value
 * @param {ImplementationSelector} implementationSelector
 * @return {Object} result of executing function call
 */
execute = async function (
	zobject, evaluatorUri, resolver, oldScope = null, doValidate = true,
	implementationSelector = null ) {
	const scope = new Frame( oldScope );

	// Retrieve argument declarations and instantiations.
	const argumentStates = await getArgumentStates( zobject, evaluatorUri, resolver, scope );
	for ( const argumentState of argumentStates ) {
		if ( argumentState.state === 'ERROR' ) {
			return makeResultEnvelope(
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
	const Z8K4 = ( await mutate( zobject, [ 'Z7K1', 'Z8K4' ], evaluatorUri, resolver, scope ) ).Z22K1;
	const implementations = [];
	await traverseZ10( Z8K4, async function ( tail ) {
		// TODO (T296679): Write test making sure that Z14s are resolved.
		const Z10K1 = ( await mutate( tail, [ 'Z10K1' ], evaluatorUri, resolver, scope ) ).Z22K1;
		implementations.push( Z10K1 );
	} );

	if ( implementations === [] ) {
		return makeResultEnvelope(
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
		return makeResultEnvelope(
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
				return makeResultEnvelope( null, instantiation.error );
			}
			argumentInstantiations.push( instantiation.argumentDict );
		}
	}

	// Equip the implementation for its journey and execute.
	implementation.setScope( scope );
	implementation.setResolver( resolver );
	implementation.setEvaluatorUri( evaluatorUri );
	let result = await implementation.execute( zobject, argumentInstantiations );

	// Execute result if implementation is lazily evaluated.
	if ( implementation.returnsLazy() ) {
		result = await mutate( result, [ 'Z22K1' ], evaluatorUri, resolver, scope );
	}
	if ( doValidate ) {
		result = await validateReturnType( result, zobject, evaluatorUri, resolver, scope );
	}
	return result;
};

module.exports = { execute, getArgumentStates };
