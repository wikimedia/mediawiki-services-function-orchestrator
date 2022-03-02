'use strict';

const { execute } = require( './execute.js' );
const { mutate } = require( './zobject.js' );
const { containsError, createSchema, quoteZObject } = require( './utils.js' );
const { error, normalError } = require( '../function-schemata/javascript/src/error.js' );
const { validatesAsFunctionCall, ZObjectKeyFactory } = require( '../function-schemata/javascript/src/schema.js' );
const { convertZListToArray, isString, makeResultEnvelope } = require( '../function-schemata/javascript/src/utils.js' );

const validators = new Map();

/**
 * Returns a validator schema for the given ZID.
 *
 * @param {Object} Z1 the type ZObject
 * @return {Schema} a fully-initialized Schema or null if unsupported.
 */
async function getSchemaValidator( Z1 ) {
	const result = {
		typeKey: null,
		schemaValidator: null
	};
	result.typeKey = await ZObjectKeyFactory.create( Z1.Z1K1 );
	if ( result.typeKey.type() === 'GenericTypeKey' ) {
		return result;
	}
	const keyString = result.typeKey.asString();
	if ( !validators.has( keyString ) ) {
		validators.set( keyString, await createSchema( Z1 ) );
	}
	result.schemaValidator = validators.get( keyString );
	return result;
}

function createValidatorZ7( Z8, ...Z1s ) {
	const argumentDeclarations = convertZListToArray( Z8.Z8K1 );
	if ( argumentDeclarations.length !== Z1s.length ) {
		// TODO (T2926668): Call BUILTIN_FUNCTION_CALL_VALIDATOR_ on result to
		// avoid argument mismatches.
	}
	const result = {
		Z1K1: {
			Z1K1: 'Z9',
			Z9K1: 'Z7'
		},
		Z7K1: Z8
	};
	for ( const argument of argumentDeclarations ) {
		result[ argument.Z17K2.Z6K1 ] = { ...Z1s.shift() };
	}
	return result;
}

async function runValidationFunction( Z8, evaluatorUri, resolver, scope, ...Z1s ) {
	const validatorZ7 = createValidatorZ7( Z8, ...Z1s );
	return await execute( validatorZ7, evaluatorUri, resolver, scope, /* doValidate= */ false );
}

/**
 * Validates the Z1/Object against its type validator and returns an array of Z5/Error.
 *
 * @param {Object} Z1 the Z1/Object
 * @param {Object} Z4 the type ZObject
 * @param {string} evaluatorUri URI of native code evaluator service
 * @param {ReferenceResolver} resolver used to resolve references
 * @param {Scope} scope current variable bindings
 * @return {Array} an array of Z5/Error
 */
async function runTypeValidator( Z1, Z4, evaluatorUri, resolver, scope ) {
	const validationFunction = ( await mutate( Z4, [ 'Z4K3' ], evaluatorUri, resolver, scope ) ).Z22K1;

	try {
		// TODO (T296681): Catch errors when async functions reject.
		return await runValidationFunction(
			validationFunction, evaluatorUri, resolver, scope, quoteZObject( Z1 ),
			quoteZObject( Z4 ) );
	} catch ( err ) {
		console.error( err );
		return makeResultEnvelope( null, normalError(
			[ error.zid_not_found ],
			[ `Builtin validator "${validationFunction.Z8K5.Z9K1}" not found for "${Z4.Z4K1.Z9K1}"` ]
		) );
	}
}

/**
 * Dynamically validates the Z1/Object against its type validator and returns
 * an array of Z5/Error.
 *
 * TODO (T302750): Find a better way to handle this than two separate "runTypeValidator"
 * functions.
 *
 * @param {Object} Z1 the Z1/Object
 * @param {Object} Z4 the type ZObject
 * @param {string} evaluatorUri URI of native code evaluator service
 * @param {ReferenceResolver} resolver used to resolve references
 * @param {Scope} scope current variable bindings
 * @return {Array} an array of Z5/Error
 */
