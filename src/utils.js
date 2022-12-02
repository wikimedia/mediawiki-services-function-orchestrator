'use strict';

const {
	SchemaFactory,
	validatesAsZObject,
	validatesAsFunctionCall,
	validatesAsReference,
	ZObjectKeyFactory
} = require( '../function-schemata/javascript/src/schema.js' );
const { isUserDefined, getHead, getTail, makeMappedResultEnvelope, isVoid, isZMap, makeEmptyZMap,
	getZMapValue, setZMapValue } = require( '../function-schemata/javascript/src/utils' );
const { EmptyFrame } = require( './frame.js' );

const normalFactory = SchemaFactory.NORMAL();
const Z6Validator = normalFactory.create( 'Z6_literal' );
const Z9Validator = normalFactory.create( 'Z9_literal' );

/**
 * Determines whether argument is a Z6 or Z9. These two types' Z1K1s are
 * strings instead of Z9s, so some checks below need to special-case their
 * logic.
 *
 * @param {Object} Z1 a ZObject
 * @return {boolean} true if Z1 validates as either Z6 or Z7
 */
function isRefOrString( Z1 ) {
	const { ZWrapper } = require( './ZWrapper' );

	if ( Z1 instanceof ZWrapper ) {
		Z1 = Z1.asJSON();
	}
	return (
		( Z6Validator.validate( Z1 ) ) ||
		( Z9Validator.validate( Z1 ) )
	);
}

function createZObjectKey( ZObject ) {
	const { ZWrapper } = require( './ZWrapper' );
	if ( ZObject instanceof ZWrapper ) {
		ZObject = ZObject.asJSONEphemeral();
	}
	return ZObjectKeyFactory.create( ZObject );
}

function createSchema( Z1 ) {
	// TODO (T302032): Use function-schemata version of findIdentity to improve
	// type inference here.
	let Z1K1 = Z1.Z1K1;
	const { ZWrapper } = require( './ZWrapper' );
	if ( Z1K1 instanceof ZWrapper ) {
		Z1K1 = Z1K1.asJSONEphemeral();
	}
	if ( isRefOrString( Z1 ) ) {
		return normalFactory.create( Z1K1 );
	}
	if ( validatesAsReference( Z1K1 ).isValid() ) {
		if ( isUserDefined( Z1K1.Z9K1 ) ) {
			throw new Error( `Tried to create schema for unrecognized ZID ${Z1K1.Z9K1}` );
		}
		return normalFactory.create( Z1K1.Z9K1 );
	}
	const result = normalFactory.createUserDefined( [ Z1K1 ] );
	const key = createZObjectKey( Z1K1 ).asString();
	return result.get( key );
}

/**
 * Validates a ZObject against the Error schema.
 *
 * @param {Object} Z1 object to be validated
 * @return {boolean} whether Z1 can validate as an Error
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
 * @return {boolean} whether Z1 can validate as a generic type instantiation
 */
