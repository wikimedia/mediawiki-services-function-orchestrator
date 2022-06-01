'use strict';

const utils = require( '../function-schemata/javascript/src/utils' );
const normalize = require( '../function-schemata/javascript/src/normalize' );
const { createSchema, makeBoolean, traverseZList } = require( './utils.js' );
const { normalError, error } = require( '../function-schemata/javascript/src/error' );
const { makeMappedResultEnvelope, makeTrue, makeFalse } = require( '../function-schemata/javascript/src/utils.js' );
const ErrorFormatter = require( '../function-schemata/javascript/src/errorFormatter' );
const {
	validatesAsType,
	validatesAsReference
} = require( '../function-schemata/javascript/src/schema.js' );
const { Invariants } = require( './Invariants.js' );
const { ZWrapper } = require( './ZWrapper' );
const fs = require( 'fs' );

/**
 * HELPER FUNCTIONS
 */

/**
 * Returns true iff the input is equivalent to the builtin true value.
 *
 * @param {Object} Z40 A Z40
 * @return {bool} whether Z40 corresponds to Z41 (true) or not
 */
function isTrue( Z40 ) {
	return Z40.Z40K1.Z9K1 === makeTrue().Z40K1.Z9K1;
}

/**
 * Constructs a Z3 object with the given type and name.
 *
 * @param {Object} typeZ4 A Z4 object (in JSON form, not ZWrapper)
 * @param {Object} nameZ6 A Z6 object (in JSON form, not ZWrapper)
 * @return {Object} Constructed Z3 / Key object (in JSON form, not ZWrapper)
 */
function Z3For( typeZ4, nameZ6 ) {
	return {
		Z1K1: {
			Z1K1: 'Z9',
			Z9K1: 'Z3'
		},
		Z3K1: typeZ4,
		Z3K2: nameZ6,
		Z3K3: {
			Z1K1: {
				Z1K1: 'Z9',
				Z9K1: 'Z12'
			},
			Z12K1: {
				Z1K1: {
					Z1K1: {
						Z1K1: 'Z9',
						Z9K1: 'Z7'
					},
					Z7K1: {
						Z1K1: 'Z9',
						Z9K1: 'Z881'
					},
					Z881K1: {
						Z1K1: 'Z9',
						Z9K1: 'Z11'
					}
				}
			}
		}
	};
}

/**
 * Constructs a Z9 object for the given ZID.
 *
 * @param {string} typeZID A Zobject identifier
 * @return {Object} Constructed Z9 / Reference object (in JSON form, not ZWrapper)
 */
function Z9For( typeZID ) {
	return {
		Z1K1: 'Z9',
		Z9K1: typeZID
	};
}

/**
 * Wraps English label in a Z12/Multilingual String object.
 *
 * @param {string} name The English label.
 * @return {Object} a Z12/Multilingual String containing a single Z11
 * wrapping the label (in JSON form, not ZWrapper)
 */
async function Z12For( name ) {
	return {
		Z1K1: {
			Z1K1: 'Z9',
			Z9K1: 'Z12'
		},
		Z12K1: await ( utils.convertArrayToZList )( [
			{
				Z1K1: {
					Z1K1: 'Z9',
					Z9K1: 'Z11'
				},
				Z11K1: {
					Z1K1: 'Z9',
					Z9K1: 'Z1002'
				},
				Z11K2: {
					Z1K1: 'Z6',
					Z6K1: name
				}
			}
		] )
	};
}

/**
 * BUILTINS
 */

function BUILTIN_ECHO_( input ) {
	return makeMappedResultEnvelope( input, null );
}

function BUILTIN_IF_( antecedent, trueConsequent, falseConsequent ) {
	let result;
	if ( isTrue( antecedent ) ) {
		result = trueConsequent;
	} else {
		result = falseConsequent;
	}
	return makeMappedResultEnvelope( result, null );
}

function BUILTIN_VALUE_BY_KEY_( Z39, Z1 ) {
	// TODO (T296667): Add test for error case.
	let goodResult = null, badResult = null;
	const key = Z39.Z39K1.Z6K1;
	if ( Z1[ key ] === undefined ) {
		badResult = normalError(
			[ error.error_in_evaluation ],
			[ 'Object did not contain key "' + key + '"' ] );
	} else {
		goodResult = Z1[ key ];
	}
	return makeMappedResultEnvelope( goodResult, badResult );
}

async function BUILTIN_VALUES_BY_KEYS_( Z39s, Z1 ) {
	const keyrefs = utils.convertZListToArray( Z39s );
	const pairType = {
		Z1K1: Z9For( 'Z7' ),
		Z7K1: Z9For( 'Z882' ),
		Z882K1: Z9For( 'Z39' ),
		Z882K2: Z9For( 'Z1' )
	};
	const pairArray = [];
	const missing = [];
	for ( const keyref of keyrefs ) {
		const key = keyref.Z39K1.Z6K1;
		const value = Z1[ key ];
		if ( value === undefined ) {
			missing.push( key );
		} else {
			pairArray.push( {
				Z1K1: pairType,
				K1: keyref,
				K2: value
			} );
		}
	}
	if ( missing.length > 0 ) {
		const badResult = normalError(
			[ error.error_in_evaluation ],
			[ 'Object did not contain key(s): ' + missing ] );
		return makeMappedResultEnvelope( null, badResult );
	} else {
		const pairList = await utils.convertArrayToZList( pairArray );
		const mapType = {
			Z1K1: Z9For( 'Z7' ),
			Z7K1: Z9For( 'Z883' ),
			Z883K1: Z9For( 'Z39' ),
			Z883K2: Z9For( 'Z1' )
		};
		const goodResult = {
			Z1K1: mapType,
			K1: pairList
		};
		return makeMappedResultEnvelope( goodResult, null );
	}
}

