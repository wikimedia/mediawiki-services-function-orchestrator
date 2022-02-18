'use strict';

const {
	SchemaFactory,
	validatesAsZObject,
	validatesAsFunctionCall,
	validatesAsReference,
	validatesAsUnit,
	ZObjectKeyFactory
} = require( '../function-schemata/javascript/src/schema.js' );
const { isUserDefined, makeUnit } = require( '../function-schemata/javascript/src/utils' );
const normalFactory = SchemaFactory.NORMAL();
const Z6Validator = normalFactory.create( 'Z6_literal' );
const Z9Validator = normalFactory.create( 'Z9_literal' );

/**
 * Determines whether argument is a Z6 or Z9. These two types' Z1K1s are
 * strings instead of Z9s, so some checks below need to special-case their
 * logic.
 *
 * @param {Object} Z1 a ZObject
 * @return {bool} true if Z1 validates as either Z6 or Z7
 */
async function isRefOrString( Z1 ) {
	return (
		( await Z6Validator.validate( Z1 ) ) ||
		( await Z9Validator.validate( Z1 ) )
	);
}

async function createSchema( Z1 ) {
	// TODO (T302032): Use function-schemata version of findIdentity to improve
	// type inference here.
	if ( await isRefOrString( Z1 ) ) {
		return normalFactory.create( Z1.Z1K1 );
	}
	const Z1K1 = Z1.Z1K1;
	if ( ( await validatesAsReference( Z1K1 ) ).isValid() ) {
		if ( isUserDefined( Z1K1.Z9K1 ) ) {
			throw new Error( `Tried to create schema for unrecognized ZID ${Z1K1.Z9K1}` );
		}
		return normalFactory.create( Z1K1.Z9K1 );
	}

	const result = await normalFactory.createUserDefined( [ Z1K1 ] );
	const key = ( await ZObjectKeyFactory.create( Z1K1 ) ).asString();
	return result.get( key );
}

/**
 * Validates a ZObject against the Error schema.
 *
 * @param {Object} Z1 object to be validated
 * @return {bool} whether Z1 can validate as an Error
 */
function isError( Z1 ) {
	// TODO (T287921): Assay that Z1 validates as Z5 but not as Z9 or Z18.
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
async function isGenericType( Z1 ) {
	// TODO (T296658): Use the GENERIC schema.
	try {
		if ( !( await validatesAsFunctionCall( Z1.Z1K1 ) ).isValid() ) {
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
async function containsValue( pair ) {
	return (
		( await validatesAsZObject( pair.Z22K1 ) ).isValid() &&
		!( ( await validatesAsUnit( pair.Z22K1 ) ).isValid() )
	);
}

// TODO (T282891): Replace uses of this with upstream makeResultEnvelope
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
		Z22K1: goodResult === null ? makeUnit( canonical ) : goodResult,
		Z22K2: badResult === null ? makeUnit( canonical ) : badResult
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

// TODO (T292650): This needs to generate an actual error instead of Z6s.
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

/**
 * Runs several functions in sequence; returns first one whose Z22K2 is an error.
 *
 * @param {Object} Z22 a Z22/ResultEnvelope
 * @param {Array} callTuples an array whose elements are also arrays of the form
 *  [ function, argument list, name ]
 *  every function accepts Z22 as its first argument and will be called with the
 *  result of the previous function (starting with input Z22). If the resulting Z22
 *  contains an error (Z22K2), this function returns immediately; otherwise, it
 *  calls the next function with the output of the previous.
 * @param {Function} callback optional callback to be called on every element of
 *  callTuples; arguments are of the form ( current Z22, current call tuple)
 * @param {boolean} addZ22 whether to inject Z22.Z22K1 as first argument to callables
 * @return {Object} a Z22
 */
async function returnOnFirstError( Z22, callTuples, callback = null, addZ22 = true ) {
	let currentPair = Z22;
	for ( const callTuple of callTuples ) {
		// TODO (T296681): validatesAsUnit check is redundant once validation returns
		// correct type.
		if (
			containsError( currentPair ) ||
			( await validatesAsUnit( currentPair.Z22K1 ) ).isValid()
		) {
			break;
		}
		if ( callback !== null ) {
			await callback( currentPair, callTuple );
		}
		const callable = callTuple[ 0 ];
		const args = [];
		if ( addZ22 ) {
			args.push( currentPair.Z22K1 );
		}
		for ( const arg of callTuple[ 1 ] ) {
			args.push( arg );
		}
		currentPair = await callable( ...args );
	}
	return currentPair;
}

module.exports = {
	containsError,
	containsValue,
	createSchema,
	generateError,
	isError,
	isGenericType,
	isRefOrString,
	makeBoolean,
	makeResultEnvelopeAndMaybeCanonicalise,
	returnOnFirstError,
	traverseZ10
};
