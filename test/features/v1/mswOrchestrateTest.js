'use strict';

const assert = require( '../../utils/assert.js' );
const canonicalize = require( '../../../function-schemata/javascript/src/canonicalize.js' );
const { makeResultEnvelope, makeTrue, makeFalse } = require( '../../../function-schemata/javascript/src/utils.js' );
const utils = require( '../../../src/utils.js' );
const { rest } = require( 'msw' );
const { setupServer } = require( 'msw/node' );
const orchestrate = require( '../../../src/orchestrate.js' );
const { readJSON, readZObjectsFromDirectory } = require( '../../utils/read-json.js' );

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

	setEvaluator( key, value, statusCode = 200 ) {
		this.dict_.evaluator[ key ] = {
			statusCode: statusCode,
			value: value
		};
	}

	getWiki( key ) {
		return this.dict_.wiki[ key ];
	}

	getEvaluator( key ) {
		return this.dict_.evaluator[ key ];
	}

}

describe( 'orchestrate', function () {
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

		rest.post( 'http://theevaluator', ( req, res, ctx ) => {
			const ZID = req.body.Z7K1.Z8K5.Z9K1;
			const { statusCode, value } = cannedResponses.getEvaluator( ZID );
			return res( ctx.status( statusCode ), ctx.json( value ) );
		} ),

		// Silently forward GET requests to the API running at :6254.
		rest.get( 'http://localhost:6254/*', ( req, res, ctx ) => {} )
	];
	const mockServiceWorker = setupServer( ...restHandlers );

	before( () => mockServiceWorker.listen() );

	after( () => {
		return mockServiceWorker.resetHandlers();
	} );

	const test = function ( name, zobject, output = null, error = null, implementationSelector = null ) {
		const input = {
			zobject: zobject,
			wikiUri: 'http://thewiki',
			evaluatorUri: 'http://theevaluator',
			doValidate: true
		};
		it( 'orchestrate msw: ' + name, async () => {
			if ( output !== null ) {
				output = ( await canonicalize( output ) ).Z22K1;
			}
			if ( error !== null ) {
				error = ( await canonicalize( error ) ).Z22K1;
			}
			let result = {};
			let thrownError = null;
			try {
				result = await orchestrate( input, implementationSelector );
			} catch ( err ) {
				console.trace();
				thrownError = err;
			}
			assert.deepEqual( thrownError, null );
			assert.deepEqual(
				result,
				utils.makeResultEnvelopeAndMaybeCanonicalise( output, error, /* canonical= */ true ),
				name
			);
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
		theFunctionCall.Z7K1.Z8K4[ 0 ].Z14K2.Z801K1 = { ...returnedType };
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
		cannedResponses.setEvaluator( 'Z1000', makeResultEnvelope( { Z1K1: 'Z6', Z6K1: '13' }, null ) );
		test(
			'evaluated function call',
			readJSON( './test/features/v1/test_data/evaluated.json' ),
			{ Z1K1: 'Z6', Z6K1: '13' },
			null
		);
	}

	{
		cannedResponses.setEvaluator( 'Z420420', 'naw', 500 );
		test(
			'failed evaluated function call',
			readJSON( './test/features/v1/test_data/evaluated-failed.json' ),
			null,
			{
				Z1K1: 'Z5',
				Z5K1: {
					Z1K1: 'Z507',
					Z507K1: 'Function evaluation failed with status 500: "naw"'
				}
			}
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
		cannedResponses.setWiki( 'Z10044', readJSON( './test/features/v1/test_data/map_function_Z10044.json' ) );
		cannedResponses.setWiki( 'Z10045', readJSON( './test/features/v1/test_data/map_implementation_Z10045.json' ) );
		test(
			'map (emptiness of lists)',
			{
				Z1K1: 'Z7',
				Z7K1: 'Z10044',
				Z10044K1: 'Z813',
				Z10044K2: [
					[],
					[ 'I am here!' ],
					[ 'I am not :(' ],
					[]
				]
			},
			[ makeTrue(), makeFalse(), makeFalse(), makeTrue() ],
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
					Z507K1: 'Could not dereference Z8K1'
				}
			}
		);
	}
} );