async function reifyRecursive( Z1 ) {
	if ( utils.isString( Z1 ) ) {
		return {
			Z1K1: 'Z6',
			Z6K1: Z1
		};
	}
	const pairType = {
		Z1K1: Z9For( 'Z7' ),
		Z7K1: Z9For( 'Z882' ),
		Z882K1: Z9For( 'Z39' ),
		Z882K2: Z9For( 'Z1' )
	};
	const result = [];
	for ( const key of Z1.keys() ) {
		const value = await reifyRecursive( Z1[ key ] );
		result.push( {
			Z1K1: pairType,
			K1: {
				Z1K1: {
					Z1K1: 'Z9',
					Z9K1: 'Z39'
				},
				Z39K1: {
					Z1K1: 'Z6',
					Z6K1: key
				}
			},
			K2: value
		} );
	}
	return await utils.convertArrayToZList( result );
}

async function BUILTIN_REIFY_( Z1 ) {
	return makeMappedResultEnvelope( await reifyRecursive( Z1 ), null );
}

function abstractRecursive( ZList ) {
	if ( ZList.Z1K1 === 'Z6' ) {
		return ZList.Z6K1;
	}
	const result = {};
	const arrayOfPairs = utils.convertZListToArray( ZList );
	for ( const pair of arrayOfPairs ) {
		const Z39 = pair.K1;
		result[ Z39.Z39K1.Z6K1 ] = abstractRecursive( pair.K2 );
	}
	return result;
}

function BUILTIN_ABSTRACT_( ZList ) {
	// TODO (T296666): Validate that List is a reified list, i.e. that all
	// elements are Pairs(Key, ZObject).
	return makeMappedResultEnvelope( abstractRecursive( ZList ), null );
}

async function BUILTIN_CONS_( Z1, Z10 ) {
	let result;
	if ( Z10.Z1K1.Z9K1 === 'Z10' ) {
		result = await utils.convertArrayToZList( [ Z1 ] );
		result.Z10K2 = Z10;
	} else {
		result = await utils.convertArrayToZList( [ Z1 ] );
		result.K2 = Z10;
	}
	return makeMappedResultEnvelope( result, null );
}

function BUILTIN_HEAD_( Z10 ) {
	if ( utils.isEmptyZList( Z10 ) ) {
		return makeMappedResultEnvelope(
			null,
			normalError(
				[ error.argument_type_mismatch ],
				[ 'An empty list has no head.' ] ) );
	}

	if ( Z10.Z1K1.Z9K1 === 'Z10' ) {
		return makeMappedResultEnvelope( Z10.Z10K1, null );
	}

	return makeMappedResultEnvelope( Z10.K1, null );
}

function BUILTIN_TAIL_( Z10 ) {
	if ( utils.isEmptyZList( Z10 ) ) {
		return makeMappedResultEnvelope(
			null,
			normalError(
				[ error.argument_type_mismatch ],
				[ 'An empty list has no tail.' ] ) );
	}

	if ( Z10.Z1K1.Z9K1 === 'Z10' ) {
		return makeMappedResultEnvelope( Z10.Z10K2, null );
	}

	return makeMappedResultEnvelope( Z10.K2, null );
}

function BUILTIN_EMPTY_( Z10 ) {
	let result;
	if ( utils.isEmptyZList( Z10 ) ) {
		result = makeTrue();
	} else {
		result = makeFalse();
	}
	return makeMappedResultEnvelope( result, null );
}

function BUILTIN_FIRST_( Z882 ) {
	return makeMappedResultEnvelope( Z882.K1, null );
}

function BUILTIN_SECOND_( Z882 ) {
	return makeMappedResultEnvelope( Z882.K2, null );
}

function BUILTIN_EQUALS_BOOLEAN_( Z40_1, Z40_2 ) {
	return makeMappedResultEnvelope(
		makeBoolean( ( Z40_1.Z40K1.Z9K1 === Z40_2.Z40K1.Z9K1 ) ),
		null
	);
}

function getLanguageMap() {
	// TODO (T302342): switch to using require maybe?
	const path = 'function-schemata/data/definitions/naturalLanguages.json';
	return JSON.parse( fs.readFileSync( path, { encoding: 'utf8' } ) );
}

function BUILTIN_LANGUAGE_CODE_TO_LANGUAGE_( Z6 ) {
	const languages = getLanguageMap();
	const languageCode = Z6.Z6K1;

	let result = null;

	if ( !( languageCode in languages ) ) {
		result = normalError(
			[ error.invalid_key ],
			[ `Invalid language code: ${languageCode}` ]
		);
	} else {
		const zid = languages[ languageCode ];
		result = {
			Z1K1: 'Z9',
			Z9K1: zid
		};
	}

	return makeMappedResultEnvelope( result );
}

