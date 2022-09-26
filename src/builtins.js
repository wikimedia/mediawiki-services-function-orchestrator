'use strict';

const normalize = require( '../function-schemata/javascript/src/normalize' );
const { createSchema, makeBoolean, traverseZList } = require( './utils.js' );
const { normalError, error } = require( '../function-schemata/javascript/src/error' );
const {
	builtInTypes,
	convertArrayToKnownTypedList,
	convertZListToItemArray,
	isEmptyZList,
	isGlobalKey,
	isString,
	kidFromGlobalKey,
	makeMappedResultEnvelope,
	setMetadataValue,
	makeTrue,
	makeFalse
} = require( '../function-schemata/javascript/src/utils.js' );
const { readJSON } = require( './fileUtils.js' );
const ErrorFormatter = require( '../function-schemata/javascript/src/errorFormatter' );
const {
	validatesAsType,
	validatesAsReference,
	validatesAsFunctionCall
} = require( '../function-schemata/javascript/src/schema.js' );
const { ZWrapper } = require( './ZWrapper' );
const fs = require( 'fs' );

/**
 * HELPER FUNCTIONS
 */

/**
 * Returns true if the input is equivalent to the builtin true value.
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
 * @param {Object} [labelZ12] A Z12 object (in JSON form, not ZWrapper)
 * @return {Object} Constructed Z3 / Key object (in JSON form, not ZWrapper)
 */
