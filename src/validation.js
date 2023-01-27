'use strict';

const { execute } = require( './execute.js' );
const { Invariants } = require( './Invariants.js' );
const { ZWrapper } = require( './ZWrapper' );
const { responseEnvelopeContainsError, createSchema, createZObjectKey, quoteZObject, makeWrappedResultEnvelope } = require( './utils.js' );
const { error, makeErrorInNormalForm } = require( '../function-schemata/javascript/src/error.js' );
const { validatesAsFunctionCall } = require( '../function-schemata/javascript/src/schema.js' );
const { convertZListToItemArray, isString, getError } = require( '../function-schemata/javascript/src/utils.js' );
const { EmptyFrame } = require( './frame.js' );
const { Schema } = require( '../function-schemata/javascript/src/schema.js' );

const validators = new Map();

/**
 * Returns a validator schema for the given ZID.
 *
 * @param {Object} Z1 the type ZObject
 * @return {Schema} a fully-initialized Schema or null if unsupported.
 */
function getSchemaValidator( Z1 ) {
	Z1 = Z1.asJSON();
	const result = {
		typeKey: null,
		schemaValidator: null
	};
	result.typeKey = createZObjectKey( Z1.Z1K1 );
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
	const argumentDeclarations = convertZListToItemArray( Z8.Z8K1 );
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
	// TBD: Possibly arrange to convert to ZWrapper here instead of below
	for ( const argument of argumentDeclarations ) {
		// TODO (T315232): Eliminate this ZWrapper copy if possible.
		// Currently this separate copy of the ZWrapper object avoids allowing
		// resolution to affect the original object. Whether this is desirable
		// (or whether, alternatively, we are ok with that side-effect) is TBD.
		let nextZ1 = Z1s.shift();
		nextZ1 = nextZ1.copy();
		result[ argument.Z17K2.Z6K1 ] = nextZ1;
	}
	// Use an empty scope for the outer object, the nested objects should already have their own
	// scope, if any.
	return ZWrapper.create( result, new EmptyFrame() );
}

async function runValidationFunction( Z8, invariants, ...Z1s ) {
	const validatorZ7 = createValidatorZ7( Z8, ...Z1s );
	return await execute( validatorZ7, invariants, /* doValidate= */ false );
}

/**
 * Validates the Z1/Object against its type validator and returns an array of Z5/Error.
 *
 * @param {Object} Z1 the Z1/Object
 * @param {Object} Z4 the type ZObject
 * @param {Invariants} invariants evaluator, resolver: invariants preserved over all function calls
 * @return {Array} an array of Z5/Error
 */