function BUILTIN_EQUALS_STRING_( Z6_1, Z6_2 ) {
	return makeMappedResultEnvelope(
		makeBoolean( ( Z6_1.Z6K1 === Z6_2.Z6K1 ) ),
		null
	);
}

async function stringToCharsInternal( characterArray ) {
	const Z86Array = [];
	for ( const character of characterArray ) {
		Z86Array.push( {
			Z1K1: { Z1K1: 'Z9', Z9K1: 'Z86' },
			Z86K1: { Z1K1: 'Z6', Z6K1: character }
		} );
	}
	return await utils.convertArrayToZList( Z86Array );
}

async function BUILTIN_STRING_TO_CHARS_( Z6 ) {
	return makeMappedResultEnvelope(
		await stringToCharsInternal( Array.from( Z6.Z6K1 ) ),
		null );
}

function charsToStringInternal( Z10 ) {
	const Z10Array = utils.convertZListToArray( Z10 );
	const result = [];
	for ( const Z86 of Z10Array ) {
		result.push( Z86.Z6K1 || Z86.Z86K1.Z6K1 );
	}
	return result;
}

function BUILTIN_CHARS_TO_STRING_( Z10 ) {
	// TODO (T294482): Validate input is a List(Z86).
	return makeMappedResultEnvelope(
		{
			Z1K1: 'Z6',
			Z6K1: charsToStringInternal( Z10 ).join( '' )
		},
		null
	);
}

function BUILTIN_TRIGGER_METADATA_( Z5 ) {
	return makeMappedResultEnvelope( null, Z5 );
}

function BUILTIN_SAME_( Z86_1, Z86_2 ) {
	let result;
	if ( Z86_1.Z86K1.Z6K1 === Z86_2.Z86K1.Z6K1 ) {
		result = makeTrue();
	} else {
		result = makeFalse();
	}
	return makeMappedResultEnvelope( result, null );
}

function BUILTIN_UNQUOTE_( Z99 ) {
	return makeMappedResultEnvelope( Z99.Z99K1, null );
}

function makeValidatorResultEnvelope( Z1, errors ) {
	if ( errors.length === 0 ) {
		return makeMappedResultEnvelope( Z1.asJSON(), null );
	} else if ( errors.length === 1 ) {
		return makeMappedResultEnvelope( null, errors[ 0 ] );
	} else {
		return makeMappedResultEnvelope( null, ErrorFormatter.createZErrorList( errors ) );
	}
}

async function BUILTIN_SCHEMA_VALIDATOR_(
	quotedObject, quotedType, invariants, scope ) {
	// TODO (T290698): Use this instead of BUILTIN_EMPTY_VALIDATOR_.
	const Z1 = quotedObject.Z99K1;
	const Z4 = ( await ( quotedType.Z99K1.resolve(
		invariants, scope, /* originalObject= */null, /* key= */null, /* ignoreList= */null,
		/* resolveInternals= */ false ) ) ).Z22K1;

	// Ensure all internal type references are resolved.
	// TODO (T297904): Also need to resolve generic types.
	await traverseZList( Z4.Z4K2, async function ( Z3Tail ) {
		await ( Z3Tail.resolveKey(
			[ 'K1', 'Z3K1' ], invariants, scope,
			/* ignoreList= */null, /* resolveInternals= */false ) );
	} );
	const theSchema = await createSchema( { Z1K1: Z4.asJSON() } );

	// TODO (T294289): Return validationStatus Z5s as Z22K2.
	const theStatus = await theSchema.validateStatus( Z1.asJSON() );
	let errors;
	if ( theStatus.isValid() ) {
		errors = [];
	} else {
		errors = [ theStatus.getZ5() ];
	}

	return makeValidatorResultEnvelope( Z1, errors );
}

function BUILTIN_EMPTY_VALIDATOR_( Z1 ) {
	return makeMappedResultEnvelope( Z1, null );
}

/**
 * Validates the keys of a normal Z10/List. This functions looks for duplicate or non-sequential
 * keys and keys that don't follow the expected format of (Z)?<identity>Kn.
 *
 * @param {Object} Z10 the Z10/List being validated.
 * @param {Function} key a function to get the key of a list element.
 * @param {string} identity the identity of the Z10's parent.
 *
 * @return {Object} a Z10/List of Z5/Error.
 */
function arrayValidator( Z10, key, identity ) {
	const keys = utils.convertZListToArray( Z10 ).map( key );
	const messages = [];

	const seen = new Set();
	for ( let i = 0; i < keys.length; ++i ) {
		const originalKey = keys[ i ];
		let key = originalKey;
		if ( utils.isGlobalKey( key ) ) {
			if ( !originalKey.startsWith( identity ) ) {
				messages.push( `Invalid key at index ${i}: string should start with ${identity}` );
			}
			key = utils.kidFromGlobalKey( key );
		}
		const expectedIndex = i + 1;
		const actualIndex = Number( key.replace( 'K', '' ) );
		if ( seen.has( originalKey ) ) {
			messages.push( `Duplicated key at index ${i}: ${originalKey}` );
		} else {
			seen.add( originalKey );
		}

		if ( actualIndex !== expectedIndex ) {
			if ( i === 0 ) {
				messages.push( `Invalid key at index ${i}: ${originalKey} (should be K1 or ${identity}K1)` );
			} else {
				messages.push( `Non-sequential key at index ${i}: ${originalKey}` );
			}
		}
	}

	return messages.map(
		( message ) => normalError( [ error.array_element_not_well_formed ], [ message ] )
	);
}