function Z3For( typeZ4, nameZ6, labelZ12 = undefined ) {
	if ( labelZ12 === undefined ) {
		labelZ12 = {
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
		};
	}
	return {
		Z1K1: {
			Z1K1: 'Z9',
			Z9K1: 'Z3'
		},
		Z3K1: typeZ4,
		Z3K2: nameZ6,
		Z3K3: labelZ12
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
function Z12For( name ) {
	const typeZ11 = { Z1K1: 'Z9', Z9K1: 'Z11' };
	return {
		Z1K1: {
			Z1K1: 'Z9',
			Z9K1: 'Z12'
		},
		Z12K1: convertArrayToKnownTypedList( [
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
		], typeZ11 )
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

function BUILTIN_VALUES_BY_KEYS_( Z39s, Z1 ) {
	const keyrefs = convertZListToItemArray( Z39s );
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
		const pairList = convertArrayToKnownTypedList( pairArray, pairType );
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

function reifyRecursive( Z1 ) {
	if ( isString( Z1 ) ) {
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
		const value = reifyRecursive( Z1[ key ] );
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
	return convertArrayToKnownTypedList( result, pairType );
}

function BUILTIN_REIFY_( Z1 ) {
	return makeMappedResultEnvelope( reifyRecursive( Z1 ), null );
}

function abstractRecursive( ZList ) {
	if ( ZList.Z1K1 === 'Z6' ) {
		return ZList.Z6K1;
	}
	const result = {};
	const arrayOfPairs = convertZListToItemArray( ZList );
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

function BUILTIN_CONS_( Z1, list ) {
	let itemType = { Z1K1: 'Z9', Z9K1: 'Z1' };

	// if validates as type, type is expanded, itemType is at list.Z1K1.Z4K1.Z881K1
	if ( validatesAsType( list.Z1K1.asJSON() ).isValid() && ( list.Z1K1.Z4K1.Z7K1.Z9K1 === 'Z881' ) ) {
		itemType = list.Z1K1.Z4K1.Z881K1;
	}

	// if validates as function call, type is not expanded, itemType is at list.Z1K1.Z881K1
	if ( validatesAsFunctionCall( list.Z1K1.asJSON() ).isValid() && ( list.Z1K1.Z7K1.Z9K1 === 'Z881' ) ) {
		itemType = list.Z1K1.Z881K1;
	}

	const typedList = convertArrayToKnownTypedList( [ Z1 ], itemType );
	typedList.K2 = list;

	return makeMappedResultEnvelope( typedList, null );
}

function BUILTIN_HEAD_( list ) {
	if ( isEmptyZList( list ) ) {
		return makeMappedResultEnvelope(
			null,
			normalError(
				[ error.argument_type_mismatch ],
				[ 'An empty list has no head.' ] ) );
	}
	return makeMappedResultEnvelope( list.K1, null );
}

function BUILTIN_TAIL_( list ) {
	if ( isEmptyZList( list ) ) {
		return makeMappedResultEnvelope(
			null,
			normalError(
				[ error.argument_type_mismatch ],
				[ 'An empty list has no tail.' ] ) );
	}
	return makeMappedResultEnvelope( list.K2, null );
}

function BUILTIN_EMPTY_( list ) {
	let result;
	if ( isEmptyZList( list ) ) {
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

function stringToCharsInternal( characterArray ) {
	const Z86Array = [];
	const typeZ86 = { Z1K1: 'Z9', Z9K1: 'Z86' };
	for ( const character of characterArray ) {
		Z86Array.push( {
			Z1K1: { Z1K1: 'Z9', Z9K1: 'Z86' },
			Z86K1: { Z1K1: 'Z6', Z6K1: character }
		} );
	}
	return convertArrayToKnownTypedList( Z86Array, typeZ86 );
}

function BUILTIN_STRING_TO_CHARS_( Z6 ) {
	return makeMappedResultEnvelope(
		stringToCharsInternal( Array.from( Z6.Z6K1 ) ),
		null );
}

function charsToStringInternal( list ) {
	const Z86Array = convertZListToItemArray( list );
	const result = [];
	for ( const Z86 of Z86Array ) {
		result.push( Z86.Z6K1 || Z86.Z86K1.Z6K1 );
	}
	return result;
}

function BUILTIN_CHARS_TO_STRING_( list ) {
	// TODO (T294482): Validate input is a List(Z86).
	return makeMappedResultEnvelope(
		{
			Z1K1: 'Z6',
			Z6K1: charsToStringInternal( list ).join( '' )
		},
		null
	);
}

function BUILTIN_TRIGGER_METADATA_( keyZ6, valueZ1 ) {
	let response = makeMappedResultEnvelope( null, null );
	response = setMetadataValue( response, keyZ6, valueZ1 );
	return response;
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
	quotedObject, quotedType, invariants ) {
	// TODO (T290698): Use this instead of BUILTIN_EMPTY_VALIDATOR_.
	const Z1 = quotedObject.Z99K1;
	const Z4 = ( await ( quotedType.Z99K1.resolve(
		invariants, /* originalObject= */null, /* ignoreList= */null,
		/* resolveInternals= */ false, /* doValidate= */ false ) ) ).Z22K1;

	// Ensure all internal type references are resolved.
	// TODO (T297904): Also need to resolve generic types.
	await traverseZList( Z4.Z4K2, async function ( Z3Tail ) {
		await ( Z3Tail.resolveKey(
			[ 'K1', 'Z3K1' ], invariants,
			/* ignoreList= */null, /* resolveInternals= */false ) );
	} );
	const theSchema = createSchema( { Z1K1: Z4.asJSON() } );

	// TODO (T294289): Return validationStatus Z5s as Z22K2.
	const theStatus = theSchema.validateStatus( Z1.asJSON() );
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
 * Validates the keys of a normal Typed List. This functions looks for duplicate or non-sequential
 * keys and keys that don't follow the expected format of (Z)?<identity>Kn.
 *
 * @param {Object} list the Typed List being validated.
 * @param {Function} key a function to get the key of a list element.
 * @param {string} identity the identity of the list's parent.
 *
 * @return {Object} a Typed List of Z5/Error.
 */
function arrayValidator( list, key, identity ) {
	const keys = convertZListToItemArray( list ).map( key );
	const messages = [];

	const seen = new Set();
	for ( let i = 0; i < keys.length; ++i ) {
		const originalKey = keys[ i ];
		let key = originalKey;
		if ( isGlobalKey( key ) ) {
			if ( !originalKey.startsWith( identity ) ) {
				messages.push( `Invalid key at index ${i}: string should start with ${identity}` );
			}
			key = kidFromGlobalKey( key );
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
	Z99, errors, invariants ) {
	const Z1 = Z99.Z99K1;
	const { getArgumentStates } = require( './execute.js' );
	const argumentStates = await getArgumentStates( Z1, invariants, true );
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
		if ( validatesAsType( declaredType ).isValid() ) {
			continue;
		}
		if ( validatesAsReference( declaredType ).isValid() ) {
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

async function BUILTIN_FUNCTION_CALL_VALIDATOR_( Z99, invariants ) {
	const errors = [];
	await BUILTIN_FUNCTION_CALL_VALIDATOR_INTERNAL_( Z99, errors, invariants );

	return makeValidatorResultEnvelope( Z99, errors );
}

async function BUILTIN_MULTILINGUAL_TEXT_VALIDATOR_( Z99, invariants ) {
	const Z1 = Z99.Z99K1;
	const errors = [];
	const Z11s = convertZListToItemArray( Z1.Z12K1 );
	const languages = await Promise.all( Z11s.map( async ( Z11 ) => await ( Z11.resolveKey(
		[ 'Z11K1', 'Z60K1', 'Z6K1' ],
		invariants ).Z22K1 ) ) );

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
	const Z31s = convertZListToItemArray( Z1.Z32K1 );
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

function resolveListType( typeZ4 ) {
	if ( typeZ4 instanceof ZWrapper ) {
		typeZ4 = typeZ4.asJSON();
	}
	const typeZ3 = { Z1K1: 'Z9', Z9K1: 'Z3' };
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
		Z4K2: convertArrayToKnownTypedList( [
			Z3For( typeZ4, { Z1K1: 'Z6', Z6K1: 'K1' }, Z12For( 'head' ) ),
			Z3For( itsMe, { Z1K1: 'Z6', Z6K1: 'K2' }, Z12For( 'tail' ) )
		], typeZ3 ),
		Z4K3: {
			Z1K1: 'Z9',
			Z9K1: 'Z831'
		}
	};
	return makeMappedResultEnvelope( Z4, null );
}

function BUILTIN_GENERIC_LIST_TYPE_( typeZ4 ) {
	return resolveListType( typeZ4 );
}

function BUILTIN_GENERIC_PAIR_TYPE_( firstType, secondType ) {
	const typeZ3 = { Z1K1: 'Z9', Z9K1: 'Z3' };
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
		Z4K2: convertArrayToKnownTypedList( [
			Z3For( firstType, { Z1K1: 'Z6', Z6K1: 'K1' }, Z12For( 'first' ) ),
			Z3For( secondType, { Z1K1: 'Z6', Z6K1: 'K2' }, Z12For( 'second' ) )
		], typeZ3 ),
		Z4K3: {
			Z1K1: 'Z9',
			Z9K1: 'Z831'
		}
	};
	return makeMappedResultEnvelope( Z4, null );
}

function BUILTIN_GENERIC_MAP_TYPE_( keyType, valueType, invariants ) {
	// TODO (T302015) When ZMap keys are extended beyond Z6/String, update accordingly
	const allowedKeyTypes = [ 'Z6', 'Z39' ];
	// TODO (T302032): Use function-schemata version of findIdentity to improve
	// type inference here.
	let identity = keyType;
	while ( identity.Z4K1 !== undefined ) {
		identity = identity.Z4K1;
	}
	if ( !allowedKeyTypes.includes( identity.Z9K1 ) ) {
		const newError = normalError(
			[ error.argument_value_error ],
			[ 'Z883K1', keyType ]
		);
		return makeMappedResultEnvelope( null, newError );
	}
	const itsMe = {
		Z1K1: Z9For( 'Z7' ),
		Z7K1: Z9For( 'Z883' ),
		Z883K1: keyType,
		Z883K2: valueType
	};
	const pairType = BUILTIN_GENERIC_PAIR_TYPE_( keyType, valueType ).Z22K1;
	const listType = BUILTIN_GENERIC_LIST_TYPE_( pairType ).Z22K1;
	const typeZ3 = { Z1K1: 'Z9', Z9K1: 'Z3' };
	const Z4 = {
		Z1K1: {
			Z1K1: 'Z9',
			Z9K1: 'Z4'
		},
		Z4K1: itsMe,
		Z4K2: convertArrayToKnownTypedList( [
			Z3For( listType, { Z1K1: 'Z6', Z6K1: 'K1' }, Z12For( 'elements' ) )
		], typeZ3 ),
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

const builtinReferences = new Map();

function getDefinitionFromFile( ZID ) {
	const fileName = `function-schemata/data/definitions/${ZID}.json`;
	return readJSON( fileName ).Z2K2;
}

// Built-in implementations.
const implementationZIDs = [
	'Z901', 'Z902', 'Z903', 'Z904', 'Z905', 'Z908', 'Z910', 'Z911', 'Z912',
	'Z913', 'Z920', 'Z921', 'Z922', 'Z944', 'Z960', 'Z966', 'Z968',
	// TODO (T314383): Add these ZIDs to the list of implementations. See below.
	/*
     * 'Z981', 'Z982',
     */
	// TODO (T314364): Add this ZID to the list of implementations. See below.
	/*
     * 'Z983',
     */
	'Z986', 'Z988', 'Z999', 'Z931'
];

// Built-in functions.
const functionZIDs = [
	'Z801', 'Z802', 'Z803', 'Z804', 'Z805', 'Z808', 'Z810', 'Z811', 'Z812',
	'Z813', 'Z820', 'Z821', 'Z822', 'Z844', 'Z860', 'Z866', 'Z868',
	'Z881', 'Z882', 'Z883', 'Z886', 'Z888', 'Z899', 'Z831'
];

// Validators for core types.
const validatorZIDs = [
	'Z110', 'Z101', 'Z102', 'Z103', 'Z104', 'Z105', 'Z106', 'Z107', 'Z108',
	'Z109', 'Z111', 'Z112', 'Z114', 'Z116', 'Z117', 'Z118', 'Z120',
	'Z121', 'Z122', 'Z123', 'Z139', 'Z140', 'Z150', 'Z160',
	'Z161', 'Z180', 'Z186', 'Z199',
	'Z210', 'Z201', 'Z202', 'Z203', 'Z204', 'Z205', 'Z206', 'Z207', 'Z208',
	'Z209', 'Z211', 'Z212', 'Z214', 'Z216', 'Z217', 'Z218', 'Z220',
	'Z221', 'Z222', 'Z223', 'Z239', 'Z240', 'Z250', 'Z260',
	'Z261', 'Z280', 'Z286', 'Z299'
];

( function setBuiltinReferences() {
	const implementations = new Map();
	const definitions = new Map();
	for ( const ZID of implementationZIDs ) {
		const theDefinition = getDefinitionFromFile( ZID );
		implementations.set( ZID, theDefinition );
		definitions.set( ZID, theDefinition );
	}

	// TODO (T314364): Undo this special case for Typed Map.
	// We do this because Map has some special validation logic which can't be
	// expressed in the JSON definition without Unions. UNIONIZE NOW
	// TODO (T314383): Undo these special cases for generic List and Pair.
	// Compositions don't currently execute in time for schema validation, so
	// the composition implementations of built-in generic functions produce
	// types which allow anything to validate.
	for ( const ZIDMod100 of [ 81, 82, 83 ] ) {
		const functionZID = 'Z' + ( 800 + ZIDMod100 );
		const implementationZID = 'Z' + ( 900 + ZIDMod100 );
		const theImplementation = {
			Z1K1: 'Z14',
			Z14K1: functionZID,
			Z14K4: {
				Z1K1: 'Z6',
				Z6K1: implementationZID
			}
		};
		implementations.set( implementationZID, theImplementation );
		definitions.set( implementationZID, theImplementation );
	}

	for ( const ZID of functionZIDs ) {
		const theDefinition = getDefinitionFromFile( ZID );
		const Z8K4 = [];
		for ( const element of theDefinition.Z8K4 ) {
			const implementationDefinition = implementations.get( element );
			if ( implementationDefinition === undefined ) {
				Z8K4.push( element );
			} else {
				Z8K4.push( implementationDefinition );
			}
		}
		theDefinition.Z8K4 = Z8K4;
		definitions.set( ZID, theDefinition );
	}
	for ( const ZID of validatorZIDs ) {
		const theDefinition = getDefinitionFromFile( ZID );
		definitions.set( ZID, theDefinition );
	}
	for ( const ZID of builtInTypes() ) {
		const theDefinition = getDefinitionFromFile( ZID );
		definitions.set( ZID, theDefinition );
	}
	for ( const entry of definitions.entries() ) {
		const ZID = entry[ 0 ];
		const definition = entry[ 1 ];
		const normalizedDefinition = (
			normalize( definition, /* generically= */ true, /* withVoid= */ true )
		).Z22K1;
		builtinReferences.set( ZID, normalizedDefinition );
	}
}() );

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
