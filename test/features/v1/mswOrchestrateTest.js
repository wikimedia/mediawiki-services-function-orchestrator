'use strict';

const assert = require( '../../utils/assert.js' );
const canonicalize = require( '../../../function-schemata/javascript/src/canonicalize.js' );
const normalize = require( '../../../function-schemata/javascript/src/normalize.js' );
const { makeMappedResultEnvelope, makeTrue, setZMapValue, getError } =
	require( '../../../function-schemata/javascript/src/utils.js' );
const { rest } = require( 'msw' );
const { setupServer } = require( 'msw/node' );
const orchestrate = require( '../../../src/orchestrate.js' );
const { readJSON, readZObjectsFromDirectory } = require( '../../../src/read-json.js' );
const { normalError, error } = require( '../../../function-schemata/javascript/src/error.js' );
const { makeVoid } = require( '../../../function-schemata/javascript/src/utils' );

class Canned {

	constructor() {
		this.reset();
	}

	reset() {
		this.dict_ = {
			wiki: readZObjectsFromDirectory( 'function-schemata/data/definitions/' ),
			evaluator: {}
		};
	}

	setWiki( key, value ) {
		this.dict_.wiki[ key ] = value;
	}

	async setEvaluator( key, callback, statusCode = 200 ) {
		this.dict_.evaluator[ key ] = {
			statusCode: statusCode,
			callback: callback
		};
	}

	getWiki( key ) {
		return this.dict_.wiki[ key ];
	}

	getEvaluator( key ) {
		return this.dict_.evaluator[ key ];
	}

}