function BUILTIN_FUNCTION_VALIDATOR_( Z99 ) {
	const Z1 = Z99.Z99K1;
	const errors = arrayValidator(
		Z1.Z8K1,
		( x ) => x.Z17K2.Z6K1,
		Z1.Z8K5.Z9K1
	);

	return makeValidatorResultEnvelope( Z99, errors );
}

function BUILTIN_Z4_TYPE_VALIDATOR_( Z99 ) {
	const Z1 = Z99.Z99K1;
	const errors = arrayValidator(
		Z1.Z4K2,
		( x ) => x.Z3K2.Z6K1,
		Z1.Z4K1.Z9K1
	);

	return makeValidatorResultEnvelope( Z99, errors );
}

async function BUILTIN_FUNCTION_CALL_VALIDATOR_INTERNAL_(
	Z99, errors, invariants, scope ) {
	const Z1 = Z99.Z99K1;
	const { getArgumentStates } = require( './execute.js' );
	const argumentStates = await getArgumentStates( Z1, invariants, scope, true );
	const dictDict = {};
	for ( const argumentState of argumentStates ) {
		if ( argumentState.state === 'ERROR' ) {
			// This is probably because Z8K1 couldn't be dereferenced and is
			// fine.
			return;
		}
		const argumentDict = argumentState.argumentDict;
		dictDict[ argumentDict.name ] = argumentDict;
		const localKey = argumentDict.name.replace( /^Z\d+/, '' );
		dictDict[ localKey ] = argumentDict;
	}

	const keysToSkip = new Set( [ 'Z1K1', 'Z7K1' ] );

	// TODO (T296668): Also check declared arguments that are absent from the Z7.
	// TODO (T296668): Also check local keys.
	for ( const key of Z1.keys() ) {
		if ( keysToSkip.has( key ) ) {
			continue;
		}
		const argumentDict = dictDict[ key ];
		if ( argumentDict === undefined ) {
			errors.push(
				normalError(
					[ error.invalid_key ],
					[ `Invalid key for function call: ${key}` ]
				)
			);
			continue;
		}
		let type = Z1[ key ].Z1K1.Z9K1 || Z1[ key ].Z1K1;
		if ( type instanceof ZWrapper ) {
			type = type.asJSON();
		}
		let declaredType = argumentDict.declaredType;
		if ( declaredType instanceof ZWrapper ) {
			declaredType = declaredType.asJSON();
		}
		// TODO (T296669): Fix type semantics below; do something when declaredType is a Z4.
		if ( ( await validatesAsType( declaredType ) ).isValid() ) {
			continue;
		}
		if ( ( await validatesAsReference( declaredType ) ).isValid() ) {
			declaredType = declaredType.Z9K1;
		}

		// Type mismatches for Z7, Z9, and Z18 will be caught at runtime.
		const skippableTypes = new Set( [ 'Z18', 'Z9', 'Z7' ] );
		// TODO (T296669): More intricate subtype semantics once we have generic
		// types (just checking for Z1 is not sufficient).
		if ( !( declaredType === type || declaredType === 'Z1' || skippableTypes.has( type ) ) ) {
			errors.push(
				normalError(
					[ error.argument_type_mismatch ],
					[ `Invalid argument type: expected ${declaredType}, got ${type}` ]
				)
			);
		}
	}
}

async function BUILTIN_FUNCTION_CALL_VALIDATOR_( Z99, invariants, scope ) {
	const errors = [];
	await BUILTIN_FUNCTION_CALL_VALIDATOR_INTERNAL_( Z99, errors, invariants, scope );

	return makeValidatorResultEnvelope( Z99, errors );
}

async function BUILTIN_MULTILINGUAL_TEXT_VALIDATOR_( Z99, invariants, scope ) {
	const Z1 = Z99.Z99K1;
	const errors = [];
	const Z11s = utils.convertZListToArray( Z1.Z12K1 );
	const languages = await Promise.all( Z11s.map( async ( Z11 ) => await ( Z11.resolveKey(
		[ 'Z11K1', 'Z60K1', 'Z6K1' ],
		invariants, scope ).Z22K1 ) ) );

	const seen = new Set();
	for ( let i = 0; i < languages.length; ++i ) {
		if ( seen.has( languages[ i ] ) ) {
			errors.push(
				normalError(
					[ error.array_element_not_well_formed ],
					[ `Duplicate Z11K1/language element in Z12/Multilingual text: '${languages[ i ]}'` ]
				)
			);
		}

		seen.add( languages[ i ] );
	}

	return makeValidatorResultEnvelope( Z99, errors );
}

