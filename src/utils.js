'use strict';

const { SchemaFactory, ZObjectKeyFactory } = require( '../function-schemata/javascript/src/schema.js' );
const { isUserDefined } = require( '../function-schemata/javascript/src/utils' );

const normalFactory = SchemaFactory.NORMAL();
const Z1Validator = normalFactory.create( 'Z1' );
const Z4Validator = normalFactory.create( 'Z4' );
const Z6Validator = normalFactory.create( 'Z6' );
const Z7Validator = normalFactory.create( 'Z7' );
const Z9Validator = normalFactory.create( 'Z9' );
const Z18Validator = normalFactory.create( 'Z18' );
const Z23Validator = normalFactory.create( 'Z23' );

/**
 * Validates a ZObject against the Type schema.
 *
 * @param {Object} Z1 object to be validated
 * @return {bool} whether Z1 can validated as a Type
 */
function isType( Z1 ) {
	return ( Z4Validator.validate( Z1 ) &&
		!( Z9Validator.validate( Z1 ) ) &&
		!( Z18Validator.validate( Z1 ) ) );
}

/**
 * Determines whether argument is a Z9.
 *
 * @param {Object} Z1 a ZObject
 * @return {bool} true if Z1 validates as Z9
 */
function isReference( Z1 ) {
	return Z9Validator.validate( Z1 );
}

/**
 * Determines whether argument is a Z6 or Z9. These two types' Z1K1s are
 * strings instead of Z9s, so some checks below need to special-case their
 * logic.
 *
 * @param {Object} Z1 a ZObject
 * @return {bool} true if Z1 validates as either Z6 or Z7
 */
function isRefOrString( Z1 ) {
	return !Z18Validator.validate( Z1 ) &&
		( Z6Validator.validate( Z1 ) || Z9Validator.validate( Z1 ) );
}

/**
 * Validates a ZObject against the Function Call schema.
 *
 * @param {Object} Z1 object to be validated
 * @return {bool} whether Z1 can validated as a Function Call
 */
function isFunctionCall( Z1 ) {
	return (
		Z7Validator.validate( Z1 ) &&
		!( Z9Validator.validate( Z1 ) ) &&
		!( Z18Validator.validate( Z1 ) )
	);
}

function createSchema( Z1 ) {
	if ( isRefOrString( Z1 ) ) {
		return normalFactory.create( Z1.Z1K1 );
	}
	const Z1K1 = Z1.Z1K1;
	if ( isReference( Z1K1 ) ) {
		if ( isUserDefined( Z1K1.Z9K1 ) ) {
			throw new Error( `Tried to create schema for unrecognized ZID ${Z1K1.Z9K1}` );
		}
		return normalFactory.create( Z1K1.Z9K1 );
	}

	const result = normalFactory.createUserDefined( [ Z1K1 ] );
	const key = ZObjectKeyFactory.create( Z1K1 ).asString();
	return result.get( key );
}

// TODO(T296659): Use validatesAs* from function-schemata instead of is*.
/**
 * Validates a ZObject.
 *
 * @param {Object} Z1 object to be validated
 * @return {bool} whether Z1 can validate as a Z1
 */
function isZObject( Z1 ) {
	return Z1Validator.validate( Z1 );
}

/**
 * Validates a ZObject against the Error schema.
 *
 * @param {Object} Z1 object to be validated
 * @return {bool} whether Z1 can validate as an Error
 */
function isError( Z1 ) {
	// TODO(T287921): Assay that Z1 validates as Z5 but not as Z9 or Z18.
	try {
		return Z1.Z1K1 === 'Z5' || Z1.Z1K1.Z9K1 === 'Z5';
	} catch ( error ) {
		return false;
	}
}

/**
 * Validates a ZObject against the GENERIC schema.
 *
 * @param {Object} Z1 object to be validated
 * @return {bool} whether Z1 can validate as a generic type instantiation
 */
function isGenericType( Z1 ) {
	// TODO(T296658): Use the GENERIC schema.
	try {
		if ( !isFunctionCall( Z1.Z1K1 ) ) {
			return false;
		}
		const localKeyRegex = /K[1-9]\d*$/;
		for ( const key of Object.keys( Z1 ) ) {
			if ( key === 'Z1K1' || key === 'Z7K1' ) {
				continue;
			}
			if ( key.match( localKeyRegex ) === null ) {
				return false;
			}
		}
		return true;
	} catch ( err ) {
		return false;
	}
}