async function runTypeValidator( Z1, Z4, invariants ) {
	await ( Z4.resolveEphemeral( [ 'Z4K3' ], invariants, /* ignoreList= */ null, /* resolveInternals= */ false ) );
	const validationFunction = Z4.Z4K3;

	try {
		// TODO (T296681): Catch errors when async functions reject.
		return await runValidationFunction(
			validationFunction, invariants, quoteZObject( Z1 ),
			quoteZObject( Z4 ) );
	} catch ( err ) {
		console.error( err );
		return makeWrappedResultEnvelope(
			null,
			makeErrorInNormalForm(
				[ error.zid_not_found ],
				[ `Builtin validator "${validationFunction.Z8K5.Z9K1}" not found for "${Z4.Z4K1.Z9K1}"` ]
			)
		);
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
 * @param {Invariants} invariants evaluator, resolver: invariants preserved over all function calls
 * @return {Array} an array of Z5/Error
 */
async function runTypeValidatorDynamic( Z1, Z4, invariants ) {
	await ( Z4.resolveEphemeral( [ 'Z4K3' ], invariants, /* ignoreList= */ null, /* resolveInternals= */ false ) );
	const validationFunction = Z4.getNameEphemeral( 'Z4K3' );

	// TODO (T327872): Oh, when to quote!
	const genericSchemaValidatorZID = 'Z831';
	if ( validationFunction.Z8K5.Z9K1 === genericSchemaValidatorZID ) {
		Z1 = quoteZObject( Z1 );
		Z4 = quoteZObject( Z4 );
	}

	try {
		// TODO (T296681): Catch errors when async functions reject.
		return await runValidationFunction(
			validationFunction, invariants, Z1, Z4 );
	} catch ( err ) {
		console.error( err );
		return makeWrappedResultEnvelope(
			null,
			makeErrorInNormalForm(
				error.zid_not_found,
				[ `Builtin validator "${validationFunction.Z8K5.Z9K1}" not found for "${Z4.Z4K1.Z9K1}"` ]
			)
		);
	}
}

function traverseInternal( ZObject, callback ) {
	if ( isString( ZObject ) ) {
		return;
	}
	callback( ZObject );
	let keys;
	if ( validatesAsFunctionCall( ZObject.asJSON() ).isValid() ) {
		keys = [ 'Z1K1', 'Z7K1' ];
	} else {
		keys = ZObject.keys();
	}
	for ( const key of keys ) {
		traverseInternal( ZObject[ key ], callback );
	}
}

/**
 * Utility function that traverses the given ZObject to identify all of the types contained in it
 * and return their ZObjects. The ZObjects are fetched from the database.
 *
 * @param {Object} zobject the zobject in normal.
 * @param {Invariants} invariants evaluator, resolver: invariants preserved over all function calls
 * @return {Object} an object mapping the ZID to the ZObject of the type.
 */
async function getContainedTypeZObjects( zobject, invariants ) {
	const containedTypes = new Set();

	traverseInternal( zobject, function ( Z1 ) {
		const typeKey = createZObjectKey( Z1.Z1K1 );
		const key = typeKey.asString();
		// TODO (T297717): We should add other types to the set, not just builtins.
		if ( typeKey.type() === 'SimpleTypeKey' ) {
			containedTypes.add( key );
		}
	} );

	const result = await invariants.resolver.dereference( containedTypes );
	return result;
}

/**
 * Traverses the given zobject and validates each node checking its schema and running its type
 * validator.
 *
 * @param {Object} zobject the zobject in normal form.
 * @param {Invariants} invariants evaluator, resolver: invariants preserved over all function calls
 * @return {Array} an array of validation errors.
 */
async function validate( zobject, invariants ) {
	const errors = [];
	const ZObjectTypes = await getContainedTypeZObjects( zobject, invariants );
	const typeValidatorPromises = [];

	traverseInternal( zobject, ( Z1 ) => {
		let validatorTuple;
		try {
			validatorTuple = getSchemaValidator( Z1 );
		} catch ( error ) {
			console.error( 'Attempting to validate Z1', Z1, 'produced error', error );
			errors.push(
				// Use an empty scope as the error should not refer to any local variable.
				ZWrapper.create( makeErrorInNormalForm(
					error.zid_not_found,
					[ error.message ] ), new EmptyFrame() ) );
			return;
		}
		const { typeKey, schemaValidator } = validatorTuple;
		if ( schemaValidator === null ) {
			return;
		}
		const typeEnvelope = ZObjectTypes.get( typeKey.asString() );
		if ( typeEnvelope === undefined ) {
			// TODO (T297717): We should add other types to the set, not just builtins.
			return;
		}
		const theStatus = schemaValidator.validateStatus( Z1.asJSON() );
		if ( !theStatus.isValid() ) {
			// Use an empty scope as the error should not refer to any local variable.
			errors.push( ZWrapper.create( theStatus.getZ5(), new EmptyFrame() ) );
		} else {
			// TODO (T307244): Use ignoreList instead of setting evaluator
			// to null.
			if ( responseEnvelopeContainsError( typeEnvelope ) ) {
				errors.push( getError( typeEnvelope ) );
			} else {
				const noEvaluator = new Invariants(
					invariants.resolver, [], invariants.orchestratorConfig );
				typeValidatorPromises.push( runTypeValidator(
					Z1, typeEnvelope.Z22K1.Z2K2, noEvaluator ) );
			}
		}
	} );

	const typeValidatorResults = await Promise.all( typeValidatorPromises );

	typeValidatorResults
		.filter( responseEnvelopeContainsError )
		.forEach( ( result ) => {
			const error = getError( result );

			// if this is a Z509/Multiple errors it will be flattened
			if ( error.Z5K1.Z9K1 === 'Z509' ) {
				errors.push.apply( errors, convertZListToItemArray( error.Z5K2.Z509K1 ) );
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