function BUILTIN_MULTILINGUAL_STRINGSET_VALIDATOR_( Z99 ) {
	const Z1 = Z99.Z99K1;
	const errors = [];
	const Z31s = utils.convertZListToArray( Z1.Z32K1 );
	const languages = Z31s.map( ( Z31 ) => Z31.Z31K1.Z60K1.Z6K1 );

	const seen = new Set();
	for ( let i = 0; i < languages.length; ++i ) {
		if ( seen.has( languages[ i ] ) ) {
			errors.push(
				normalError(
					[ error.array_element_not_well_formed ],
					[ `Duplicate Z31K1/language element in Z32/Multilingual stringset: '${languages[ i ]}'` ]
				)
			);
		}

		seen.add( languages[ i ] );
	}

	return makeValidatorResultEnvelope( Z99, errors );
}

function BUILTIN_ERROR_TYPE_VALIDATOR_( Z99 ) {
	return makeValidatorResultEnvelope( Z99, [] );
}

async function resolveListType( typeZ4 ) {
	if ( typeZ4 instanceof ZWrapper ) {
		typeZ4 = typeZ4.asJSON();
	}
	const itsMe = {
		Z1K1: {
			Z1K1: 'Z9',
			Z9K1: 'Z7'
		},
		Z7K1: {
			Z1K1: 'Z9',
			Z9K1: 'Z881'
		},
		Z881K1: typeZ4
	};
	const Z4 = {
		Z1K1: {
			Z1K1: 'Z9',
			Z9K1: 'Z4'
		},
		Z4K1: itsMe,
		Z4K2: await utils.convertArrayToZList( [
			Z3For( typeZ4, { Z1K1: 'Z6', Z6K1: 'K1' }, await Z12For( 'head' ) ),
			Z3For( itsMe, { Z1K1: 'Z6', Z6K1: 'K2' }, await Z12For( 'tail' ) )
		] ),
		Z4K3: {
			Z1K1: 'Z9',
			Z9K1: 'Z831'
		}
	};
	return makeMappedResultEnvelope( Z4, null );
}

async function BUILTIN_GENERIC_LIST_TYPE_( typeZ4 ) {
	return await resolveListType( typeZ4 );
}

async function BUILTIN_GENERIC_PAIR_TYPE_( firstType, secondType ) {
	const itsMe = {
		Z1K1: {
			Z1K1: 'Z9',
			Z9K1: 'Z7'
		},
		Z7K1: {
			Z1K1: 'Z9',
			Z9K1: 'Z882'
		},
		Z882K1: firstType,
		Z882K2: secondType
	};
	const Z4 = {
		Z1K1: {
			Z1K1: 'Z9',
			Z9K1: 'Z4'
		},
		Z4K1: itsMe,
		Z4K2: await utils.convertArrayToZList( [
			Z3For( firstType, { Z1K1: 'Z6', Z6K1: 'K1' }, await Z12For( 'first' ) ),
			Z3For( secondType, { Z1K1: 'Z6', Z6K1: 'K2' }, await Z12For( 'second' ) )
		] ),
		Z4K3: {
			Z1K1: 'Z9',
			Z9K1: 'Z831'
		}
	};
	return makeMappedResultEnvelope( Z4, null );
}

async function BUILTIN_GENERIC_MAP_TYPE_( keyType, valueType, invariants, scope ) {
	// TODO (T302015) When ZMap keys are extended beyond Z6/String, update accordingly
	const allowedKeyTypes = [ 'Z6', 'Z39' ];
	if ( !allowedKeyTypes.includes( keyType.Z9K1 ) ) {
		const newError = normalError(
			[ error.argument_value_error ],
			[ 'Z883K1', keyType ]
		);
		return makeMappedResultEnvelope( null, newError );
	}
	const { execute } = require( './execute.js' );
	const itsMe = {
		Z1K1: Z9For( 'Z7' ),
		Z7K1: Z9For( 'Z883' ),
		Z883K1: keyType,
		Z883K2: valueType
	};
	const pairFunctionCall = {
		Z1K1: Z9For( 'Z7' ),
		Z7K1: Z9For( 'Z882' ),
		Z882K1: keyType,
		Z882K2: valueType
	};

	const noEvaluator = new Invariants( null, invariants.resolver );
	const pairType = (
		await execute( ZWrapper.create( pairFunctionCall ), noEvaluator, null )
	).Z22K1.asJSON();
	const listFunctionCall = {
		Z1K1: Z9For( 'Z7' ),
		Z7K1: Z9For( 'Z881' ),
		Z881K1: pairType
	};
	const listType = (
		await execute( ZWrapper.create( listFunctionCall ), noEvaluator, null )
	).Z22K1.asJSON();
	const Z4 = {
		Z1K1: {
			Z1K1: 'Z9',
			Z9K1: 'Z4'
		},
		Z4K1: itsMe,
		Z4K2: await utils.convertArrayToZList( [
			Z3For( listType, { Z1K1: 'Z6', Z6K1: 'K1' }, await Z12For( 'elements' ) )
		] ),
		Z4K3: {
			Z1K1: 'Z9',
			Z9K1: 'Z831'
		}
	};
	return makeMappedResultEnvelope( Z4, null );
}

const builtinFunctions = new Map();