async function runTypeValidatorDynamic( Z1, Z4, evaluatorUri, resolver, scope ) {
	const validationFunction = ( await mutate( Z4, [ 'Z4K3' ], evaluatorUri, resolver, scope ) ).Z22K1;

	try {
		// TODO (T296681): Catch errors when async functions reject.
		return await runValidationFunction(
			validationFunction, evaluatorUri, resolver, scope, Z1, Z4 );
	} catch ( err ) {
		console.error( err );
		return makeResultEnvelope( null, normalError(
			[ error.zid_not_found ],
			[ `Builtin validator "${validationFunction.Z8K5.Z9K1}" not found for "${Z4.Z4K1.Z9K1}"` ]
		) );
	}
}

async function traverseInternal( ZObject, callback, promises ) {
	if ( isString( ZObject ) ) {
		return;
	}
	promises.push( callback( ZObject ) );
	let keys;
	if ( ( await validatesAsFunctionCall( ZObject ) ).isValid() ) {
		keys = [ 'Z1K1', 'Z7K1' ];
	} else {
		keys = Object.keys( ZObject );
	}
	for ( const key of keys ) {
		await traverseInternal( ZObject[ key ], callback, promises );
	}
}

async function traverseOmittingFunctionCallInputs( ZObject, callback ) {
	const promises = [];
	await traverseInternal( ZObject, callback, promises );
	await Promise.all( promises );
}

/**
 * Utility function that traverses the given ZObject to identify all of the types contained in it
 * and return their ZObjects. The ZObjects are fetched from the database.
 *
 * @param {Object} zobject the zobject in normal.
 * @param {ReferenceResolver} resolver used to resolve references
 * @return {Object} an object mapping the ZID to the ZObject of the type.
 */
async function getContainedTypeZObjects( zobject, resolver ) {
	const containedTypes = new Set();

	const promises = [];
	await traverseOmittingFunctionCallInputs( zobject, function ( Z1 ) {
		promises.push( ( async function () {
			const typeKey = await ZObjectKeyFactory.create( Z1.Z1K1 );
			const key = typeKey.asString();
			// TODO (T297717): We should add other types to the set, not just builtins.
			if ( typeKey.type() === 'SimpleTypeKey' ) {
				containedTypes.add( key );
			}
		} )() );
	} );
	await Promise.all( promises );

	const result = await resolver.dereference( containedTypes );
	return result;
}

/**
 * Traverses the given zobject and validates each node checking its schema and running its type
 * validator.
 *
 * @param {Object} zobject the zobject in normal form.
 * @param {ReferenceResolver} resolver used to resolve references
 * @return {Array} an array of validation errors.
 */
async function validate( zobject, resolver ) {

	const errors = [];
	const ZObjectTypes = await getContainedTypeZObjects( zobject, resolver );
	const traversalPromises = [];
	const typeValidatorPromises = [];

	await traverseOmittingFunctionCallInputs( zobject, ( Z1 ) => {
		traversalPromises.push( ( async function () {
			let validatorTuple;
			try {
				validatorTuple = await getSchemaValidator( Z1 );
			} catch ( error ) {
				console.error( 'Attempting to validate Z1', Z1, 'produced error', error );
				errors.push(
					normalError(
						[ error.zid_not_found ],
						[ error.message ] ) );
				return;
			}
			const {
				typeKey,
				schemaValidator
			} = validatorTuple;
			if ( schemaValidator === null ) {
				return;
			}
			if ( ZObjectTypes[ typeKey.asString() ] === undefined ) {
				// TODO (T297717): We should add other types to the set, not just builtins.
				return;
			}
			const theStatus = await schemaValidator.validateStatus( Z1 );
			if ( !theStatus.isValid() ) {
				errors.push( theStatus.getZ5() );
			} else {
				typeValidatorPromises.push(
					runTypeValidator(
						Z1, ZObjectTypes[ typeKey.asString() ].Z2K2, /* evaluatorUri= */null,
						resolver, /* scope= */null )
				);
			}
		} )() );
	} );

	await Promise.all( traversalPromises );
	const typeValidatorResults = await Promise.all( typeValidatorPromises );

	typeValidatorResults
		.filter( containsError )
		.forEach( ( result ) => {
			const error = result.Z22K2;

			// if this is a Z509/Multiple errors it will be flattened
			if ( error.Z5K1.Z9K1 === 'Z509' ) {
				errors.push.apply( errors, convertZListToArray( error.Z5K2.K1 ) );
			} else {
				errors.push( error );
			}
		} );

	return errors;
}

module.exports = {
	runTypeValidator,
	runTypeValidatorDynamic,
	runValidationFunction,
	validate
};
