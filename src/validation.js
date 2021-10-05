'use strict';

const traverse = require( 'json-schema-traverse' );
const { Z10ToArray } = require( '../function-schemata/javascript/src/utils.js' );
const { error, normalError } = require( '../function-schemata/javascript/src/error.js' );
const { execute } = require( './execute.js' );
const { createSchema, getTypeZID, isRefOrString } = require( './utils.js' );

const validators = new Map();
const dontValidate = new Set( [ 'Z18', 'Z9' ] );

/**
 * Returns a validator schema for the given ZID.
 *
 * @param {string} ZID type identifier of Z1
 * @param {Object} Z1 the type ZObject
 * @return {Schema} a fully-initialized Schema or null if unsupported.
 */
function getSchemaValidator( ZID, Z1 ) {
	// TODO(T286936): Figure out why non-sequential error pops with duplicate keys.
	// TODO(T286939): Figure out why Z9 and Z18 validation doesn't work.
	if ( dontValidate.has( ZID ) ) {
		return null;
	}
	let validator;
	if ( validators.has( ZID ) ) {
		validator = validators.get( ZID );
	} else {
		validator = createSchema( Z1 );
		if ( ZID !== null ) {
			// TODO: Should never be null.
			validators.set( ZID, validator );
		}
	}
	return validator;
}

function createValidatorZ7( Z8, Z1 ) {
	// since this is a validator, we always expect a SINGLE argument (the object itself).
	const argument = Z10ToArray( Z8.Z8K1 )[ 0 ];
	const argumentValue = { ...Z1 };

	return {
		Z1K1: {
			Z1K1: 'Z9',
			Z9K1: 'Z7'
		},
		Z7K1: Z8,
		[ argument.Z17K2.Z6K1 ]: {
			Z1K1: {
				Z1K1: 'Z9',
				Z9K1: 'Z99'
			},
			Z99K1: argumentValue
		}
	};
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
		// TODO: Catch errors when async functions reject.
		const dereferenced = await resolver.dereference( [ validatorZid.Z9K1 ] );
		const validatorZ8 = dereferenced[ validatorZid.Z9K1 ].Z2K2;
		const validatorZ7 = createValidatorZ7( validatorZ8, Z1 );
		const result = await execute( validatorZ7, null, resolver, null );
		return Z10ToArray( result.Z22K1 );
	} catch ( err ) {
		console.error( err );
		return [
			normalError(
				[ error.zid_not_found ],
				[ `Builtin validator "${validatorZid.Z9K1}" not found for "${typeZObject.Z2K1.Z9K1}"` ]
			)
		];
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

	traverse( zobject, { allKeys: true }, ( Z1 ) =>
		containedTypes.add( isRefOrString( Z1 ) ? Z1.Z1K1 : Z1.Z1K1.Z9K1 )
	);

	return await resolver.dereference( containedTypes );
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
	const validatorPromises = [];
	const ZObjectTypes = await getContainedTypeZObjects( zobject, resolver );

	traverse( zobject, { allKeys: true }, ( Z1 ) => {
		// TODO(T292787): What about ZID collisions of user-defined/generic types?
		// TODO(T292787): Consider just keying this on Z1K1.
		const ZID = getTypeZID( Z1 );
		const schemaValidator = getSchemaValidator( Z1, ZID );
		if ( schemaValidator === null ) {
			return;
		}

		// TODO: Find a way to allow Boolean literals, e.g. "Z41"
		if ( !schemaValidator.validate( Z1 ) ) {
			errors.push(
				normalError(
					[ error.not_wellformed ],
					// TODO: improve this message, maybe look at schemaValidator.errors
					[ 'Invalid schema for ' + ZID + ' with object: ' + JSON.stringify( Z1 ) ]
				)
			);
		} else {
			validatorPromises.push( runTypeValidator( Z1, ZObjectTypes[ ZID ], resolver ) );
		}
	} );

	const validatorErrors = await Promise.all( validatorPromises );
	validatorErrors.forEach( ( typeErrors ) =>
		errors.push.apply( errors, typeErrors )
	);

	return errors;
}

module.exports = { validate };
