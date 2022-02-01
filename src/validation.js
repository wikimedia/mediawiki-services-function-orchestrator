'use strict';

const traverse = require( 'json-schema-traverse' );
const { execute } = require( './execute.js' );
const { containsError, createSchema } = require( './utils.js' );
const { error, normalError } = require( '../function-schemata/javascript/src/error.js' );
const { ZObjectKeyFactory } = require( '../function-schemata/javascript/src/schema.js' );
const { convertZListToArray, makeResultEnvelope } = require( '../function-schemata/javascript/src/utils.js' );

const validators = new Map();

/**
 * Returns a validator schema for the given ZID.
 *
 * @param {Object} Z1 the type ZObject
 * @return {Schema} a fully-initialized Schema or null if unsupported.
 */
function getSchemaValidator( Z1 ) {
	const result = {
		typeKey: null,
		schemaValidator: null
	};
	result.typeKey = ZObjectKeyFactory.create( Z1.Z1K1 );
	if ( result.typeKey.type() === 'GenericTypeKey' ) {
		return result;
	}
	const keyString = result.typeKey.asString();
	if ( !validators.has( keyString ) ) {
		validators.set( keyString, createSchema( Z1 ) );
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
		const argumentValue = { ...Z1s.shift() };
		result[ argument.Z17K2.Z6K1 ] = {
			Z1K1: {
				Z1K1: 'Z9',
				Z9K1: 'Z99'
			},
			Z99K1: argumentValue
		};
	}
	return result;
}

async function runValidationFunction( Z8Reference, resolver, ...Z1s ) {
	const dereferenced = await resolver.dereference( [ Z8Reference ] );
	const validatorZ8 = dereferenced[ Z8Reference ].Z2K2;
	const validatorZ7 = createValidatorZ7( validatorZ8, ...Z1s );
	return await execute( validatorZ7, null, resolver, null, /* doValidate= */ false );
}

/**
 * Validates the Z1/Object against its type validator and returns an array of Z5/Error.
 *
 * @param {Object} Z1 the Z1/Object
 * @param {Object} typeZObject the type ZObject
 * @param {ReferenceResolver} resolver used to resolve references
 * @return {Array} an array of Z5/Error
 */
async function runTypeValidator( Z1, typeZObject, resolver ) {
	const validatorZid = typeZObject.Z2K2.Z4K3;

	try {
		// TODO (T296681): Catch errors when async functions reject.
		return await runValidationFunction( validatorZid.Z9K1, resolver, Z1 );
	} catch ( err ) {
		console.error( err );
		return makeResultEnvelope( null, normalError(
			[ error.zid_not_found ],
			[ `Builtin validator "${validatorZid.Z9K1}" not found for "${typeZObject.Z2K1.Z6K1}"` ]
		) );
	}
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

	traverse( zobject, { allKeys: true }, function ( Z1 ) {
		const typeKey = ZObjectKeyFactory.create( Z1.Z1K1 );
		const key = typeKey.asString();
		// TODO (T297717): We should add other types to the set, not just builtins.
		if ( typeKey.type() === 'SimpleTypeKey' ) {
			containedTypes.add( key );
		}
	} );

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
	const typeValidatorPromises = [];
	const ZObjectTypes = await getContainedTypeZObjects( zobject, resolver );

	traverse( zobject, { allKeys: true }, ( Z1 ) => {
		let validatorTuple;
		try {
			validatorTuple = getSchemaValidator( Z1 );
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
		if ( !schemaValidator.validate( Z1 ) ) {
			errors.push(
				normalError(
					[ error.not_wellformed ],
					// TODO (T296676): Return validator Z5 errors.
					[ 'Could not validate object: ' + JSON.stringify( Z1 ) ]
				)
			);
		} else {
			typeValidatorPromises.push(
				runTypeValidator( Z1, ZObjectTypes[ typeKey.asString() ], resolver )
			);
		}
	} );

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
	runValidationFunction,
	validate
};