describe( 'orchestrate', function () { // eslint-disable-line no-undef
	const cannedResponses = new Canned();

	const restHandlers = [
		rest.get( 'http://thewiki', ( req, res, ctx ) => {
			const zids = req.url.searchParams.get( 'zids' );
			const result = {};
			for ( const ZID of zids.split( '|' ) ) {
				result[ ZID ] = {
					wikilambda_fetch: JSON.stringify( cannedResponses.getWiki( ZID ) )
				};
			}
			return res( ctx.status( 200 ), ctx.json( result ) );
		} ),

		rest.post( 'http://theevaluator', async ( req, res, ctx ) => {
			const ZID = req.body.Z7K1.Z8K5.Z9K1;
			const { statusCode, callback } = cannedResponses.getEvaluator( ZID );
			const value = ( await normalize( callback( req.body ) ) ).Z22K1;
			return res( ctx.status( statusCode ), ctx.json( value ) );
		} ),

		// Silently forward GET requests to the API running at :6254.
		rest.get( 'http://localhost:6254/*', ( req, res, ctx ) => {} ) // eslint-disable-line no-unused-vars
	];
	const mockServiceWorker = setupServer( ...restHandlers );

	before( async () => { // eslint-disable-line no-undef
		// Set evaluator response for test "evaluated function call"
		await cannedResponses.setEvaluator( 'Z1000', ( unused ) => makeMappedResultEnvelope( { Z1K1: 'Z6', Z6K1: '13' }, null ) ); // eslint-disable-line no-unused-vars
		// Set evaluator response for test "failed evaluated function call"
		await cannedResponses.setEvaluator( 'Z420420', ( unused ) => 'naw', 500 ); // eslint-disable-line no-unused-vars
		// Set evaluator response for test "evaluated function call, result and empty map"
		await cannedResponses.setEvaluator( 'Z1001', ( unused ) => // eslint-disable-line no-unused-vars
			readJSON( './test/features/v1/test_data/Z22-map-result-only.json' ),
		null );
		// Set evaluator response for test "evaluated function call, result and simple map"
		await cannedResponses.setEvaluator( 'Z1002', ( unused ) => // eslint-disable-line no-unused-vars
			readJSON( './test/features/v1/test_data/Z22-map-basic.json' ),
		null );
		// Set evaluator response for test "evaluated function call, void result"
		const evaluatorResponse = readJSON( './test/features/v1/test_data/Z22-map-error.json' );
		const errorTerm = normalError( [ error.not_wellformed_value ], [ 'Error placeholder' ] );
		setZMapValue( evaluatorResponse.Z22K2, { Z1K1: 'Z6', Z6K1: 'errors' }, errorTerm );
		await cannedResponses.setEvaluator( 'Z1003', ( unused ) => evaluatorResponse, null ); // eslint-disable-line no-unused-vars
		// Set evaluator response for string numeral increment function.
		// Used in scott numeral tests to convert scott numerals to strings.
		await cannedResponses.setEvaluator( 'Z40002', ( zobject ) => makeMappedResultEnvelope( ( parseInt( zobject.Z40002K1.Z6K1 ) + 1 ).toString(), null ) );

		return mockServiceWorker.listen();
	} );

	after( () => { // eslint-disable-line no-undef
		return mockServiceWorker.resetHandlers();
	} );

	const test = function (
		name, zobject, output = null, error = null, implementationSelector = null,
		doValidate = true, skip = false
	) {
		const input = {
			zobject: zobject,
			wikiUri: 'http://thewiki',
			evaluatorUri: 'http://theevaluator',
			doValidate: doValidate
		};
		( skip ? it.skip : it )( 'orchestrate msw: ' + name, async () => { // eslint-disable-line no-undef
			if ( output === null ) {
				output = makeVoid( /* canonical */ true );
			} else {
				output = ( await canonicalize( output, /* withVoid= */ true ) ).Z22K1;
			}
			if ( error === null ) {
				error = makeVoid( /* canonical */ true );
			} else {
				error = ( await canonicalize( error, /* withVoid= */ true ) ).Z22K1;
			}
			let result = {};
			let thrownError = null;
			try {
				result = await orchestrate( input, implementationSelector );
			} catch ( err ) {
				console.trace();
				console.log( err );
				thrownError = err;
			}

			assert.isNull( thrownError, name + ' throws no execution/validation error' );
			assert.deepEqual( output, result.Z22K1, name + ' returns the expected output, if any' );
			assert.deepEqual( error, getError( result ), name + ' returns the expected error, if any' );
		} );
	};

	test(
		'validation error: invalid argument key for function call',
		readJSON( './test/features/v1/test_data/invalid_call_argument_key.json' ),
		null,
		readJSON( './test/features/v1/test_data/invalid_call_argument_key_expected.json' )
	);

	test(
		'validation error: invalid argument type for function call',
		readJSON( './test/features/v1/test_data/invalid_call_argument_type.json' ),
		null,
		readJSON( './test/features/v1/test_data/invalid_call_argument_type_expected.json' )
	);

	test(
		'validation error: invalid duplicated argument key in function definition',
		readJSON( './test/features/v1/test_data/invalid_key_duplicated.json' ),
		null,
		readJSON( './test/features/v1/test_data/invalid_key_duplicated_expected.json' )
	);

	test(
		'validation error: invalid key for first argument in function definition',
		readJSON( './test/features/v1/test_data/invalid_key_first_name.json' ),
		null,
		readJSON( './test/features/v1/test_data/invalid_key_first_name_expected.json' )
	);

	test(
		'validation error: invalid key name for argument in function definition',
		readJSON( './test/features/v1/test_data/invalid_key_name.json' ),
		null,
		readJSON( './test/features/v1/test_data/invalid_key_name_expected.json' )
	);

	test(
		'validation error: invalid non-sequential key for argument in function definition',
		readJSON( './test/features/v1/test_data/invalid_key_nonsequential.json' ),
		null,
		readJSON( './test/features/v1/test_data/invalid_key_nonsequential_expected.json' )
	);

	test(
		'argument type error: argument type does not match declared type',
		readJSON( './test/features/v1/test_data/invalid_call_argument_not_of_declared_type.json' ),
		null,
		readJSON( './test/features/v1/test_data/invalid_call_argument_not_of_declared_type_expected.json' )
	);

	test(
		'return value type error: return value type does not match declared type',
		readJSON( './test/features/v1/test_data/invalid_call_return_value_not_of_declared_type.json' ),
		null,
		readJSON( './test/features/v1/test_data/invalid_call_return_value_not_of_declared_type_expected.json' )
	);

	{
		const mapCall = readJSON( './test/features/v1/test_data/invalid_key_type_passed_to_Z883.json' );
		mapCall.Z883K1 = 'Z1';
		test(
			'argument value error: invalid value for Z883K1 / key type passed to Z883 / Typed Map',
			mapCall,
			null,
			readJSON( './test/features/v1/test_data/invalid_key_type_passed_to_Z883_expected.json' )
		);
	}

	test(
		'input to composition type error: static validation is skipped',
		readJSON( './test/features/v1/test_data/skips_static_validation.json' ),
		null,
		readJSON( './test/features/v1/test_data/skips_static_validation_expected.json' )
	);

	test(
		'input to Z804: missing keys',
		readJSON( './test/features/v1/test_data/Z804_missing_keys.json' ),
		null,
		readJSON( './test/features/v1/test_data/Z804_missing_keys_expected.json' )
	);

	{
		const Z10122 = readJSON( './test/features/v1/test_data/Z10122.json' );
		cannedResponses.setWiki( 'Z10122', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10122' },
			Z2K2: Z10122
		} );
		const theFunctionCall = readJSON( './test/features/v1/test_data/composition-returns-type.json' );
		const returnedType = readJSON( './test/features/v1/test_data/type-returned-by-composition.json' );
		// Set the argument to the composition (which internally calls "echo").
		theFunctionCall.Z7K1.Z8K4[ 1 ].Z14K2.Z801K1 = { ...returnedType };
		// In the actual return value, the generic type will be expanded.
		returnedType.Z4K1.Z7K1 = Z10122;
		test(
			'composition returns type',
			theFunctionCall,
			returnedType,
			null
		);
	}

	{
		const Z50000 = readJSON( './test/features/v1/test_data/generic-composition.json' );
		cannedResponses.setWiki( 'Z50000', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z50000' },
			Z2K2: Z50000
		} );
		const Z50001 = readJSON( './test/features/v1/test_data/generic-composition-implementation.json' );
		cannedResponses.setWiki( 'Z50001', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z50001' },
			Z2K2: Z50001
		} );

		// A type containing K1: list of strings and K2: Boolean.
		const theType = {
			Z1K1: 'Z7',
			Z7K1: 'Z50000',
			Z50000K1: {
				Z1K1: 'Z7',
				Z7K1: 'Z881',
				Z881K1: 'Z6'
			},
			Z50000K2: 'Z40'
		};

		// The input has the above-specified type.
		const theInput = {
			Z1K1: theType,
			K1: [ 'Z6' ],
			K2: {
				Z1K1: 'Z40',
				Z40K1: 'Z42'
			}
		};

		const resolvedType = readJSON( './test/features/v1/test_data/type-returned-by-generic-composition.json' );
		const expectedOutput = {
			Z1K1: resolvedType,
			K1: [ 'Z6' ],
			K2: {
				Z1K1: 'Z40',
				Z40K1: 'Z42'
			}
		};

		// Call <Echo> (Z801) on the input.
		const theFunctionCall = {
			Z1K1: 'Z7',
			Z7K1: {
				Z1K1: 'Z8',
				Z8K1: [
					'Z17'
				],
				Z8K2: theType,
				Z8K3: [ 'Z20' ],
				Z8K4: [
					'Z14',
					{
						Z1K1: 'Z14',
						Z14K1: 'Z50002',
						Z14K2: {
							Z1K1: 'Z7',
							Z7K1: 'Z801',
							Z801K1: theInput
						}
					}
				],
				Z8K5: 'Z50002'
			}
		};

		test(
			'good generic defined as composition',
			theFunctionCall,
			expectedOutput
		);
	}

	{
		const Z50000 = readJSON( './test/features/v1/test_data/generic-composition.json' );
		cannedResponses.setWiki( 'Z50000', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z50000' },
			Z2K2: Z50000
		} );
		const Z50001 = readJSON( './test/features/v1/test_data/generic-composition-implementation.json' );
		cannedResponses.setWiki( 'Z50001', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z50001' },
			Z2K2: Z50001
		} );

		// A type containing K1: list of strings and K2: Boolean.
		const theType = {
			Z1K1: 'Z7',
			Z7K1: 'Z50000',
			Z50000K1: {
				Z1K1: 'Z7',
				Z7K1: 'Z881',
				Z881K1: 'Z6'
			},
			Z50000K2: 'Z40'
		};

		// The input has the above-specified type but fails to be one.
		const theInput = {
			Z1K1: theType,
			K1: 'Not a list of Z6',
			K2: {
				Z1K1: 'Z40',
				Z40K1: 'Z42'
			}
		};

		// Call <Echo> (Z801) on the input.
		const theFunctionCall = {
			Z1K1: 'Z7',
			Z7K1: {
				Z1K1: 'Z8',
				Z8K1: [
					'Z17'
				],
				Z8K2: theType,
				Z8K3: [ 'Z20' ],
				Z8K4: [
					'Z14',
					{
						Z1K1: 'Z14',
						Z14K1: 'Z50002',
						Z14K2: {
							Z1K1: 'Z7',
							Z7K1: 'Z801',
							Z801K1: theInput
						}
					}
				],
				Z8K5: 'Z50002'
			}
		};

		const expectedError = readJSON( './test/features/v1/test_data/bad_generic_composition_expected.json' );

		test(
			'bad generic defined as composition',
			theFunctionCall,
			null,
			expectedError
		);
	}

	{
		cannedResponses.setWiki( 'Z12422', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z12422' },
			Z2K2: readJSON( './test/features/v1/test_data/misnamed-argument-Z12422.json' )
		} );
		test(
			'argument name error: misnamed argument',
			readJSON( './test/features/v1/test_data/misnamed-argument.json' ),
			null,
			readJSON( './test/features/v1/test_data/invalid_call_misnamed_argument_expected.json' )
		);
	}

	{
		cannedResponses.setWiki( 'Z12423', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z12423' },
			Z2K2: readJSON( './test/features/v1/test_data/misnamed-argument-Z12423.json' )
		} );
		test(
			'argument name error: list type misnamed argument',
			readJSON( './test/features/v1/test_data/misnamed-argument-list.json' ),
			null,
			readJSON( './test/features/v1/test_data/invalid_call_misnamed_argument_list_expected.json' )
		);
	}

	{
		cannedResponses.setWiki( 'Z12422', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z12422' },
			Z2K2: readJSON( './test/features/v1/test_data/misnamed-argument-Z12422.json' )
		} );
		test(
			'argument error: missing argument',
			readJSON( './test/features/v1/test_data/missing-argument.json' ),
			null,
			readJSON( './test/features/v1/test_data/invalid_call_missing_argument_expected.json' )
		);
	}

	{
		cannedResponses.setWiki( 'Z10101', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10101' },
			Z2K2: readJSON( './test/features/v1/test_data/Z10101.json' )
		} );
		cannedResponses.setWiki( 'Z101030', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z101030' },
			Z2K2: readJSON( './test/features/v1/test_data/Z10103-bad.json' )
		} );
		const genericIf = readJSON( './test/features/v1/test_data/generic-if.json' );
		genericIf.Z1802K2 = 'Z101030';
		test(
			'generic type validation error: bad list',
			genericIf,
			null,
			readJSON( './test/features/v1/test_data/bad_generic_list_expected.json' )
		);
	}

	{
		cannedResponses.setWiki( 'Z88201', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88201' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88201.json' )
		} );
		cannedResponses.setWiki( 'Z882030', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z882030' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88203-bad.json' )
		} );
		const genericPair = readJSON( './test/features/v1/test_data/generic-pair.json' );
		genericPair.Z1802K2 = 'Z882030';
		test(
			'generic type validation error: bad pair',
			genericPair,
			null,
			readJSON( './test/features/v1/test_data/bad_generic_pair_expected.json' )
		);
	}

	{
		test(
			'evaluated function call',
			readJSON( './test/features/v1/test_data/evaluated.json' ),
			{ Z1K1: 'Z6', Z6K1: '13' },
			null
		);
	}

	{
		test(
			'failed evaluated function call',
			readJSON( './test/features/v1/test_data/evaluated-failed.json' ),
			null,
			{
				Z1K1: 'Z5',
				Z5K1: {
					Z1K1: 'Z507',
					Z507K1: 'Function evaluation failed with status 500: {"Z1K1":"Z6","Z6K1":"naw"}'
				}
			}
		);
	}

	{
		test(
			/* name */ 'evaluated function call, result and empty map',
			/* zobject */ readJSON( './test/features/v1/test_data/evaluated-map-result-only.json' ),
			/* output */ { Z1K1: 'Z6', Z6K1: '13' },
			/* error */ null
		);
	}

	{
		test(
			/* name */ 'evaluated function call, result and simple map',
			/* zobject */ readJSON( './test/features/v1/test_data/evaluated-map-basic.json' ),
			/* output */ { Z1K1: 'Z6', Z6K1: '13' },
			/* error */ null
		);
	}

	{
		test(
			/* name */ 'evaluated function call, void result',
			/* zobject */ readJSON( './test/features/v1/test_data/evaluated-map-error.json' ),
			/* output */ { Z1K1: 'Z9', Z9K1: 'Z24' },
			/* error */ { Z1K1: 'Z5', Z5K1: { Z1K1: 'Z526', Z526K1: 'Error placeholder' } }
		);
	}

	{
		cannedResponses.setWiki( 'Z10037', readJSON( './test/features/v1/test_data/all_Z10037.json' ) );
		test(
			'composition of all empty',
			readJSON( './test/features/v1/test_data/all_empty.json' ),
			{
				Z1K1: {
					Z1K1: 'Z9',
					Z9K1: 'Z40'
				},
				Z40K1: {
					Z1K1: 'Z9',
					Z9K1: 'Z41'
				}
			},
			null
		);
	}

	{
		cannedResponses.setWiki( 'Z10037', readJSON( './test/features/v1/test_data/all_Z10037.json' ) );
		test(
			'composition of all: [true, true]',
			readJSON( './test/features/v1/test_data/all_true_true.json' ),
			{
				Z1K1: {
					Z1K1: 'Z9',
					Z9K1: 'Z40'
				},
				Z40K1: {
					Z1K1: 'Z9',
					Z9K1: 'Z41'
				}
			},
			null
		);
	}

	{
		cannedResponses.setWiki( 'Z10037', readJSON( './test/features/v1/test_data/all_Z10037.json' ) );
		test(
			'composition of all: [true, false]',
			readJSON( './test/features/v1/test_data/all_true_false.json' ),
			{
				Z1K1: {
					Z1K1: 'Z9',
					Z9K1: 'Z40'
				},
				Z40K1: {
					Z1K1: 'Z9',
					Z9K1: 'Z42'
				}
			},
			null
		);
	}

	{
		cannedResponses.setWiki( 'Z10029', readJSON( './test/features/v1/test_data/empty_string_Z10029.json' ) );
		cannedResponses.setWiki( 'Z10031', readJSON( './test/features/v1/test_data/one_character_Z10031.json' ) );
		test(
			'one character("ab")',
			{
				Z1K1: 'Z7',
				Z7K1: 'Z10031',
				Z10031K1: 'ab'
			},
			{
				Z1K1: {
					Z1K1: 'Z9',
					Z9K1: 'Z40'
				},
				Z40K1: {
					Z1K1: 'Z9',
					Z9K1: 'Z42'
				}
			},
			null
		);
	}

	{
		cannedResponses.setWiki( 'Z10029', readJSON( './test/features/v1/test_data/empty_string_Z10029.json' ) );
		cannedResponses.setWiki( 'Z10031', readJSON( './test/features/v1/test_data/one_character_Z10031.json' ) );
		test(
			'one character("a")',
			{
				Z1K1: 'Z7',
				Z7K1: 'Z10031',
				Z10031K1: 'a'
			},
			{
				Z1K1: {
					Z1K1: 'Z9',
					Z9K1: 'Z40'
				},
				Z40K1: {
					Z1K1: 'Z9',
					Z9K1: 'Z41'
				}
			},
			null
		);
	}

	{
		cannedResponses.setWiki( 'Z10029', readJSON( './test/features/v1/test_data/empty_string_Z10029.json' ) );
		cannedResponses.setWiki( 'Z10031', readJSON( './test/features/v1/test_data/one_character_Z10031.json' ) );
		test(
			'one character(<empty>)',
			{
				Z1K1: 'Z7',
				Z7K1: 'Z10031',
				Z10031K1: ''
			},
			{
				Z1K1: {
					Z1K1: 'Z9',
					Z9K1: 'Z40'
				},
				Z40K1: {
					Z1K1: 'Z9',
					Z9K1: 'Z42'
				}
			},
			null
		);
	}

	{
		cannedResponses.setWiki( 'Z10101', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10101' },
			Z2K2: readJSON( './test/features/v1/test_data/Z10101.json' )
		} );
		cannedResponses.setWiki( 'Z10103', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10103' },
			Z2K2: readJSON( './test/features/v1/test_data/Z10103.json' )
		} );
		const genericIf = readJSON( './test/features/v1/test_data/generic-if.json' );
		genericIf.Z1802K2 = 'Z10103';
		test(
			'generic if',
			genericIf,
			readJSON( './test/features/v1/test_data/Z10103-expanded.json' ),
			null
		);
	}

	{
		cannedResponses.setWiki( 'Z88201', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88201' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88201.json' )
		} );
		cannedResponses.setWiki( 'Z88203', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88203' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88203.json' )
		} );
		const genericPair = readJSON( './test/features/v1/test_data/generic-pair.json' );
		genericPair.Z1802K2 = 'Z88203';
		const expected = readJSON( './test/features/v1/test_data/Z88203-expanded.json' );
		const Z831 = readJSON( './test/features/v1/test_data/Z831.json' );
		expected.Z1K1.Z4K3 = Z831;
		test(
			'generic pair',
			genericPair,
			expected,
			null
		);
	}

	{
		cannedResponses.setWiki( 'Z88301', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88301' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88301.json' )
		} );
		cannedResponses.setWiki( 'Z88303', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88303' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88303.json' )
		} );
		cannedResponses.setWiki( 'Z88311', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88311' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88311.json' )
		} );
		cannedResponses.setWiki( 'Z88321', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88321' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88321.json' )
		} );
		const genericMap = readJSON( './test/features/v1/test_data/generic-map.json' );
		genericMap.Z1802K2 = 'Z88303';
		const expected = readJSON( './test/features/v1/test_data/Z88303-expanded.json' );
		const Z831 = readJSON( './test/features/v1/test_data/Z831.json' );
		expected.Z1K1.Z4K3 = Z831;
		test(
			'generic map',
			genericMap,
			expected,
			null
		);
	}

	{
		const mapCall = readJSON( './test/features/v1/test_data/invalid_key_type_passed_to_Z883.json' );
		mapCall.Z883K1 = 'Z6';
		const expected = readJSON( './test/features/v1/test_data/map-key-z6-expected.json' );
		test(
			'map key can be Z6/String',
			mapCall,
			expected
		);
	}

	{
		cannedResponses.setWiki( 'Z10044', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10044' },
			Z2K2: readJSON( './test/features/v1/test_data/map-Z10044.json' )
		} );
		const mapCall = readJSON( './test/features/v1/test_data/map-Z10043.json' );
		test(
			'map "echo" function to a list of items',
			mapCall,
			[
				'Z6',
				'acab'
			]
		);
	}

	{
		const mapCall = readJSON( './test/features/v1/test_data/invalid_key_type_passed_to_Z883.json' );
		mapCall.Z883K1 = 'Z39';
		const expected = readJSON( './test/features/v1/test_data/map-key-z39-expected.json' );
		test(
			'map key can be Z39/Key Reference',
			mapCall,
			expected
		);
	}

	{
		cannedResponses.setWiki( 'Z88401', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88401' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88401.json' )
		} );
		cannedResponses.setWiki( 'Z88402', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88402' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88402.json' )
		} );
		cannedResponses.setWiki( 'Z88403', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88403' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88403.json' )
		} );
		const userDefinedIf = readJSON( './test/features/v1/test_data/user-defined-type.json' );
		userDefinedIf.Z1802K2 = 'Z88403';
		const expected = readJSON( './test/features/v1/test_data/Z88403-expected.json' );
		const Z831 = readJSON( './test/features/v1/test_data/Z831.json' );
		expected.Z1K1.Z4K3 = Z831;
		test(
			'good user-defined type',
			userDefinedIf,
			expected,
			null
		);
	}

	{
		cannedResponses.setWiki( 'Z88401', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88401' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88401.json' )
		} );
		cannedResponses.setWiki( 'Z88402', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88402' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88402.json' )
		} );
		cannedResponses.setWiki( 'Z88404', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88403' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88403-bad.json' )
		} );
		const userDefinedIf = readJSON( './test/features/v1/test_data/user-defined-type.json' );
		userDefinedIf.Z1802K2 = 'Z88404';
		test(
			'bad user-defined type',
			userDefinedIf,
			null,
			readJSON( './test/features/v1/test_data/bad_user_defined_type_expected.json' )
		);
	}

	{
		const Z10005 = readJSON( './test/features/v1/test_data/Z10005.json' );
		cannedResponses.setWiki( 'Z10005', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10005' },
			Z2K2: Z10005
		} );
		const userDefinedEcho = readJSON( './test/features/v1/test_data/user-defined-type-as-reference.json' );
		const typeOnly = readJSON( './test/features/v1/test_data/type-only.json' );
		userDefinedEcho.Z1903K1 = typeOnly;
		const expected = { ...typeOnly };
		expected.Z1K1 = Z10005;
		expected.Z1K1.Z4K3 = readJSON( './test/features/v1/test_data/Z831.json' );
		test(
			'reference to user-defined type',
			userDefinedEcho,
			expected
		);
	}

	{
		class SecondImplementationSelector {
			select( implementations ) {
				return implementations[ 1 ];
			}
		}
		test(
			'multiple implementations',
			readJSON( './test/features/v1/test_data/multiple-implementations.json' ),
			makeTrue(),
			null,
			new SecondImplementationSelector()
		);
	}

	{
		const callToThrow = readJSON( './test/features/v1/test_data/throw.json' );
		const expected = callToThrow.Z820K1;
		test(
			'throw throws Z5s',
			callToThrow,
			null,
			expected
		);
	}

	{
		const callToThrow = readJSON( './test/features/v1/test_data/throw.json' );
		callToThrow.Z820K1 = "I am a string and not an error plz don't throw meeee I will break";
		const expected = readJSON( './test/features/v1/test_data/throw_z6_expected.json' );
		test(
			'throw does not throw Z6s',
			callToThrow,
			null,
			expected
		);
	}

	{
		cannedResponses.setWiki( 'Z100101', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z100101' },
			Z2K2: 'just an ol string'
		} );
		test(
			'referenced object is not correct type',
			readJSON( './test/features/v1/test_data/bad-reference.json' ),
			null,
			{
				Z1K1: 'Z5',
				Z5K1: {
					Z1K1: 'Z507',
					Z507K1: 'Could not dereference Z7K1'
				}
			}
		);
	}

	{
		cannedResponses.setWiki( 'Z10081', readJSON( './test/features/v1/test_data/Z10081.json' ) );
		cannedResponses.setWiki( 'Z10086', readJSON( './test/features/v1/test_data/Z10086.json' ) );
		cannedResponses.setWiki( 'Z10084', readJSON( './test/features/v1/test_data/Z10084.json' ) );
		cannedResponses.setWiki( 'Z10085', readJSON( './test/features/v1/test_data/Z10085.json' ) );
		const validateNonempty = {
			Z1K1: 'Z7',
			Z7K1: 'Z10084',
			Z10084K1: {
				Z1K1: 'Z10081',
				Z10081K1: {
					Z1K1: 'Z6',
					Z6K1: 'x'
				}
			}
		};
		test(
			'Nonempty string with Z10084 validator',
			validateNonempty,
			readJSON( './test/features/v1/test_data/Z10084_nonempty_string_expected.json' ),
			null
		);
	}

	{
		cannedResponses.setWiki( 'Z10081', readJSON( './test/features/v1/test_data/Z10081.json' ) );
		cannedResponses.setWiki( 'Z10086', readJSON( './test/features/v1/test_data/Z10086.json' ) );
		cannedResponses.setWiki( 'Z10084', readJSON( './test/features/v1/test_data/Z10084.json' ) );
		cannedResponses.setWiki( 'Z10085', readJSON( './test/features/v1/test_data/Z10085.json' ) );
		const validateEmpty = {
			Z1K1: 'Z7',
			Z7K1: 'Z10084',
			Z10084K1: {
				Z1K1: 'Z10081',
				Z10081K1: {
					Z1K1: 'Z6',
					Z6K1: ''
				}
			}
		};
		test(
			'Empty string with Z10084 validator',
			validateEmpty,
			null,
			readJSON( './test/features/v1/test_data/Z10084_empty_string_expected.json' )
		);
	}

	{
		cannedResponses.setWiki( 'Z10088', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10088' },
			Z2K2: readJSON( './test/features/v1/test_data/curry-implementation-Z10088.json' )
		} );
		cannedResponses.setWiki( 'Z10087', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10087' },
			Z2K2: readJSON( './test/features/v1/test_data/curry-Z10087.json' )
		} );
		cannedResponses.setWiki( 'Z30086', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z30086' },
			Z2K2: readJSON( './test/features/v1/test_data/curry-call-Z30086.json' )
		} );
		cannedResponses.setWiki( 'Z10007', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10007' },
			Z2K2: readJSON( './test/features/v1/test_data/and-Z10007.json' )
		} );
		const curryCall = {
			Z1K1: 'Z7',
			Z7K1: 'Z30086',
			Z30086K1: 'Z10007',
			Z30086K2: makeTrue(),
			Z30086K3: makeTrue()
		};
		test(
			'curry',
			curryCall,
			makeTrue()
		);
	}

	{
		// Given:
		// g(f) = if(f(false),f(false),f(false)
		// (calling argument f multiple times to make sure nothing funny is happening with the
		// caching)
		// h(x) = lambda y: x
		cannedResponses.setWiki( 'Z10001', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10001' },
			Z2K2: readJSON( './test/features/v1/test_data/save-argument-scope-Z10001.json' )
		} );
		cannedResponses.setWiki( 'Z10002', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10002' },
			Z2K2: readJSON( './test/features/v1/test_data/save-argument-scope-Z10002.json' )
		} );

		// Expect:
		// g(h(true)) = true
		const call = {
			Z1K1: 'Z7',
			Z7K1: 'Z10001',
			Z10001K1: {
				Z1K1: 'Z7',
				Z7K1: 'Z10002',
				Z10002K1: 'Z41'
			}
		};
		test(
			'save argument scope',
			call,
			makeTrue()
		);
	}

	{
		cannedResponses.setWiki(
			'Z100920',
			readJSON( './test/features/v1/test_data/Z100920-wrap.json' ) );
		cannedResponses.setWiki(
			'Z100930',
			readJSON( './test/features/v1/test_data/Z100930-wrap-implementation.json' )
		);
		const wrapCall = {
			Z1K1: 'Z7',
			Z7K1: 'Z100920',
			Z100920K1: 'Z6'
		};
		const expected = {
			Z1K1: 'Z4',
			Z4K1: {
				Z1K1: 'Z7',
				Z7K1: 'Z100920',
				Z100920K1: 'Z6'
			},
			Z4K2: [
				'Z3',
				{
					Z1K1: 'Z3',
					Z3K1: 'Z6',
					Z3K2: {
						Z1K1: 'Z6',
						Z6K1: 'K1'
					},
					Z3K3: {
						Z12K1: [ 'Z11' ],
						Z1K1: 'Z12'
					}
				}
			],
			Z4K3: 'Z100'
		};
		test(
			'wrap type',
			wrapCall,
			expected
		);
	}

	{
		cannedResponses.setWiki(
			'Z20022',
			readJSON( './test/features/v1/test_data/Z20022-natural-number-type.json' ) );
		cannedResponses.setWiki(
			'Z20095',
			readJSON( './test/features/v1/test_data/Z20095-natural-number-from-string.json' ) );
		cannedResponses.setWiki(
			'Z20096',
			readJSON( './test/features/v1/test_data/Z20096-nnfs-implementation.json' ) );
		const naturalNumberCall = {
			Z1K1: 'Z7',
			Z7K1: 'Z20095',
			Z20095K1: '15'
		};
		const expected = {
			Z1K1: 'Z20022',
			Z20022K1: '15'
		};
		test(
			'construct positive integer from string',
			naturalNumberCall,
			expected
		);
	}

	{
		cannedResponses.setWiki( 'Z31000', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z31000' },
			Z2K2: readJSON( './test/features/v1/test_data/bind-binary-Z31000.json' )
		} );
		cannedResponses.setWiki( 'Z31001', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z31001' },
			Z2K2: readJSON( './test/features/v1/test_data/bind-binary-implementation-Z31001.json' )
		} );
		cannedResponses.setWiki( 'Z10007', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10007' },
			Z2K2: readJSON( './test/features/v1/test_data/and-Z10007.json' )
		} );
		const binaryBindCall = {
			Z1K1: 'Z7',
			Z7K1: 'Z31000',
			Z31000K1: 'Z10007',
			Z31000K2: makeTrue()
		};
		test(
			'bind binary function',
			binaryBindCall,
			readJSON( './test/features/v1/test_data/bind-binary-expected.json' )
		);
	}

	{
		const noScrubs = readJSON( './test/features/v1/test_data/no-implementations.json' );
		test(
			'no implementations',
			noScrubs,
			null,
			readJSON( './test/features/v1/test_data/no-implementations-expected.json' )
		);
	}

	{
		cannedResponses.setWiki( 'Z40002', readJSON( './test/features/v1/test_data/string-numeral-increment-Z40002.json' ) );
		const call = {
			Z1K1: 'Z7',
			Z7K1: 'Z40002',
			Z40002K1: '41'
		};
		test(
			'Increment string numeral',
			call,
			'42',
			null
		);
	}

	{
		cannedResponses.setWiki( 'Z40000', readJSON( './test/features/v1/test_data/scott-numeral-zero-Z40000.json' ) );
		cannedResponses.setWiki( 'Z40001', readJSON( './test/features/v1/test_data/scott-numeral-succ-Z40001.json' ) );
		cannedResponses.setWiki( 'Z40002', readJSON( './test/features/v1/test_data/string-numeral-increment-Z40002.json' ) );
		cannedResponses.setWiki( 'Z40003', readJSON( './test/features/v1/test_data/scott-numeral-convert-Z40003.json' ) );
		const call = {
			Z1K1: 'Z7',
			Z7K1: 'Z40003',
			Z40003K1: 'Z40000'
		};
		test(
			'Scott numeral zero',
			call,
			'0',
			null
		);
	}

	{
		cannedResponses.setWiki( 'Z40000', readJSON( './test/features/v1/test_data/scott-numeral-zero-Z40000.json' ) );
		cannedResponses.setWiki( 'Z40001', readJSON( './test/features/v1/test_data/scott-numeral-succ-Z40001.json' ) );
		cannedResponses.setWiki( 'Z40002', readJSON( './test/features/v1/test_data/string-numeral-increment-Z40002.json' ) );
		cannedResponses.setWiki( 'Z40003', readJSON( './test/features/v1/test_data/scott-numeral-convert-Z40003.json' ) );
		const call = {
			Z1K1: 'Z7',
			Z7K1: 'Z40003',
			Z40003K1: {
				Z1K1: 'Z7',
				Z7K1: 'Z40001',
				Z40001K1: 'Z40000'
			}
		};
		test(
			'Scott numeral one',
			call,
			'1',
			null
		);
	}

	{
		cannedResponses.setWiki( 'Z40000', readJSON( './test/features/v1/test_data/scott-numeral-zero-Z40000.json' ) );
		cannedResponses.setWiki( 'Z40001', readJSON( './test/features/v1/test_data/scott-numeral-succ-Z40001.json' ) );
		cannedResponses.setWiki( 'Z40002', readJSON( './test/features/v1/test_data/string-numeral-increment-Z40002.json' ) );
		cannedResponses.setWiki( 'Z40003', readJSON( './test/features/v1/test_data/scott-numeral-convert-Z40003.json' ) );
		const call = {
			Z1K1: 'Z7',
			Z7K1: 'Z40003',
			Z40003K1: {
				Z1K1: 'Z7',
				Z7K1: 'Z40001',
				Z40001K1: {
					Z1K1: 'Z7',
					Z7K1: 'Z40001',
					Z40001K1: 'Z40000'
				}
			}
		};
		test(
			'Scott numeral two',
			call,
			'2',
			null
		);
	}

	{
		// TODO(T310093): Speed this up until and bump up the input values, e.g. to Ackermann(2, 2).
		cannedResponses.setWiki( 'Z40000', readJSON( './test/features/v1/test_data/scott-numeral-zero-Z40000.json' ) );
		cannedResponses.setWiki( 'Z40001', readJSON( './test/features/v1/test_data/scott-numeral-succ-Z40001.json' ) );
		cannedResponses.setWiki( 'Z40002', readJSON( './test/features/v1/test_data/string-numeral-increment-Z40002.json' ) );
		cannedResponses.setWiki( 'Z40003', readJSON( './test/features/v1/test_data/scott-numeral-convert-Z40003.json' ) );
		cannedResponses.setWiki( 'Z40004', readJSON( './test/features/v1/test_data/scott-numeral-ack-Z40004.json' ) );
		const call = {
			Z1K1: 'Z7',
			Z7K1: 'Z40003',
			Z40003K1: {
				Z1K1: 'Z7',
				Z7K1: 'Z40004',
				Z40004K1: {
					Z1K1: 'Z7',
					Z7K1: 'Z40001',
					Z40001K1: 'Z40000'
				},
				Z40004K2: {
					Z1K1: 'Z7',
					Z7K1: 'Z40001',
					Z40001K1: 'Z40000'
				}
			}
		};
		test(
			'Scott numeral Ackermann(1, 1)',
			call,
			'3',
			null
		);
	}

} );
