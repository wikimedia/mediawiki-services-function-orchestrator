'use strict';

const {
	SchemaFactory,
	validatesAsZObject,
	validatesAsFunctionCall,
	validatesAsReference,
	ZObjectKeyFactory
} = require( '../function-schemata/javascript/src/schema.js' );
const { isUserDefined, getHead, getTail, makeMappedResultEnvelope, isVoid, isZMap, getZMapValue
} = require( '../function-schemata/javascript/src/utils' );

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
	const { ZWrapper } = require( './ZWrapper' );
	if ( Z1 instanceof ZWrapper ) {
		Z1 = Z1.asJSON();
	}
	return (
		( await Z6Validator.validate( Z1 ) ) ||
		( await Z9Validator.validate( Z1 ) )
	);
}

async function createZObjectKey( ZObject ) {
	const { ZWrapper } = require( './ZWrapper' );
	if ( ZObject instanceof ZWrapper ) {
		ZObject = ZObject.asJSON();
	}
	return await ZObjectKeyFactory.create( ZObject );
}

async function createSchema( Z1 ) {
	// TODO (T302032): Use function-schemata version of findIdentity to improve
	// type inference here.
	let Z1K1 = Z1.Z1K1;
	const { ZWrapper } = require( './ZWrapper' );
	if ( Z1K1 instanceof ZWrapper ) {
		Z1K1 = Z1K1.asJSON();
	}
	if ( await isRefOrString( Z1 ) ) {
		return normalFactory.create( Z1K1 );
	}
	if ( ( await validatesAsReference( Z1K1 ) ).isValid() ) {
		if ( isUserDefined( Z1K1.Z9K1 ) ) {
			throw new Error( `Tried to create schema for unrecognized ZID ${Z1K1.Z9K1}` );
		}
		return normalFactory.create( Z1K1.Z9K1 );
	}
	const result = await normalFactory.createUserDefined( [ Z1K1 ] );
	const key = ( await createZObjectKey( Z1K1 ) ).asString();
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
		let Z1K1 = Z1.Z1K1;
		const { ZWrapper } = require( './ZWrapper' );
		if ( Z1 instanceof ZWrapper ) {
			Z1K1 = Z1.asJSON().Z1K1;
		}
		if ( !( await validatesAsFunctionCall( Z1K1 ) ).isValid() ) {
			return false;
		}
		const localKeyRegex = /K[1-9]\d*$/;
		for ( const key of Z1.keys() ) {
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
 * Determines whether a Z22 / Evaluation result contains an error.  Works both with older
 * "basic" Z22s and with newer map-based Z22s.
 *
 * @param {Object} envelope a Z22
 * @return {bool} true if Z22K2 contains an error; false otherwise
 */
function containsError( envelope ) {
	const metadata = envelope.Z22K2;
	if ( isVoid( metadata ) ) {
		return false;
	} else if ( isZMap( metadata ) ) {
		return ( getZMapValue( metadata, { Z1K1: 'Z6', Z6K1: 'errors' } ) !== undefined );
	} else {
		return isError( metadata );
	}
}

/**
 * Determines whether a pair contains a value (i.e., a non-Void first element).
 * The input pair should be in normal form.
 *
 * FIXME (T311055): containsValue might require normal form, as validateAsZObject
 * is a normal validator. Check and document.
 *
 * @param {Object} pair a Z22
 * @return {bool} true if Z22K1 is not Z24 / Void; false otherwise
 */
async function containsValue( pair ) {
	const Z22K1 = pair.Z22K1.asJSON();
	return (
		( await validatesAsZObject( Z22K1 ) ).isValid() &&
		!( isVoid( Z22K1 ) )
	);
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
				Z1K1: 'Z7',
				Z7K1: 'Z881',
				Z881K1: 'Z6'
			},
			K1: {
				Z1K1: {
					Z1K1: 'Z9',
					Z9K1: 'Z6'
				},
				Z6K1: errorString
			},
			K2: {
				Z1K1: {
					Z1K1: 'Z7',
					Z7K1: 'Z881',
					Z881K1: 'Z6'
				}
			}
		}
	};
}

async function traverseZList( ZList, callback ) {
	let tail = ZList;
	if ( tail === undefined ) {
		return;
	}
	while ( getHead( tail ) !== undefined ) {
		await callback( tail );
		tail = getTail( tail );
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
		if (
			containsError( currentPair ) ||
			isVoid( currentPair.Z22K1 )
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

function quoteZObject( ZObject ) {
	const { ZWrapper } = require( './ZWrapper' );
	return ZWrapper.create( {
		Z1K1: {
			Z1K1: 'Z9',
			Z9K1: 'Z99'
		},
		Z99K1: ZObject
	} );
}

function makeWrappedResultEnvelope( ...args ) {
	const { ZWrapper } = require( './ZWrapper' );
	return ZWrapper.create( makeMappedResultEnvelope( ...args ) );
}

module.exports = {
	containsError,
	containsValue,
	createSchema,
	createZObjectKey,
	generateError,
	isError,
	isGenericType,
	isRefOrString,
	makeBoolean,
	makeWrappedResultEnvelope,
	quoteZObject,
	returnOnFirstError,
	traverseZList
};