function isGenericType( Z1 ) {
	// TODO (T296658): Use the GENERIC schema.
	try {
		let Z1K1 = Z1.Z1K1;
		const { ZWrapper } = require( './ZWrapper' );
		if ( Z1 instanceof ZWrapper ) {
			Z1K1 = Z1.asJSON().Z1K1;
		}
		if ( !validatesAsFunctionCall( Z1K1 ).isValid() ) {
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

/* eslint-disable jsdoc/no-undefined-types */
/**
 * Same as utils.js:setMetadataValue() in function-schemata, *except* this method allows the
 * envelope (Z22 / Evaluation result) to be either a ZWrapper or a JSON object, and it takes
 * multiple key / value pairs (as a JavaScript Map).
 *
 * Ensures there is an entry in the metadata map of the given envelope for each key/value in
 * newPairs. If the envelope has no metadata map, creates one.  If there is already an entry
 * for a given key/value, overwrites the corresponding value.  Otherwise, creates a new entry.
 * N.B.: May modify the value of Z22K2 and the ZMap's K1 in place.
 *
 * @param {Object|ZWrapper} envelope a Z22/Evaluation result, in normal form
 * @param {Map} newPairs key/value pairs of ZObjects in normal form,
 * with each key an instance of Z6 or Z39
 * @return {Object|ZWrapper} the updated envelope, in normal form
 */
function setMetadataValues( envelope, newPairs ) {
	const { ZWrapper } = require( './ZWrapper' );
	let scope = null;
	let zMap = envelope.Z22K2;
	if ( envelope instanceof ZWrapper ) {
		// Get zMap as JSON, and save scope
		if ( zMap ) {
			scope = zMap.getScope();
			zMap = zMap.asJSON();
		} else {
			// For this case we'll create a new ZMap, using the envelope's scope
			scope = envelope.getScope();
		}
	}

	// Do the ZMap creation (if needed) and insertions using JSON objects
	if ( zMap === undefined || isVoid( zMap ) ) {
		const keyType = { Z1K1: 'Z9', Z9K1: 'Z6' };
		const valueType = { Z1K1: 'Z9', Z9K1: 'Z1' };
		zMap = makeEmptyZMap( keyType, valueType );
	}
	for ( const [ key, value ] of newPairs ) {
		zMap = setZMapValue( zMap, key, value );
	}

	if ( envelope instanceof ZWrapper ) {
		// Return zMap to ZWrapper form
		zMap = ZWrapper.create( zMap, scope );
		envelope.setName( 'Z22K2', zMap );
	} else {
		envelope.Z22K2 = zMap;
	}
	return envelope;
}
/* eslint-enable jsdoc/no-undefined-types */

/**
 * Determines whether a Z22 / Evaluation result contains an error.
 *
 * @param {Object} envelope a Z22
 * @return {boolean} true if Z22K2 contains an error; false otherwise
 */
function responseEnvelopeContainsError( envelope ) {
	const metadata = envelope.Z22K2;
	// TODO( T322779 ): Investigate why Z22K2 is sometimes undefined here
	if ( metadata === undefined ) {
		return false;
	} else if ( isVoid( metadata ) ) {
		return false;
	} else if ( isZMap( metadata ) ) {
		return ( getZMapValue( metadata, { Z1K1: 'Z6', Z6K1: 'errors' } ) !== undefined );
	} else {
		throw new Error( `Invalid value for Z22K2: ${metadata}` );
	}
}

/**
 * Determines whether a responseEnvelope contains a value (i.e., a non-Void first element).
 * The input responseEnvelope should be in normal form.
 *
 * FIXME (T311055): responseEnvelopeContainsValue might require normal form, as validateAsZObject
 * is a normal validator. Check and document.
 *
 * @param {Object} responseEnvelope a Z22
 * @return {boolean} true if Z22K1 is not Z24 / Void; false otherwise
 */
function responseEnvelopeContainsValue( responseEnvelope ) {
	const Z22K1 = responseEnvelope.Z22K1.asJSON();
	return (
		validatesAsZObject( Z22K1 ).isValid() &&
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
 * @param {?Function} callback optional callback to be called on every element of
 *  callTuples; arguments are of the form ( current Z22, current call tuple)
 * @param {boolean} addZ22 whether to inject Z22.Z22K1 as first argument to callables
 * @return {Promise<Object>} a Z22
 */
async function returnOnFirstError( Z22, callTuples, callback = null, addZ22 = true ) {
	let currentResponseEnvelope = Z22;
	for ( const callTuple of callTuples ) {
		if (
			responseEnvelopeContainsError( currentResponseEnvelope ) ||
			isVoid( currentResponseEnvelope.Z22K1 )
		) {
			break;
		}
		if ( callback !== null ) {
			await callback( currentResponseEnvelope, callTuple );
		}
		const callable = callTuple[ 0 ];
		const args = [];
		if ( addZ22 ) {
			args.push( currentResponseEnvelope.Z22K1 );
		}
		for ( const arg of callTuple[ 1 ] ) {
			args.push( arg );
		}
		try {
			currentResponseEnvelope = await callable( ...args );
		} catch ( error ) {
			console.trace( error );
		}
	}
	return currentResponseEnvelope;
}

function quoteZObject( ZObject ) {
	const { ZWrapper } = require( './ZWrapper' );
	// Use an empty scope for the outer object, the nested object should already have its own
	// scope, if any.
	return ZWrapper.create( {
		Z1K1: {
			Z1K1: 'Z9',
			Z9K1: 'Z99'
		},
		Z99K1: ZObject
	},
	new EmptyFrame() );
}

function makeWrappedResultEnvelope( ...args ) {
	const { ZWrapper } = require( './ZWrapper' );
	// Use an empty scope for the outer object, the nested object should already have its own
	// scope, if any.
	return ZWrapper.create( makeMappedResultEnvelope( ...args ), new EmptyFrame() );
}

module.exports = {
	responseEnvelopeContainsError,
	responseEnvelopeContainsValue,
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
	setMetadataValues,
	traverseZList
};