builtinFunctions.set( 'Z901', BUILTIN_ECHO_ );
builtinFunctions.set( 'Z902', BUILTIN_IF_ );
builtinFunctions.set( 'Z903', BUILTIN_VALUE_BY_KEY_ );
builtinFunctions.set( 'Z904', BUILTIN_VALUES_BY_KEYS_ );
builtinFunctions.set( 'Z905', BUILTIN_REIFY_ );
builtinFunctions.set( 'Z908', BUILTIN_ABSTRACT_ );
builtinFunctions.set( 'Z910', BUILTIN_CONS_ );
builtinFunctions.set( 'Z911', BUILTIN_HEAD_ );
builtinFunctions.set( 'Z912', BUILTIN_TAIL_ );
builtinFunctions.set( 'Z913', BUILTIN_EMPTY_ );
builtinFunctions.set( 'Z920', BUILTIN_TRIGGER_METADATA_ );
builtinFunctions.set( 'Z921', BUILTIN_FIRST_ );
builtinFunctions.set( 'Z922', BUILTIN_SECOND_ );
builtinFunctions.set( 'Z931', BUILTIN_SCHEMA_VALIDATOR_ );
builtinFunctions.set( 'Z944', BUILTIN_EQUALS_BOOLEAN_ );
builtinFunctions.set( 'Z960', BUILTIN_LANGUAGE_CODE_TO_LANGUAGE_ );
builtinFunctions.set( 'Z966', BUILTIN_EQUALS_STRING_ );
builtinFunctions.set( 'Z968', BUILTIN_STRING_TO_CHARS_ );
builtinFunctions.set( 'Z981', BUILTIN_GENERIC_LIST_TYPE_ );
builtinFunctions.set( 'Z982', BUILTIN_GENERIC_PAIR_TYPE_ );
builtinFunctions.set( 'Z983', BUILTIN_GENERIC_MAP_TYPE_ );
builtinFunctions.set( 'Z986', BUILTIN_CHARS_TO_STRING_ );
builtinFunctions.set( 'Z988', BUILTIN_SAME_ );
builtinFunctions.set( 'Z999', BUILTIN_UNQUOTE_ );