/**
 * Determines whether argument is a Z18.
 *
 * @param {Object} Z1 a ZObject
 * @return {bool} true if Z1 validates as Z18
 */
function isArgumentReference( Z1 ) {
	return Z18Validator.validate( Z1 ) && !Z9Validator.validate( Z1 );
}

/**
 * Determines whether argument is a Z23.
 *
 * TODO(T285433): Replace Z23 with Z21.
 *
 * @param {Object} Z1 a ZObject
 * @return {bool} true if Z1 validates as Z23
 */
function isNothing( Z1 ) {
	return Z23Validator.validate( Z1 ) || Z1 === 'Z23';
}

/**
 * Determines whether a pair contains an error.
 *
 * @param {Object} pair a Z22
 * @return {bool} true if Z22K2 is a Z5; false otherwise
 */
function containsError( pair ) {
	return isError( pair.Z22K2 );
}

/**
 * Determines whether a pair contains an error Z23.
 *
 * @param {Object} pair a Z22
 * @return {bool} true if Z22K2 is not the Unit; false otherwise
 */
function containsValue( pair ) {
	return isZObject( pair.Z22K1 ) && !( isNothing( pair.Z22K1 ) );
}

// TODO(T282891): Replace with function-schemata version.
function Z23( canonical = false ) {
	if ( canonical ) {
		return 'Z23';
	}
	return { Z1K1: 'Z9', Z9K1: 'Z23' };
}

// TODO(T282891): Replace uses of this with upstream makeResultEnvelope
// (which doesn't handle the third parameter)
function makeResultEnvelopeAndMaybeCanonicalise(
	goodResult = null, badResult = null, canonical = false
) {
	let Z1K1;
	if ( canonical ) {
		Z1K1 = 'Z22';
	} else {
		Z1K1 = {
			Z1K1: 'Z9',
			Z9K1: 'Z22'
		};
	}
	return {
		Z1K1: Z1K1,
		Z22K1: goodResult === null ? Z23( canonical ) : goodResult,
		Z22K2: badResult === null ? Z23( canonical ) : badResult
	};
}

function makeBoolean( truthy = false, canonical = false ) {
	const zobject = {};
	if ( canonical ) {
		zobject.Z1K1 = 'Z40';
	} else {
		zobject.Z1K1 = {
			Z1K1: 'Z9',
			Z9K1: 'Z40'
		};
	}

	if ( truthy ) {
		if ( canonical ) {
			zobject.Z40K1 = 'Z41';
		} else {
			zobject.Z40K1 = {
				Z1K1: 'Z9',
				Z9K1: 'Z41'
			};
		}
	} else {
		if ( canonical ) {
			zobject.Z40K1 = 'Z42';
		} else {
			zobject.Z40K1 = {
				Z1K1: 'Z9',
				Z9K1: 'Z42'
			};
		}
	}

	return zobject;
}

// TODO(T292650): This needs to generate an actual error instead of Z6s.
function generateError( errorString = 'An unknown error occurred' ) {
	return {
		Z1K1: {
			Z1K1: 'Z9',
			Z9K1: 'Z5'
		},
		Z5K2: {
			Z1K1: {
				Z1K1: 'Z9',
				Z9K1: 'Z10'
			},
			Z10K1: {
				Z1K1: {
					Z1K1: 'Z9',
					Z9K1: 'Z6'
				},
				Z6K1: errorString
			},
			Z10K2: {
				Z1K1: {
					Z1K1: 'Z9',
					Z9K1: 'Z10'
				}
			}
		}
	};
}

async function traverseZ10( Z10, callback ) {
	let tail = Z10;
	if ( tail === undefined ) {
		return;
	}
	while ( tail.Z10K1 !== undefined ) {
		await callback( tail );
		tail = tail.Z10K2;
	}
}

module.exports = {
	containsError,
	containsValue,
	createSchema,
	generateError,
	isArgumentReference,
	isError,
	isFunctionCall,
	isGenericType,
	isNothing,
	isRefOrString,
	isReference,
	isType,
	makeBoolean,
	makeResultEnvelopeAndMaybeCanonicalise,
	traverseZ10,
	Z23
};