// validators
builtinFunctions.set( 'Z201', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z202', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z203', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z204', BUILTIN_Z4_TYPE_VALIDATOR_ );
builtinFunctions.set( 'Z205', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z206', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z207', BUILTIN_FUNCTION_CALL_VALIDATOR_ );
builtinFunctions.set( 'Z208', BUILTIN_FUNCTION_VALIDATOR_ );
builtinFunctions.set( 'Z209', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z210', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z211', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z212', BUILTIN_MULTILINGUAL_TEXT_VALIDATOR_ );
builtinFunctions.set( 'Z213', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z214', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z216', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z217', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z218', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z220', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z221', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z222', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z223', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z231', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z232', BUILTIN_MULTILINGUAL_STRINGSET_VALIDATOR_ );
builtinFunctions.set( 'Z239', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z240', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z241', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z242', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z250', BUILTIN_ERROR_TYPE_VALIDATOR_ );
builtinFunctions.set( 'Z260', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z261', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z270', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z280', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z286', BUILTIN_EMPTY_VALIDATOR_ );
builtinFunctions.set( 'Z299', BUILTIN_EMPTY_VALIDATOR_ );

/**
 * Retrieves an in-memory JS function implementing a builtin.
 *
 * @param {Object} ZID the function to retrieve an implementation for
 * @return {Implementation} an implementation
 */
function getFunction( ZID ) {
	const result = builtinFunctions.get( ZID );
	if ( result === undefined ) {
		return null;
	}
	return result;
}

const lazyFunctions = new Map();
lazyFunctions.set( 'Z902', [ 'Z802K2', 'Z802K3' ] );

/**
 * Retrieves lazy variables for the given function.
 *
 * @param {string} ZID the function
 * @return {Array} an array of variables which are lazy for the given function
 */
function getLazyVariables( ZID ) {
	let lazy = lazyFunctions.get( ZID );
	if ( lazy === undefined ) {
		lazy = [];
	}
	return lazy;
}

const lazyReturns = new Set();
lazyReturns.add( 'Z902' );

/**
 * For a given ZID, determine whether return value should be evaluated after execution.
 *
 * @param {string} ZID the function
 * @return {boolean} whether the function is lazy
 */
function getLazyReturn( ZID ) {
	return lazyReturns.has( ZID );
}

/**
 * Creates a Z17.
 *
 * @param {string} ZType type of argument (Z17K1)
 * @param {string} argumentName identifier used when calling (Z17K2)
 * @return {Object} a Z17
 */
async function createArgument( ZType, argumentName ) {
	return {
		Z1K1: 'Z17',
		Z17K1: ZType,
		Z17K2: {
			Z1K1: 'Z6',
			Z6K1: argumentName
		},
		Z17K3: {
			Z1K1: 'Z12',
			Z12K1: {
				Z1K1: {
					Z1K1: {
						Z1K1: 'Z9',
						Z9K1: 'Z7'
					},
					Z7K1: {
						Z1K1: 'Z9',
						Z9K1: 'Z881'
					},
					Z881K1: {
						Z1K1: 'Z9',
						Z9K1: 'Z11'
					}
				}
			}
		}
	};
}

/**
 * Creates a Z8 corresponding to a bulitin function.
 *
 * @param {string} identity the function identity
 * @param {Array} argumentList list of Z17s
 * @param {string} returnType ZID of return type
 * @param {string} builtinName ZID reference to builtin implementation
 * @return {Object} a Z8
 */
async function createZ8( identity, argumentList, returnType, builtinName ) {
	return ( await normalize( {
		Z1K1: 'Z8',
		Z8K1: argumentList,
		Z8K2: returnType,
		Z8K3: [],
		Z8K4: [ {
			Z1K1: 'Z14',
			Z14K1: identity,
			Z14K4: {
				Z1K1: 'Z6',
				Z6K1: builtinName
			}
		} ],
		Z8K5: identity
	}, /* generically= */true, /* withVoid= */ true ) ).Z22K1;
}

const builtinReferences = new Map();

( async function populateBuiltinReferences() {
	// TODO (T300993): Wrap all calls to builtinReferences.set in Promises and
	// execute them in parallel with Promise.all.
	builtinReferences.set( 'Z801', await createZ8(
		'Z801',
		[
			await createArgument( 'Z1', 'Z801K1' )
		], 'Z1', 'Z901' ) );

	builtinReferences.set( 'Z802', await createZ8(
		'Z802',
		[
			await createArgument( 'Z40', 'Z802K1' ),
			await createArgument( 'Z1', 'Z802K2' ),
			await createArgument( 'Z1', 'Z802K3' )
		], 'Z1', 'Z902'
	) );
	builtinReferences.set( 'Z803', await createZ8(
		'Z803',
		[
			await createArgument( 'Z39', 'Z803K1' ),
			await createArgument( 'Z1', 'Z803K2' )
		], 'Z1', 'Z903'
	) );
	builtinReferences.set( 'Z804', await createZ8(
		'Z804',
		[
			await createArgument(
				( await normalize( { Z1K1: 'Z7', Z7K1: 'Z881', Z881K1: 'Z39' },
					/* generically= */true, /* withVoid= */ true ) ).Z22K1,
				'Z804K1' ),
			await createArgument( 'Z1', 'Z804K2' )
		],
		( await normalize(
			{ Z1K1: 'Z7', Z7K1: 'Z883', Z883K1: 'Z39', Z883K2: 'Z1' },
			/* generically= */true, /* withVoid= */ true ) ).Z22K1,
		'Z904'
	) );
	builtinReferences.set( 'Z805', await createZ8(
		'Z805',
		[
			await createArgument( 'Z1', 'Z805K1' )
		],
		( await normalize(
			{ Z1K1: 'Z7', Z7K1: 'Z881', Z881K1: { Z1K1: 'Z7', Z7K1: 'Z882', Z882K1: 'Z39', Z882K2: 'Z1' } },
			/* generically= */true, /* withVoid= */ true ) ).Z22K1,
		'Z905'
	) );
	builtinReferences.set( 'Z808', await createZ8(
		'Z808',
		[
			await createArgument(
				( await normalize(
					{ Z1K1: 'Z7', Z7K1: 'Z881', Z881K1: { Z1K1: 'Z7', Z7K1: 'Z882', Z882K1: 'Z39', Z882K2: 'Z1' } },
					/* generically= */true, /* withVoid= */ true ) ).Z22K1,
				'Z808K1' )
		], 'Z1', 'Z908'
	) );
	builtinReferences.set( 'Z810', await createZ8(
		'Z810',
		[
			await createArgument( 'Z1', 'Z810K1' ),
			await createArgument(
				( await normalize( { Z1K1: 'Z7', Z7K1: 'Z881', Z881K1: 'Z1' },
					/* generically= */true, /* withVoid= */ true ) ).Z22K1,
				'Z810K2' )
		], ( await normalize( { Z1K1: 'Z7', Z7K1: 'Z881', Z881K1: 'Z1' },
			/* generically= */true, /* withVoid= */ true ) ).Z22K1, 'Z910'
	) );
	builtinReferences.set( 'Z811', await createZ8(
		'Z811',
		[
			await createArgument(
				( await normalize( { Z1K1: 'Z7', Z7K1: 'Z881', Z881K1: 'Z1' },
					/* generically= */true, /* withVoid= */ true ) ).Z22K1,
				'Z811K1' )
		], 'Z1', 'Z911'
	) );
	builtinReferences.set( 'Z812', await createZ8(
		'Z812',
		[
			await createArgument(
				( await normalize( { Z1K1: 'Z7', Z7K1: 'Z881', Z881K1: 'Z1' },
					/* generically= */true, /* withVoid= */ true ) ).Z22K1,
				'Z812K1' )
		], ( await normalize( { Z1K1: 'Z7', Z7K1: 'Z881', Z881K1: 'Z1' },
			/* generically= */true, /* withVoid= */ true ) ).Z22K1, 'Z912'
	) );
	builtinReferences.set( 'Z813', await createZ8(
		'Z813',
		[
			// TODO (T298054): Update argument validation for built-in list
			// functions to exclude Z10s
			await createArgument(
				( await normalize( { Z1K1: 'Z7', Z7K1: 'Z881', Z881K1: 'Z1' },
					/* generically= */true, /* withVoid= */ true ) ).Z22K1,
				'Z813K1' )
		], 'Z40', 'Z913'
	) );
	builtinReferences.set( 'Z820', await createZ8(
		'Z820',
		[
			await createArgument( 'Z5', 'Z820K1' )
		], 'Z1', 'Z920'
	) );
	builtinReferences.set( 'Z821', await createZ8(
		'Z821',
		[
			await createArgument(
				( await normalize( { Z1K1: 'Z7', Z7K1: 'Z882', Z882K1: 'Z1', Z882K2: 'Z1' },
					/* generically= */true, /* withVoid= */ true ) ).Z22K1,
				'Z821K1' )
		], 'Z1', 'Z921'
	) );
	builtinReferences.set( 'Z822', await createZ8(
		'Z822',
		[
			await createArgument(
				( await normalize( { Z1K1: 'Z7', Z7K1: 'Z882', Z882K1: 'Z1', Z882K2: 'Z1' },
					/* generically= */true, /* withVoid= */ true ) ).Z22K1,
				'Z822K1' )
		], 'Z1', 'Z922'
	) );
	builtinReferences.set( 'Z844', await createZ8(
		'Z844',
		[
			await createArgument( 'Z1', 'Z844K1' ),
			await createArgument( 'Z1', 'Z844K2' )
		], 'Z40', 'Z944'
	) );
	builtinReferences.set( 'Z860', await createZ8(
		'Z860',
		[
			await createArgument( 'Z6', 'Z860K1' )
		], 'Z60', 'Z960'
	) );
	builtinReferences.set( 'Z866', await createZ8(
		'Z866',
		[
			await createArgument( 'Z1', 'Z866K1' ),
			await createArgument( 'Z1', 'Z866K2' )
		], 'Z40', 'Z966'
	) );
	builtinReferences.set( 'Z868', await createZ8(
		'Z868',
		[
			await createArgument( 'Z6', 'Z868K1' )
		], ( await normalize( { Z1K1: 'Z7', Z7K1: 'Z881', Z881K1: 'Z86' },
			/* generically= */true, /* withVoid= */ true ) ).Z22K1, 'Z968'
	) );
	builtinReferences.set( 'Z881', await createZ8(
		'Z881',
		[
			await createArgument( 'Z4', 'Z881K1' )
		], 'Z4', 'Z981'
	) );
	builtinReferences.set( 'Z882', await createZ8(
		'Z882',
		[
			await createArgument( 'Z4', 'Z882K1' ),
			await createArgument( 'Z4', 'Z882K2' )
		], 'Z4', 'Z982'
	) );
	builtinReferences.set( 'Z883', await createZ8(
		'Z883',
		[
			await createArgument( 'Z4', 'Z883K1' ),
			await createArgument( 'Z4', 'Z883K2' )
		], 'Z4', 'Z983'
	) );
	builtinReferences.set( 'Z886', await createZ8(
		'Z886',
		[
			await createArgument( ( await normalize( { Z1K1: 'Z7', Z7K1: 'Z881', Z881K1: 'Z86' },
				/* generically= */true, /* withVoid= */ true ) ).Z22K1, 'Z886K1' )
		], 'Z6', 'Z986'
	) );
	builtinReferences.set( 'Z888', await createZ8(
		'Z888',
		[
			await createArgument( 'Z86', 'Z888K1' ),
			await createArgument( 'Z86', 'Z888K2' )
		], 'Z40', 'Z988'
	) );
	builtinReferences.set( 'Z899', await createZ8(
		'Z899',
		[
			await createArgument( 'Z99', 'Z899K1' )
		], 'Z9', 'Z999'
	) );
	builtinReferences.set( 'Z831', await createZ8(
		'Z831',
		[
			await createArgument( 'Z99', 'Z831K1' ),
			await createArgument( 'Z99', 'Z831K2' )
		], ( await normalize( { Z1K1: 'Z7', Z7K1: 'Z881', Z881K1: 'Z1' },
			/* generically= */true, /* withVoid= */ true ) ).Z22K1, 'Z931'
	) );
}() ).then();

( async function setValidatorsReferences() {
	const CORE_TYPES = [
		'Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7', 'Z8', 'Z9', 'Z10', 'Z11', 'Z12', 'Z13', 'Z14', 'Z16', 'Z17', 'Z18',
		'Z20', 'Z21', 'Z22', 'Z23', 'Z39', 'Z40', 'Z41', 'Z42', 'Z50', 'Z60', 'Z61', 'Z70', 'Z80', 'Z86', 'Z99'
	];

	const promises = CORE_TYPES
		.map( ( zid ) => Number( zid.replace( 'Z', '' ) ) )
		.map( async ( id ) => {
			builtinReferences.set( `Z${id + 100}`, await createZ8(
				`Z${id + 100}`,
				[ await createArgument( 'Z1', `Z${id + 100}K1` ) ],
				`Z${id}`,
				`Z${id + 200}`
			) );
		} );
	await Promise.all( promises );
}() ).then();

/**
 * Creates a Z8 corresponding to a bulitin function.
 *
 * @param {string} ZID reference to a builtin function
 * @return {Object} a Z8 or null
 */
function resolveBuiltinReference( ZID ) {
	const result = builtinReferences.get( ZID );
	if ( result === undefined ) {
		return null;
	}
	return result;
}

module.exports = {
	getFunction, getLazyVariables, getLazyReturn, resolveBuiltinReference,
	resolveListType
};
