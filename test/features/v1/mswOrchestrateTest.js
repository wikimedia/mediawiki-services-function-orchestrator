'use strict';

const { makeMappedResultEnvelope, makeTrue, setZMapValue } =
	require( '../../../function-schemata/javascript/src/utils.js' );
const { setupServer } = require( 'msw/node' );
const { readJSON } = require( '../../../src/fileUtils.js' );
const { testDataDir, schemataDefinitionsDir } = require( '../../utils/testFileUtils.js' );
const { makeErrorInNormalForm, error } = require( '../../../function-schemata/javascript/src/error.js' );
const { MediaWikiStub, EvaluatorStub, mockMediaWiki, mockEvaluator, mockLocalhost } = require( '../../../lib/mockUtils.js' );
const { attemptOrchestration, WIKI_URI, EVAL_URI } = require( './mswTestRunner.js' );
const { FirstImplementationSelector, RandomImplementationSelector } = require( '../../../src/implementationSelector' );

describe( 'orchestrate 1', function () { // eslint-disable-line no-undef
	const wikiStub = new MediaWikiStub();
	const evaluatorStub = new EvaluatorStub();

	const mockServiceWorker = setupServer(
		mockMediaWiki( WIKI_URI, wikiStub ),
		mockEvaluator( EVAL_URI, evaluatorStub ),
		mockLocalhost()
	);

	before( async () => { // eslint-disable-line no-undef
		// Set evaluator response for test "evaluated function call"
		evaluatorStub.setZId( 'Z1000', ( unused ) => makeMappedResultEnvelope( { Z1K1: 'Z6', Z6K1: '13' }, null ) ); // eslint-disable-line no-unused-vars
		// Set evaluator response for test "failed evaluated function call"
		evaluatorStub.setZId( 'Z420420', ( unused ) => 'naw', 500 ); // eslint-disable-line no-unused-vars
		// Set evaluator response for test "evaluated function call, result and empty map"
		evaluatorStub.setZId( 'Z1001', ( unused ) => // eslint-disable-line no-unused-vars
			readJSON( testDataDir( 'Z22-map-result-only.json' ) ),
		null );
		// Set evaluator response for test "evaluated function call, result and simple map"
		evaluatorStub.setZId( 'Z1002', ( unused ) => // eslint-disable-line no-unused-vars
			readJSON( testDataDir( 'Z22-map-basic.json' ) ),
		null );
		// Set evaluator response for test "evaluated function call, void result"
		const evaluatorResponse = readJSON( testDataDir( 'Z22-map-error.json' ) );
		const errorTerm = makeErrorInNormalForm( error.not_wellformed_value, [ 'Error placeholder' ] );
		setZMapValue( evaluatorResponse.Z22K2, { Z1K1: 'Z6', Z6K1: 'errors' }, errorTerm );
		evaluatorStub.setZId( 'Z1003', ( unused ) => evaluatorResponse, null ); // eslint-disable-line no-unused-vars
		// Set evaluator response for string numeral increment function.
		// Used in scott numeral tests to convert scott numerals to strings.
		evaluatorStub.setZId( 'Z40002', ( zobject ) => makeMappedResultEnvelope( ( parseInt( zobject.Z40002K1.Z6K1 ) + 1 ).toString(), null ) );
		// Set evaluator response for test "Test with many on-wiki custom types."
		evaluatorStub.setZId( 'Z10143', ( Z10143 ) => makeMappedResultEnvelope( JSON.stringify( Z10143.Z10143K1 ), null ) );
		return mockServiceWorker.listen();
	} );

	after( () => { // eslint-disable-line no-undef
		return mockServiceWorker.resetHandlers();
	} );

	attemptOrchestration(
		/* testName= */ 'validation error: invalid argument key for function call',
		/* functionCall= */ readJSON( testDataDir( 'invalid_call_argument_key.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ testDataDir( 'invalid_call_argument_key_expected.json' ),
		/* expectedExtraMetadata= */ [],
		// Error gets returned before implementation is selected
		/* expectedMissingMetadata= */ [ 'implementationId', 'implementationType' ],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'validation error: invalid argument type for function call',
		/* functionCall= */ readJSON( testDataDir( 'invalid_call_argument_type.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ testDataDir( 'invalid_call_argument_type_expected.json' ),
		/* expectedExtraMetadata= */ [],
		// Error gets returned before implementation is selected
		/* expectedMissingMetadata= */ [ 'implementationId', 'implementationType' ],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'validation error: invalid duplicated argument key in function definition',
		/* functionCall= */ readJSON( testDataDir( 'invalid_key_duplicated.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ testDataDir( 'invalid_key_duplicated_expected.json' ),
		/* expectedExtraMetadata= */ [],
		// Error gets returned before implementation is selected
		/* expectedMissingMetadata= */ [ 'implementationId', 'implementationType' ],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'validation error: invalid key for first argument in function definition',
		/* functionCall= */ readJSON( testDataDir( 'invalid_key_first_name.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ testDataDir( 'invalid_key_first_name_expected.json' ),
		/* expectedExtraMetadata= */ [],
		// Error gets returned before implementation is selected
		/* expectedMissingMetadata= */ [ 'implementationId', 'implementationType' ],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'validation error: invalid key name for argument in function definition',
		/* functionCall= */ readJSON( testDataDir( 'invalid_key_name.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ testDataDir( 'invalid_key_name_expected.json' ),
		/* expectedExtraMetadata= */ [],
		// Error gets returned before implementation is selected
		/* expectedMissingMetadata= */ [ 'implementationId', 'implementationType' ],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'validation error: invalid non-sequential key for argument in function definition',
		/* functionCall= */ readJSON( testDataDir( 'invalid_key_nonsequential.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ testDataDir( 'invalid_key_nonsequential_expected.json' ),
		/* expectedExtraMetadata= */ [],
		// Error gets returned before implementation is selected
		/* expectedMissingMetadata= */ [ 'implementationId', 'implementationType' ],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'argument type error: argument type does not match declared type',
		/* functionCall= */ readJSON( testDataDir( 'invalid_call_argument_not_of_declared_type.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ testDataDir( 'invalid_call_argument_not_of_declared_type_expected.json' ),
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [ 'implementationId' ],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'return value type error: return value type does not match declared type',
		/* functionCall= */ readJSON( testDataDir( 'invalid_call_return_value_not_of_declared_type.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ testDataDir( 'invalid_call_return_value_not_of_declared_type_expected.json' ),
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [ 'implementationId', 'implementationType' ],
		/* implementationSelector= */ null
	);

	{
		const mapCall = readJSON( testDataDir( 'invalid_key_type_passed_to_Z883.json' ) );
		mapCall.Z883K1 = 'Z1';
		attemptOrchestration(
			/* testName= */ 'argument value error: invalid value for Z883K1 / key type passed to Z883 / Typed Map',
			/* functionCall= */ mapCall,
			/* expectedResult= */ null,
			/* expectedResultFile= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ testDataDir( 'invalid_key_type_passed_to_Z883_expected.json' ),
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [],
			/* implementationSelector= */ null
		);
	}

	attemptOrchestration(
		/* testName= */ 'input to composition type error: static validation is skipped',
		/* functionCall= */ readJSON( testDataDir( 'skips_static_validation.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ testDataDir( 'skips_static_validation_expected.json' ),
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [ 'implementationId' ],
		/* implementationSelector= */ null,
		// TODO (T327413): Should be false? What is this testing?
		/* doValidate= */ true,
		// TODO (T327412): Re-enable this test once type comparison is stricter.
		/* skip= */ true
	);

	attemptOrchestration(
		/* testName= */ 'input to Z804: missing keys',
		/* functionCall= */ readJSON( testDataDir( 'Z804_missing_keys.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ testDataDir( 'Z804_missing_keys_expected.json' ),
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	{
		const Z10122 = readJSON( testDataDir( 'Z10122.json' ) );
		wikiStub.setZId( 'Z10122', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10122' },
			Z2K2: Z10122
		} );
		const theFunctionCall = readJSON( testDataDir( 'composition-returns-type.json' ) );
		const returnedType = readJSON( testDataDir( 'type-returned-by-composition.json' ) );
		// Set the argument to the composition (which internally calls "echo").
		theFunctionCall.Z7K1.Z8K4[ 1 ].Z14K2.Z801K1 = { ...returnedType };
		attemptOrchestration(
			/* testName= */ 'composition returns type',
			/* functionCall= */ theFunctionCall,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'composition-returns-type_expected.json' ),
			/* expectedErrorState= */ false,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ null,
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ],
			/* implementationSelector= */ null
		);
	}

	{
		const Z50000 = readJSON( testDataDir( 'generic-composition.json' ) );
		wikiStub.setZId( 'Z50000', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z50000' },
			Z2K2: Z50000
		} );
		const Z50001 = readJSON( testDataDir( 'generic-composition-implementation.json' ) );
		wikiStub.setZId( 'Z50001', {
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

		attemptOrchestration(
			/* testName= */ 'good generic defined as composition',
			/* functionCall= */ theFunctionCall,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'type-returned-by-generic-composition.json' ),
			/* expectedErrorState= */ false,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ null,
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ],
			/* implementationSelector= */ null
		);
	}

	{
		const Z50000 = readJSON( testDataDir( 'generic-composition.json' ) );
		wikiStub.setZId( 'Z50000', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z50000' },
			Z2K2: Z50000
		} );
		const Z50001 = readJSON( testDataDir( 'generic-composition-implementation.json' ) );
		wikiStub.setZId( 'Z50001', {
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

		attemptOrchestration(
			/* testName= */ 'bad generic defined as composition',
			/* functionCall= */ theFunctionCall,
			/* expectedResult= */ null,
			/* expectedResultFile= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ testDataDir( 'bad_generic_composition_expected.json' ),
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ],
			/* implementationSelector= */ null,
			/* implementationSelector= */ null,
			/* doValidate= */ true,
			// TODO (T327412): Re-enable this test once type comparison is stricter.
			/* skip= */ true
		);
	}

	{
		wikiStub.setZId( 'Z12422', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z12422' },
			Z2K2: readJSON( testDataDir( 'misnamed-argument-Z12422.json' ) )
		} );

		attemptOrchestration(
			/* testName= */ 'argument name error: misnamed argument',
			/* functionCall= */ readJSON( testDataDir( 'misnamed-argument.json' ) ),
			/* expectedResult= */ null,
			/* expectedResultFile= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ testDataDir( 'invalid_call_misnamed_argument_expected.json' ),
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ],
			/* implementationSelector= */ null
		);
	}

	{
		wikiStub.setZId( 'Z12423', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z12423' },
			Z2K2: readJSON( testDataDir( 'misnamed-argument-Z12423.json' ) )
		} );

		attemptOrchestration(
			/* testName= */ 'argument name error: list type misnamed argument',
			/* functionCall= */ readJSON( testDataDir( 'misnamed-argument-list.json' ) ),
			/* expectedResult= */ null,
			/* expectedResultFile= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ testDataDir( 'invalid_call_misnamed_argument_list_expected.json' ),
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ],
			/* implementationSelector= */ null
		);
	}

	{
		wikiStub.setZId( 'Z12422', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z12422' },
			Z2K2: readJSON( testDataDir( 'misnamed-argument-Z12422.json' ) )
		} );

		attemptOrchestration(
			/* testName= */ 'argument error: missing argument',
			/* functionCall= */ readJSON( testDataDir( 'missing-argument.json' ) ),
			/* expectedResult= */ null,
			/* expectedResultFile= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ testDataDir( 'invalid_call_missing_argument_expected.json' ),
			/* expectedExtraMetadata= */ [],
			// Error gets returned before implementation is selected
			/* expectedMissingMetadata= */ [ 'implementationId', 'implementationType' ],
			/* implementationSelector= */ null
		);
	}

	{
		wikiStub.setZId( 'Z20044', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z20044' },
			Z2K2: readJSON( testDataDir( 'map_function_Z20044.json' ) )
		} );
		wikiStub.setZId( 'Z20045', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z20045' },
			Z2K2: readJSON( testDataDir( 'map_implementation_Z20045.json' ) )
		} );

		const mapOverSparseList = {
			Z1K1: 'Z7',
			Z7K1: 'Z20044',
			Z20044K1: 'Z813',
			Z20044K2: [
				{
					Z1K1: 'Z7',
					Z7K1: 'Z881',
					Z881K1: 'Z6'
				},
				[ 'Z6' ],
				[ 'Z6', 'I am here!' ],
				[ 'Z6', 'I am not :(' ],
				[ 'Z6' ]
			]
		};

		attemptOrchestration(
			/* testName= */ 'map (emptiness of lists)',
			/* functionCall= */ mapOverSparseList,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'map_emptiness-of-lists_expected.json' ),
			/* expectedErrorState= */ false,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ null,
			/* expectedExtraMetadata= */[],
			/* expectedMissingMetadata= */[],
			/* implementationSelector= */ null,
			/* doValidate= */ true,
			/* skip= */ false
		);
	}

	{
		wikiStub.setZId( 'Z10101', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10101' },
			Z2K2: readJSON( testDataDir( 'Z10101.json' ) )
		} );
		wikiStub.setZId( 'Z101030', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z101030' },
			Z2K2: readJSON( testDataDir( 'Z10103-bad.json' ) )
		} );
		const genericIf = readJSON( testDataDir( 'generic-if.json' ) );
		genericIf.Z1802K2 = 'Z101030';

		attemptOrchestration(
			/* testName= */ 'generic type validation error: bad list',
			/* functionCall= */ genericIf,
			/* expectedResult= */ null,
			/* expectedResultFile= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ testDataDir( 'bad_generic_list_expected.json' ),
			/* expectedExtraMetadata= */ [],
			// Error gets returned before implementation is selected
			/* expectedMissingMetadata= */ [ 'implementationId', 'implementationType' ],
			/* implementationSelector= */ null,
			/* doValidate= */ true,
			// TODO (T327412): Re-enable this test once type comparison is stricter.
			/* skip= */ true
		);
	}

	{
		wikiStub.setZId( 'Z88201', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88201' },
			Z2K2: readJSON( testDataDir( 'Z88201.json' ) )
		} );
		wikiStub.setZId( 'Z882030', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z882030' },
			Z2K2: readJSON( testDataDir( 'Z88203-bad.json' ) )
		} );
		const genericPair = readJSON( testDataDir( 'generic-pair.json' ) );
		genericPair.Z1802K2 = 'Z882030';

		attemptOrchestration(
			/* testName= */ 'generic type validation error: bad pair',
			/* functionCall= */ genericPair,
			/* expectedResult= */ null,
			/* expectedResultFile= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ testDataDir( 'bad_generic_pair_expected.json' ),
			/* expectedExtraMetadata= */ [],
			// Error gets returned before implementation is selected
			/* expectedMissingMetadata= */ [ 'implementationId', 'implementationType' ],
			/* implementationSelector= */ null,
			/* doValidate= */ true,
			// TODO (T327412): Re-enable this test once type comparison is stricter.
			/* skip= */ true
		);
	}

	{
		attemptOrchestration(
			/* testName= */ 'evaluated function call',
			/* functionCall= */ readJSON( testDataDir( 'evaluated.json' ) ),
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'evaluated-13.json' ),
			/* expectedErrorState= */ false,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ null,
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ],
			/* implementationSelector= */ null
		);
	}

	{
		// Here the functionCall is the same as for 'evaluated function call', except with Z1000
		// replaced by Z1099.  Z1099 doesn't appear in evaluatorStub, so an exception is thrown.
		attemptOrchestration(
			/* testName= */ 'evaluated function call throwing an exception',
			/* functionCall= */ readJSON( testDataDir( 'evaluated-with-1099.json' ) ),
			/* expectedResult= */ null,
			/* expectedResultFile= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ testDataDir( 'evaluated-with-1099_expected.json' ),
			/* expectedExtraMetadata= */ [],
			// Error gets returned before implementation metadata is recorded
			/* expectedMissingMetadata= */ [ 'implementationId', 'implementationType' ],
			/* implementationSelector= */ null
		);
	}

	{
		attemptOrchestration(
			/* testName= */ 'failed evaluated function call',
			/* functionCall= */ readJSON( testDataDir( 'evaluated-failed.json' ) ),
			/* expectedResult= */ null,
			/* expectedResultFile= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ testDataDir( 'evaluated-failed_expected.json' ),
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ],
			/* implementationSelector= */ null
		);
	}

	{
		attemptOrchestration(
			/* testName= */ 'evaluated function call, result and empty map',
			/* functionCall= */ readJSON( testDataDir( 'evaluated-map-result-only.json' ) ),
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'evaluated-map-13.json' ),
			/* expectedErrorState= */ false,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ null,
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ],
			/* implementationSelector= */ null
		);
	}

	{
		attemptOrchestration(
			/* testName= */ 'evaluated function call, result and simple map',
			/* functionCall= */ readJSON( testDataDir( 'evaluated-map-basic.json' ) ),
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'evaluated-map-basic-13.json' ),
			/* expectedErrorState= */ false,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ null,
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ],
			/* implementationSelector= */ null
		);
	}

	{
		attemptOrchestration(
			/* testName= */ 'evaluated function call, void result',
			/* functionCall= */ readJSON( testDataDir( 'evaluated-map-error.json' ) ),
			/* expectedResult= */ null,
			/* expectedResultFile= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ testDataDir( 'evaluated-map-error_expected.json' ),
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ],
			/* implementationSelector= */ null
		);
	}

	{
		wikiStub.setZId( 'Z10037', readJSON( testDataDir( 'all_Z10037.json' ) ) );
		attemptOrchestration(
			/* testName= */ 'composition of all empty',
			/* functionCall= */ readJSON( testDataDir( 'all_empty.json' ) ),
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'all_empty_expected.json' ),
			/* expectedErrorState= */ false,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ null,
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ],
			/* implementationSelector= */ null
		);
	}

	{
		wikiStub.setZId( 'Z10037', readJSON( testDataDir( 'all_Z10037.json' ) ) );
		attemptOrchestration(
			/* testName= */ 'composition of all: [true, true]',
			/* functionCall= */ readJSON( testDataDir( 'all_true_true.json' ) ),
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'all_true_true_expected.json' ),
			/* expectedErrorState= */ false,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ null,
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ],
			/* implementationSelector= */ null
		);
	}

	{
		wikiStub.setZId( 'Z10037', readJSON( testDataDir( 'all_Z10037.json' ) ) );
		attemptOrchestration(
			/* testName= */ 'composition of all: [true, false]',
			/* functionCall= */ readJSON( testDataDir( 'all_true_false.json' ) ),
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'all_true_false_expected.json' ),
			/* expectedErrorState= */ false,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ null,
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ],
			/* implementationSelector= */ null
		);
	}

	{
		wikiStub.setZId( 'Z10029', readJSON( './test/features/v1/test_data/empty_string_Z10029.json' ) );
		wikiStub.setZId( 'Z10031', readJSON( './test/features/v1/test_data/one_character_Z10031.json' ) );
		const input = {
			Z1K1: 'Z7',
			Z7K1: 'Z10031',
			Z10031K1: 'ab'
		};
		attemptOrchestration(
			/* testName= */ 'one character("ab")',
			/* functionCall= */ input,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'one_character_ab_expected.json' ),
			/* expectedErrorState= */ false,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ null,
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ],
			/* implementationSelector= */ null
		);
	}

	{
		wikiStub.setZId( 'Z10029', readJSON( './test/features/v1/test_data/empty_string_Z10029.json' ) );
		wikiStub.setZId( 'Z10031', readJSON( './test/features/v1/test_data/one_character_Z10031.json' ) );
		const input = {
			Z1K1: 'Z7',
			Z7K1: 'Z10031',
			Z10031K1: 'a'
		};
		attemptOrchestration(
			/* testName= */ 'one character("a")',
			/* functionCall= */ input,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'one_character_a_expected.json' ),
			/* expectedErrorState= */ false,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ null,
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ],
			/* implementationSelector= */ null
		);
	}

	{
		wikiStub.setZId( 'Z10029', readJSON( './test/features/v1/test_data/empty_string_Z10029.json' ) );
		wikiStub.setZId( 'Z10031', readJSON( './test/features/v1/test_data/one_character_Z10031.json' ) );
		const input = {
			Z1K1: 'Z7',
			Z7K1: 'Z10031',
			Z10031K1: ''
		};
		attemptOrchestration(
			/* testName= */ 'one character(<empty>)',
			/* functionCall= */ input,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'one_character_empty_expected.json' ),
			/* expectedErrorState= */ false,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ null,
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ],
			/* implementationSelector= */ null
		);
	}

	{
		wikiStub.setZId( 'Z10101', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10101' },
			Z2K2: readJSON( testDataDir( 'Z10101.json' ) )
		} );
		wikiStub.setZId( 'Z10103', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10103' },
			Z2K2: readJSON( testDataDir( 'Z10103.json' ) )
		} );
		const genericIf = readJSON( testDataDir( 'generic-if.json' ) );
		genericIf.Z1802K2 = 'Z10103';
		attemptOrchestration(
			/* testName= */ 'generic if',
			/* functionCall= */ genericIf,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'Z10103-expanded.json' ),
			/* expectedErrorState= */ false
		);
	}

	{
		wikiStub.setZId( 'Z88201', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88201' },
			Z2K2: readJSON( testDataDir( 'Z88201.json' ) )
		} );
		wikiStub.setZId( 'Z88203', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88203' },
			Z2K2: readJSON( testDataDir( 'Z88203.json' ) )
		} );
		const genericPair = readJSON( testDataDir( 'generic-pair.json' ) );
		genericPair.Z1802K2 = 'Z88203';
		attemptOrchestration(
			/* testName= */ 'generic pair',
			/* functionCall= */ genericPair,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'Z88203-expanded.json' ),
			/* expectedErrorState= */ false
		);
	}

	{
		wikiStub.setZId( 'Z88301', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88301' },
			Z2K2: readJSON( testDataDir( 'Z88301.json' ) )
		} );
		wikiStub.setZId( 'Z88303', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88303' },
			Z2K2: readJSON( testDataDir( 'Z88303.json' ) )
		} );
		wikiStub.setZId( 'Z88311', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88311' },
			Z2K2: readJSON( testDataDir( 'Z88311.json' ) )
		} );
		wikiStub.setZId( 'Z88321', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88321' },
			Z2K2: readJSON( testDataDir( 'Z88321.json' ) )
		} );
		const genericMap = readJSON( testDataDir( 'generic-map.json' ) );
		genericMap.Z1802K2 = 'Z88303';
		attemptOrchestration(
			/* testName= */ 'generic map',
			/* functionCall= */ genericMap,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'Z88303-expanded.json' ),
			/* expectedErrorState= */ false
		);
	}

	{
		const mapCall = readJSON( testDataDir( 'invalid_key_type_passed_to_Z883.json' ) );
		mapCall.Z883K1 = 'Z6';
		attemptOrchestration(
			/* testName= */ 'map key can be Z6/String',
			/* functionCall= */ mapCall,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'map-key-z6-expected.json' ),
			/* expectedErrorState= */ false
		);
	}

	{
		wikiStub.setZId( 'Z10044', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10044' },
			Z2K2: readJSON( testDataDir( 'map-Z10044.json' ) )
		} );
		const mapCall = readJSON( testDataDir( 'map-Z10043.json' ) );
		attemptOrchestration(
			/* testName= */ 'map "echo" function to a list of items',
			/* functionCall= */ mapCall,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'map_echo_expected.json' ),
			/* expectedErrorState= */ false,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ null,
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ],
			/* implementationSelector= */ null
		);
	}

	{
		const mapCall = readJSON( testDataDir( 'invalid_key_type_passed_to_Z883.json' ) );
		mapCall.Z883K1 = 'Z39';
		attemptOrchestration(
			/* testName= */ 'map key can be Z39/Key Reference',
			/* functionCall= */ mapCall,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'map-key-z39-expected.json' ),
			/* expectedErrorState= */ false
		);
	}

	{
		wikiStub.setZId( 'Z88401', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88401' },
			Z2K2: readJSON( testDataDir( 'Z88401.json' ) )
		} );
		wikiStub.setZId( 'Z88402', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88402' },
			Z2K2: readJSON( testDataDir( 'Z88402.json' ) )
		} );
		wikiStub.setZId( 'Z88403', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88403' },
			Z2K2: readJSON( testDataDir( 'Z88403.json' ) )
		} );
		const userDefinedIf = readJSON( testDataDir( 'user-defined-type.json' ) );
		userDefinedIf.Z1802K2 = 'Z88403';
		attemptOrchestration(
			/* testName= */ 'good user-defined type',
			/* functionCall= */ userDefinedIf,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'Z88403-expected.json' ),
			/* expectedErrorState= */ false
		);
	}

	{
		wikiStub.setZId( 'Z88401', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88401' },
			Z2K2: readJSON( testDataDir( 'Z88401.json' ) )
		} );
		wikiStub.setZId( 'Z88402', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88402' },
			Z2K2: readJSON( testDataDir( 'Z88402.json' ) )
		} );
		wikiStub.setZId( 'Z88404', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88403' },
			Z2K2: readJSON( testDataDir( 'Z88403-bad.json' ) )
		} );
		const userDefinedIf = readJSON( testDataDir( 'user-defined-type.json' ) );
		userDefinedIf.Z1802K2 = 'Z88404';
		attemptOrchestration(
			/* testName= */ 'bad user-defined type',
			/* functionCall= */ userDefinedIf,
			/* expectedResult= */ null,
			/* expectedResultFile= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ testDataDir( 'bad_user_defined_type_expected.json' ),
			/* expectedExtraMetadata= */ [],
			// Error gets returned before implementation is selected
			/* expectedMissingMetadata= */ [ 'implementationId', 'implementationType' ],
			/* implementationSelector= */ null,
			/* doValidate= */ true,
			// TODO (T327412): Re-enable this test once type comparison is stricter.
			/* skip= */ true );
	}

	{
		const Z10005 = readJSON( testDataDir( 'Z10005.json' ) );
		wikiStub.setZId( 'Z10005', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10005' },
			Z2K2: Z10005
		} );
		const userDefinedEcho = readJSON( testDataDir( 'user-defined-type-as-reference.json' ) );
		const typeOnly = readJSON( testDataDir( 'type-only.json' ) );
		userDefinedEcho.Z1903K1 = typeOnly;
		attemptOrchestration(
			/* testName= */ 'reference to user-defined type',
			/* functionCall= */ userDefinedEcho,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'type-only_expected.json' ),
			/* expectedErrorState= */ false
		);
	}

	{
		const basicMetadataInsertionCall = {
			Z1K1: 'Z7',
			Z7K1: 'Z820',
			Z820K1: {
				Z1K1: 'Z6',
				Z6K1: 'test'
			},
			Z820K2: {
				Z1K1: 'Z6',
				Z6K1: 'Test value!'
			}
		};

		attemptOrchestration(
			/* testName= */ 'basic meta-data creation call',
			/* functionCall= */ basicMetadataInsertionCall,
			/* expectedResult= */ null,
			/* expectedResultFile= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ null,
			/* expectedExtraMetadata= */ [ 'test' ],
			/* expectedMissingMetadata= */ [],
			/* implementationSelector= */ null
		);
	}

	{
		const callToThrow = readJSON( testDataDir( 'throw.json' ) );
		attemptOrchestration(
			/* testName= */ 'throw throws Z5s',
			/* functionCall= */ callToThrow,
			/* expectedResult= */ null,
			/* expectedResultFile= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ testDataDir( 'throw_expected.json' )
		);
	}

	{
		wikiStub.setZId( 'Z100101', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z100101' },
			Z2K2: 'just an ol string'
		} );
		attemptOrchestration(
			/* testName= */ 'referenced object is not correct type',
			/* functionCall= */ readJSON( testDataDir( 'bad-reference.json' ) ),
			/* expectedResult= */ null,
			/* expectedResultFile= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ testDataDir( 'bad-reference_expected.json' ),
			/* expectedExtraMetadata= */ [],
			// Error gets returned before implementation is selected
			/* expectedMissingMetadata= */ [ 'implementationId', 'implementationType' ],
			/* implementationSelector= */ null
		);
	}

	{
		wikiStub.setZId( 'Z10081', readJSON( testDataDir( 'Z10081.json' ) ) );
		wikiStub.setZId( 'Z10086', readJSON( testDataDir( 'Z10086.json' ) ) );
		wikiStub.setZId( 'Z10084', readJSON( testDataDir( 'Z10084.json' ) ) );
		wikiStub.setZId( 'Z10085', readJSON( testDataDir( 'Z10085.json' ) ) );
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
		attemptOrchestration(
			/* testName= */ 'Nonempty string with Z10084 validator',
			/* functionCall= */ validateNonempty,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'Z10084_nonempty_string_expected.json' ),
			/* expectedErrorState= */ false
		);
	}

	{
		wikiStub.setZId( 'Z10081', readJSON( testDataDir( 'Z10081.json' ) ) );
		wikiStub.setZId( 'Z10086', readJSON( testDataDir( 'Z10086.json' ) ) );
		wikiStub.setZId( 'Z10084', readJSON( testDataDir( 'Z10084.json' ) ) );
		wikiStub.setZId( 'Z10085', readJSON( testDataDir( 'Z10085.json' ) ) );
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

		attemptOrchestration(
			/* testName= */ 'Empty string with Z10084 validator',
			/* functionCall= */ validateEmpty,
			/* expectedResult= */ null,
			/* expectedResultFile= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ testDataDir( 'Z10084_empty_string_expected.json' )
		);
	}

	{
		wikiStub.setZId( 'Z10088', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10088' },
			Z2K2: readJSON( testDataDir( 'curry-implementation-Z10088.json' ) )
		} );
		wikiStub.setZId( 'Z10087', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10087' },
			Z2K2: readJSON( testDataDir( 'curry-Z10087.json' ) )
		} );
		wikiStub.setZId( 'Z30086', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z30086' },
			Z2K2: readJSON( testDataDir( 'curry-call-Z30086.json' ) )
		} );
		wikiStub.setZId( 'Z10007', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10007' },
			Z2K2: readJSON( testDataDir( 'and-Z10007.json' ) )
		} );
		const curryCall = {
			Z1K1: 'Z7',
			Z7K1: 'Z30086',
			Z30086K1: 'Z10007',
			Z30086K2: makeTrue(),
			Z30086K3: makeTrue()
		};
		attemptOrchestration(
			/* testName= */ 'curry',
			/* functionCall= */ curryCall,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'curry_expected.json' ),
			/* expectedErrorState= */ false,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ null,
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ]
		);
	}

	{
		// Given:
		// g(f) = if(f(false),f(false),f(false)
		// (calling argument f multiple times to make sure nothing funny is happening with the
		// caching)
		// h(x) = lambda y: x
		wikiStub.setZId( 'Z10001', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10001' },
			Z2K2: readJSON( testDataDir( 'save-argument-scope-Z10001.json' ) )
		} );
		wikiStub.setZId( 'Z10002', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10002' },
			Z2K2: readJSON( testDataDir( 'save-argument-scope-Z10002.json' ) )
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
		attemptOrchestration(
			/* testName= */ 'save argument scope',
			/* functionCall= */ call,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'save-scope_expected.json' ),
			/* expectedErrorState= */ false,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ null,
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ]
		);
	}

	{
		wikiStub.setZId(
			'Z100920',
			readJSON( testDataDir( 'Z100920-wrap.json' ) ) );
		wikiStub.setZId(
			'Z100930',
			readJSON( testDataDir( 'Z100930-wrap-implementation.json' ) )
		);
		const wrapCall = {
			Z1K1: 'Z7',
			Z7K1: 'Z100920',
			Z100920K1: 'Z6'
		};
		attemptOrchestration(
			/* testName= */ 'wrap type',
			/* functionCall= */ wrapCall,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'wrap_expected.json' ),
			/* expectedErrorState= */ false
		);
	}

	{
		wikiStub.setZId(
			'Z20022',
			readJSON( testDataDir( 'Z20022-natural-number-type.json' ) ) );
		wikiStub.setZId(
			'Z20095',
			readJSON( testDataDir( 'Z20095-natural-number-from-string.json' ) ) );
		wikiStub.setZId(
			'Z20096',
			readJSON( testDataDir( 'Z20096-nnfs-implementation.json' ) ) );
		const naturalNumberCall = {
			Z1K1: 'Z7',
			Z7K1: 'Z20095',
			Z20095K1: '15'
		};
		attemptOrchestration(
			/* testName= */ 'construct positive integer from string',
			/* functionCall= */ naturalNumberCall,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'positive-integer-15.json' ),
			/* expectedErrorState= */ false
		);
	}

	{
		wikiStub.setZId( 'Z31000', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z31000' },
			Z2K2: readJSON( testDataDir( 'bind-binary-Z31000.json' ) )
		} );
		wikiStub.setZId( 'Z31001', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z31001' },
			Z2K2: readJSON( testDataDir( 'bind-binary-implementation-Z31001.json' ) )
		} );
		wikiStub.setZId( 'Z10007', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10007' },
			Z2K2: readJSON( testDataDir( 'and-Z10007.json' ) )
		} );
		const binaryBindCall = {
			Z1K1: 'Z7',
			Z7K1: 'Z31000',
			Z31000K1: 'Z10007',
			Z31000K2: makeTrue()
		};
		attemptOrchestration(
			/* testName= */ 'bind binary function',
			/* functionCall= */ binaryBindCall,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'bind-binary-expected.json' ),
			/* expectedErrorState= */ false
		);
	}

	{
		const noScrubs = readJSON( './test/features/v1/test_data/no-implementations.json' );
		attemptOrchestration(
			/* testName= */ 'no implementations',
			/* functionCall= */ noScrubs,
			/* expectedResult= */ null,
			/* expectedResultFile= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ testDataDir( 'no-implementations-expected.json' ),
			/* expectedExtraMetadata= */ [],
			// Error gets returned before implementation is selected
			/* expectedMissingMetadata= */ [ 'implementationId', 'implementationType' ],
			/* implementationSelector= */ null
		);
	}

	{
		wikiStub.setZId( 'Z40002', readJSON( testDataDir( 'string-numeral-increment-Z40002.json' ) ) );
		const call = {
			Z1K1: 'Z7',
			Z7K1: 'Z40002',
			Z40002K1: '41'
		};
		attemptOrchestration(
			/* testName= */ 'Increment string numeral',
			/* functionCall= */ call,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'expected-42.json' ),
			/* expectedErrorState= */ false,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ null,
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ]
		);
	}

	{
		wikiStub.setZId( 'Z40000', readJSON( testDataDir( 'scott-numeral-zero-Z40000.json' ) ) );
		wikiStub.setZId( 'Z40001', readJSON( testDataDir( 'scott-numeral-succ-Z40001.json' ) ) );
		wikiStub.setZId( 'Z40002', readJSON( testDataDir( 'string-numeral-increment-Z40002.json' ) ) );
		wikiStub.setZId( 'Z40003', readJSON( testDataDir( 'scott-numeral-convert-Z40003.json' ) ) );
		const call = {
			Z1K1: 'Z7',
			Z7K1: 'Z40003',
			Z40003K1: 'Z40000'
		};
		attemptOrchestration(
			/* testName= */ 'Scott numeral zero',
			/* functionCall= */ call,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'expected-0.json' ),
			/* expectedErrorState= */ false,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ null,
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ]
		);
	}

	{
		wikiStub.setZId( 'Z40000', readJSON( testDataDir( 'scott-numeral-zero-Z40000.json' ) ) );
		wikiStub.setZId( 'Z40001', readJSON( testDataDir( 'scott-numeral-succ-Z40001.json' ) ) );
		wikiStub.setZId( 'Z40002', readJSON( testDataDir( 'string-numeral-increment-Z40002.json' ) ) );
		wikiStub.setZId( 'Z40003', readJSON( testDataDir( 'scott-numeral-convert-Z40003.json' ) ) );
		const call = {
			Z1K1: 'Z7',
			Z7K1: 'Z40003',
			Z40003K1: {
				Z1K1: 'Z7',
				Z7K1: 'Z40001',
				Z40001K1: 'Z40000'
			}
		};
		attemptOrchestration(
			/* testName= */ 'Scott numeral one',
			/* functionCall= */ call,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'expected-1.json' ),
			/* expectedErrorState= */ false,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ null,
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ]
		);
	}

	{
		wikiStub.setZId( 'Z40000', readJSON( testDataDir( 'scott-numeral-zero-Z40000.json' ) ) );
		wikiStub.setZId( 'Z40001', readJSON( testDataDir( 'scott-numeral-succ-Z40001.json' ) ) );
		wikiStub.setZId( 'Z40002', readJSON( testDataDir( 'string-numeral-increment-Z40002.json' ) ) );
		wikiStub.setZId( 'Z40003', readJSON( testDataDir( 'scott-numeral-convert-Z40003.json' ) ) );
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
		attemptOrchestration(
			/* testName= */ 'Scott numeral two',
			/* functionCall= */ call,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'expected-2.json' ),
			/* expectedErrorState= */ false,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ null,
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ]
		);
	}

	{
		// TODO(T310093): Speed this up until and bump up the input values, e.g. to Ackermann(2, 2).
		wikiStub.setZId( 'Z40000', readJSON( testDataDir( 'scott-numeral-zero-Z40000.json' ) ) );
		wikiStub.setZId( 'Z40001', readJSON( testDataDir( 'scott-numeral-succ-Z40001.json' ) ) );
		wikiStub.setZId( 'Z40002', readJSON( testDataDir( 'string-numeral-increment-Z40002.json' ) ) );
		wikiStub.setZId( 'Z40003', readJSON( testDataDir( 'scott-numeral-convert-Z40003.json' ) ) );
		wikiStub.setZId( 'Z40004', readJSON( testDataDir( 'scott-numeral-ack-Z40004.json' ) ) );
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
		attemptOrchestration(
			/* testName= */ 'Scott numeral Ackermann(1, 1)',
			/* functionCall= */ call,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'expected-3.json' ),
			/* expectedErrorState= */ false,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ null,
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ]
		);
	}

	{
		const call = {
			Z1K1: 'Z7',
			Z7K1: 'Z803',
			Z803K1: {
				Z1K1: 'Z39',
				Z39K1: {
					Z1K1: 'Z6',
					Z6K1: 'Z4K3'
				}
			},
			Z803K2: 'Z40'
		};
		attemptOrchestration(
			/* testName= */ 'Built-ins are resolved when they are an argument to a function.',
			/* functionCall= */ call,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'expected-Z140.json' ),
			/* expectedErrorState= */ false
		);
	}

	{
		const call = {
			Z1K1: 'Z7',
			Z7K1: 'Z803',
			Z803K1: {
				Z1K1: 'Z39',
				Z39K1: {
					Z1K1: 'Z6',
					Z6K1: 'Z4K2'
				}
			},
			Z803K2: 'Z40'
		};
		attemptOrchestration(
			/* testName= */ 'Built-ins are still resolved when they are an argument to a function.',
			/* functionCall= */ call,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'expected-Z40-Z4K2.json' ),
			/* expectedErrorState= */ false
		);
	}

	{
		wikiStub.setZId( 'Z10144', readJSON( testDataDir( 'Z10144.json' ) ) );
		wikiStub.setZId( 'Z10143', readJSON( testDataDir( 'Z10143.json' ) ) );
		wikiStub.setZId( 'Z10139', readJSON( testDataDir( 'Z10139.json' ) ) );
		wikiStub.setZId( 'Z10138', readJSON( testDataDir( 'Z10138.json' ) ) );
		wikiStub.setZId( 'Z10015', readJSON( testDataDir( 'Z10015.json' ) ) );
		const call = {
			Z1K1: 'Z7',
			Z7K1: 'Z10143',
			Z10143K1: {
				Z1K1: 'Z10139',
				Z10139K1: '111',
				Z10139K2: [
					'Z10138',
					{
						Z1K1: 'Z10138',
						Z10138K1: {
							Z1K1: 'Z10015',
							Z10015K1: '222'
						},
						Z10138K2: '333',
						Z10138K3: '444'
					}
				]
			}
		};
		attemptOrchestration(
			/* testName= */ 'Test with many on-wiki custom types',
			/* functionCall= */ call,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'expected-on-wiki-types.json' ),
			/* expectedErrorState= */ false
		);
	}

	{
		wikiStub.setZId( 'Z100005', readJSON( testDataDir( 'Z100005.json' ) ) );
		const call = {
			Z1K1: 'Z7',
			Z7K1: 'Z801',
			Z801K1: [
				'Z6',
				'Z100005',
				'less precious string'
			]
		};
		attemptOrchestration(
			/* testName= */ 'Test that non-top-level argument values are resolved',
			/* functionCall= */ call,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'expected-non-top-level-reference.json' ),
			/* expectedErrorState= */ false
		);
	}

	{
		const call = {
			Z1K1: 'Z7',
			Z7K1: {
				Z1K1: 'Z8',
				Z8K1: [
					'Z17',
					{
						Z1K1: 'Z17',
						Z17K1: {
							Z1K1: 'Z9',
							Z9K1: 'Z6'
						},
						Z17K2: 'Z1000006K1',
						Z17K3: {
							Z1K1: 'Z12',
							Z12K1: [ 'Z11' ]
						}
					}
				],
				Z8K2: {
					Z1K1: 'Z7',
					Z7K1: 'Z881',
					Z881K1: 'Z6'
				},
				Z8K3: [ 'Z20' ],
				Z8K4: [
					'Z14',
					{
						Z1K1: 'Z14',
						Z14K1: 'Z1000006',
						Z14K2: {
							Z1K1: 'Z7',
							Z7K1: 'Z801',
							Z801K1: [
								'Z6',
								{
									Z1K1: 'Z18',
									Z18K1: 'Z1000006K1'
								},
								'less precious string'
							]
						}
					}
				],
				Z8K5: 'Z1000006'
			},
			Z1000006K1: 'a darling string'
		};
		attemptOrchestration(
			/* testName= */ 'Test that non-top-level argument references are resolved',
			/* functionCall= */ call,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'expected-non-top-level-argref.json' ),
			/* expectedErrorState= */ false,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ null,
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ]
		);
	}

	{
		const call = {
			Z1K1: 'Z7',
			Z7K1: {
				Z1K1: 'Z8',
				Z8K1: [
					'Z17'
				],
				Z8K2: {
					Z1K1: 'Z7',
					Z7K1: 'Z881',
					Z881K1: 'Z6'
				},
				Z8K3: [ 'Z20' ],
				Z8K4: [
					'Z14',
					{
						Z1K1: 'Z14',
						Z14K1: 'Z1000006',
						Z14K2: {
							Z1K1: 'Z7',
							Z7K1: 'Z801',
							Z801K1: [
								'Z6',
								{
									Z1K1: 'Z7',
									Z7K1: {
										Z1K1: 'Z8',
										Z8K1: [
											'Z17'
										],
										Z8K2: 'Z6',
										Z8K3: [ 'Z20' ],
										Z8K4: [
											'Z14',
											{
												Z1K1: 'Z14',
												Z14K1: 'Z1000007',
												Z14K2: 'a real lousy string, just a jerk'
											}
										],
										Z8K5: 'Z1000007'
									}
								},
								'less precious string'
							]
						}
					}
				],
				Z8K5: 'Z1000006'
			}
		};
		attemptOrchestration(
			/* testName= */ 'Test that non-top-level function calls are resolved',
			/* functionCall= */ call,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'expected-non-top-level-call.json' ),
			/* expectedErrorState= */ false,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ null,
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ]
		);
	}

	{
		wikiStub.setZId( 'Z20015', readJSON( testDataDir( 'Z20015.json' ) ) );
		const call = {
			Z1K1: 'Z7',
			Z7K1: 'Z805',
			Z805K1: {
				Z1K1: 'Z20015',
				Z20015K1: '1'
			}
		};
		attemptOrchestration(
			/* testName= */ 'Test that reify avoids infinite expansions',
			/* functionCall= */ call,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'expected-reified-integer.json' ),
			/* expectedErrorState= */ false
		);
	}

	{
		const call = {
			Z1K1: 'Z7',
			Z7K1: 'Z828',
			Z828K1: {
				Z1K1: 'Z99',
				Z99K1: {
					Z1K1: 'Z9',
					Z9K1: 'Z811'
				}
			}
		};
		attemptOrchestration(
			/* testName= */ 'Test that Z828 retrieves a Z2 for a built-in',
			/* functionCall= */ call,
			/* expectedResult= */ readJSON( schemataDefinitionsDir( 'Z811.json' ) )
		);
	}

	{
		wikiStub.setZId( 'Z10015', readJSON( testDataDir( 'Z10015.json' ) ) );
		const call = {
			Z1K1: 'Z7',
			Z7K1: 'Z828',
			Z828K1: {
				Z1K1: 'Z99',
				Z99K1: {
					Z1K1: 'Z9',
					Z9K1: 'Z10015'
				}
			}
		};
		attemptOrchestration(
			/* testName= */ 'Test that Z828 retrieves a Z2 from the mock wiki',
			/* functionCall= */ call,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'Z10015.json' )
		);
	}

	{
		// An exception is generated in wikiStub, because it doesn't know about Z1001555
		const call = {
			Z1K1: 'Z7',
			Z7K1: 'Z828',
			Z828K1: {
				Z1K1: 'Z99',
				Z99K1: {
					Z1K1: 'Z9',
					Z9K1: 'Z499'
				}
			}
		};
		attemptOrchestration(
			/* testName= */ 'Test that Z828 catches an error thrown by dereference()',
			/* functionCall= */ call,
			/* expectedResult= */ null,
			/* expectedResultFile= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ testDataDir( 'error_thrown_by_dereference_expected.json' )
		);
	}

	{
		wikiStub.setZId( 'Z20321', readJSON( testDataDir( 'Z20321.json' ) ) );
		wikiStub.setZId( 'Z20322', readJSON( testDataDir( 'Z20322.json' ) ) );
		const call = {
			Z1K1: 'Z7',
			Z7K1: 'Z805',
			Z805K1: {
				Z1K1: 'Z20321',
				Z20321K1: 'Z20322'
			}
		};
		attemptOrchestration(
			/* testName= */ 'Test that unresolved Z9s pass validation',
			/* functionCall= */ call,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'expected-reified-kleenean.json' ),
			/* expectedErrorState= */ false,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile = */ null
		);
	}

	{
		const argument = {
			Z1K1: 'Z7',
			Z7K1: {
				Z1K1: 'Z8',
				Z8K1: [
					'Z17',
					{
						Z1K1: 'Z17',
						Z17K1: {
							Z1K1: 'Z9',
							Z9K1: 'Z6'
						},
						Z17K2: 'Z60606K1',
						Z17K3: {
							Z1K1: 'Z12',
							Z12K1: [ 'Z11' ]
						}
					}
				],
				Z8K2: {
					Z1K1: 'Z7',
					Z7K1: 'Z881',
					Z881K1: 'Z6'
				},
				Z8K3: [ 'Z20' ],
				Z8K4: [
					'Z14',
					{
						Z1K1: 'Z14',
						Z14K1: 'Z60606',
						Z14K2: {
							Z1K1: 'Z7',
							Z7K1: 'Z810',
							Z810K1: {
								Z1K1: 'Z18',
								Z18K1: 'Z60606K1'
							},
							Z810K2: [
								'Z6',
								{
									Z1K1: 'Z18',
									Z18K1: 'Z60606K1'
								}
							]
						}
					}
				],
				Z8K5: 'Z60606'
			},
			Z60606K1: 'meow'
		};
		const call = {
			Z1K1: 'Z7',
			Z7K1: {
				Z1K1: 'Z8',
				Z8K1: [
					'Z17'
				],
				Z8K2: {
					Z1K1: 'Z7',
					Z7K1: 'Z881',
					Z881K1: 'Z6'
				},
				Z8K3: [ 'Z20' ],
				Z8K4: [
					'Z14',
					{
						Z1K1: 'Z14',
						Z14K1: 'Z60607',
						Z14K2: {
							Z1K1: 'Z7',
							Z7K1: 'Z801',
							Z801K1: argument
						}
					}
				],
				Z8K5: 'Z60607'
			}
		};
		attemptOrchestration(
			/* testName= */ 'Test really tricksy deep-nested function calls in arguments',
			/* functionCall= */ call,
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'expected-tricksy-deep-function-call.json' ),
			/* expectedErrorState= */ false,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ null,
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ]
		);
	}

} );

describe( 'orchestrate 2', function () { // eslint-disable-line no-undef
	attemptOrchestration(
		/* testName= */ 'function call for Z802 with reference to Z902',
		/* functionCall= */ readJSON( testDataDir( 'Z802_false.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ testDataDir( 'Z902_false_expected.json' ),
		/* expectedErrorState= */ false,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for the false Z902 (if), the dissembler',
		/* functionCall= */ readJSON( testDataDir( 'Z902_false.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ testDataDir( 'Z902_false_expected.json' ),
		/* expectedErrorState= */ false,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for the true Z902 (if), the good if',
		/* functionCall= */ readJSON( testDataDir( 'Z902_true.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ testDataDir( 'Z902_true_expected.json' ),
		/* expectedErrorState= */ false,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z803 with reference to Z903',
		/* functionCall= */ readJSON( testDataDir( 'Z903.json' ) ),
		/* expectedResult= */ 'funicle',
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ false,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z903 (value by key)',
		/* functionCall= */ readJSON( testDataDir( 'Z903.json' ) ),
		/* expectedResult= */ 'funicle',
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ false,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z903 (value by key) with bad key',
		/* functionCall= */ readJSON( testDataDir( 'Z903_bad_key.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ { Z1K1: 'Z5', Z5K1: 'Z507', Z5K2: { Z1K1: { Z1K1: 'Z7', Z7K1: 'Z885', Z885K1: 'Z507' }, Z507K1: 'Object did not contain key "Z10000K5"' } },
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z804',
		/* functionCall= */ readJSON( testDataDir( 'Z804.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ testDataDir( 'Z804_expected.json' ),
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z805 with reference to Z905',
		/* functionCall= */ readJSON( testDataDir( 'Z805.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ testDataDir( 'Z905_expected.json' ),
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z905 (reify)',
		/* functionCall= */ readJSON( testDataDir( 'Z905.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ testDataDir( 'Z905_expected.json' ),
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z808 with reference to Z908',
		/* functionCall= */ readJSON( testDataDir( 'Z808.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ testDataDir( 'Z908_expected.json' ),
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z908 (abstract)',
		/* functionCall= */ readJSON( testDataDir( 'Z908.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ testDataDir( 'Z908_expected.json' ),
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call (short form) for Z810/Cons onto empty List',
		/* functionCall= */ readJSON( testDataDir( 'Z810.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ testDataDir( 'Z910_expected.json' ),
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call (short form) for Z810/Cons onto empty Z881',
		/* functionCall= */ readJSON( testDataDir( 'Z810_empty_Z881.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ testDataDir( 'Z910_empty_Z881_expected.json' ),
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call (short form) for Z810/Cons onto non-empty Z881',
		/* functionCall= */ readJSON( testDataDir( 'Z810_full_Z881.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ testDataDir( 'Z910_full_Z881_expected.json' ),
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z910/Cons onto empty List',
		/* functionCall= */ readJSON( testDataDir( 'Z910.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ testDataDir( 'Z910_expected.json' ),
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z910/Cons onto empty Z881',
		/* functionCall= */ readJSON( testDataDir( 'Z910_empty_Z881.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ testDataDir( 'Z910_empty_Z881_expected.json' ),
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z910/Cons onto non-empty Z881',
		/* functionCall= */ readJSON( testDataDir( 'Z910_full_Z881.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ testDataDir( 'Z910_full_Z881_expected.json' ),
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call (short form) for Z811/Head with non-empty List',
		/* functionCall= */ readJSON( testDataDir( 'Z811.json' ) ),
		/* expectedResult= */ 'arbitrary ZObject',
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call (short form) for Z811/Head with non-empty Z881',
		/* functionCall= */ readJSON( testDataDir( 'Z811_full_Z881.json' ) ),
		/* expectedResult= */ 'i met a traveler from an antique land',
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call (short form) for Z811/Head with empty Z881',
		/* functionCall= */ readJSON( testDataDir( 'Z811_empty_Z881.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ { Z1K1: 'Z5', Z5K1: 'Z506', Z5K2: { Z1K1: { Z1K1: 'Z7', Z7K1: 'Z885', Z885K1: 'Z506' }, Z506K1: 'An empty list has no head.' } },
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z911 (head) with non-empty List',
		/* functionCall= */ readJSON( testDataDir( 'Z911.json' ) ),
		/* expectedResult= */ 'arbitrary ZObject',
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z811/Head with reference to Z911 and non-empty Z881',
		/* functionCall= */ readJSON( testDataDir( 'Z911_full_Z881.json' ) ),
		/* expectedResult= */ 'i met a traveler from an antique land',
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z911 (head) with empty List',
		/* functionCall= */ readJSON( testDataDir( 'Z911_empty.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ { Z1K1: 'Z5', Z5K1: 'Z506', Z5K2: { Z1K1: { Z1K1: 'Z7', Z7K1: 'Z885', Z885K1: 'Z506' }, Z506K1: 'An empty list has no head.' } },
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z811/Head with reference to Z911 and empty Z881',
		/* functionCall= */ readJSON( testDataDir( 'Z911_empty_Z881.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ { Z1K1: 'Z5', Z5K1: 'Z506', Z5K2: { Z1K1: { Z1K1: 'Z7', Z7K1: 'Z885', Z885K1: 'Z506' }, Z506K1: 'An empty list has no head.' } },
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call (short form) for Z812/Tail with non-empty List',
		/* functionCall= */ readJSON( testDataDir( 'Z812.json' ) ),
		/* expectedResult= */ [ 'Z6', 'specific ZObject' ],
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call (short form) for Z812/Tail with non-empty Z881',
		/* functionCall= */ readJSON( testDataDir( 'Z812_full_Z881.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ testDataDir( 'Z912_full_Z881_expected.json' ),
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call (short form) for Z812/Tail with empty Z881',
		/* functionCall= */ readJSON( testDataDir( 'Z812_empty_Z881.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ { Z1K1: 'Z5', Z5K1: 'Z506', Z5K2: { Z1K1: { Z1K1: 'Z7', Z7K1: 'Z885', Z885K1: 'Z506' }, Z506K1: 'An empty list has no tail.' } },
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z812/Tail with reference to Z912 and non-empty List',
		/* functionCall= */ readJSON( testDataDir( 'Z912.json' ) ),
		/* expectedResult= */ [ 'Z6', 'specific ZObject' ],
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z812/Tail with reference to Z912 and non-empty Z881',
		/* functionCall= */ readJSON( testDataDir( 'Z912_full_Z881.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ testDataDir( 'Z912_full_Z881_expected.json' ),
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z812/Tail with reference to Z912 and empty List',
		/* functionCall= */ readJSON( testDataDir( 'Z912_empty.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ { Z1K1: 'Z5', Z5K1: 'Z506', Z5K2: { Z1K1: { Z1K1: 'Z7', Z7K1: 'Z885', Z885K1: 'Z506' }, Z506K1: 'An empty list has no tail.' } },
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z812/Tail with reference to Z912 and empty Z881',
		/* functionCall= */ readJSON( testDataDir( 'Z912_empty_Z881.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ { Z1K1: 'Z5', Z5K1: 'Z506', Z5K2: { Z1K1: { Z1K1: 'Z7', Z7K1: 'Z885', Z885K1: 'Z506' }, Z506K1: 'An empty list has no tail.' } },
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call (short form) for Z813/Empty with an empty List (benjamin)',
		/* functionCall= */ readJSON( testDataDir( 'Z813_empty_benjamin.json' ) ),
		/* expectedResult= */ { Z1K1: 'Z40', Z40K1: 'Z41' },
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call (short form) for Z813/Empty with an empty Z881',
		/* functionCall= */ readJSON( testDataDir( 'Z813_empty_Z881.json' ) ),
		/* expectedResult= */ { Z1K1: 'Z40', Z40K1: 'Z41' },
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call (short form) for Z813/Empty with a non-empty Z881',
		/* functionCall= */ readJSON( testDataDir( 'Z813_full_Z881.json' ) ),
		/* expectedResult= */ { Z1K1: 'Z40', Z40K1: 'Z42' },
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call (short form) for Z813/Empty with a non-empty List (benjamin)',
		/* functionCall= */ readJSON( testDataDir( 'Z813_full_Z881.json' ) ),
		/* expectedResult= */ { Z1K1: 'Z40', Z40K1: 'Z42' },
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z813/Empty with reference to Z913 and an empty List (benjamin)',
		/* functionCall= */ readJSON( testDataDir( 'Z913_empty_benjamin.json' ) ),
		/* expectedResult= */ { Z1K1: 'Z40', Z40K1: 'Z41' },
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z813/Empty with reference to Z913 and an empty Z881',
		/* functionCall= */ readJSON( testDataDir( 'Z913_empty_Z881.json' ) ),
		/* expectedResult= */ { Z1K1: 'Z40', Z40K1: 'Z41' },
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z813/Empty with reference to Z913 and a non-empty List (benjamin)',
		/* functionCall= */ readJSON( testDataDir( 'Z913_full_benjamin.json' ) ),
		/* expectedResult= */ { Z1K1: 'Z40', Z40K1: 'Z42' },
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z813/Empty with reference to Z913 and an non-empty Z881',
		/* functionCall= */ readJSON( testDataDir( 'Z913_full_Z881.json' ) ),
		/* expectedResult= */ { Z1K1: 'Z40', Z40K1: 'Z42' },
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z821 (first)',
		/* functionCall= */ readJSON( testDataDir( 'Z821.json' ) ),
		/* expectedResult= */ 'first element of pair',
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z821 (first) with reference to Z921',
		/* functionCall= */ readJSON( testDataDir( 'Z921.json' ) ),
		/* expectedResult= */ 'first element of pair',
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z822 (second)',
		/* functionCall= */ readJSON( testDataDir( 'Z822.json' ) ),
		/* expectedResult= */ '2nd element of pair',
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z822 (second) with reference to Z922',
		/* functionCall= */ readJSON( testDataDir( 'Z922.json' ) ),
		/* expectedResult= */ '2nd element of pair',
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z868',
		/* functionCall= */ readJSON( testDataDir( 'Z868.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ testDataDir( 'Z968_expected.json' ),
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z968 (string to code points)',
		/* functionCall= */ readJSON( testDataDir( 'Z968.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ testDataDir( 'Z968_expected.json' ),
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z968 (string to code points) with combined Emoji',
		/* functionCall= */ readJSON( testDataDir( 'Z968_emoji.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ testDataDir( 'Z968_emoji_expected.json' ),
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z883 (short form)',
		/* functionCall= */ readJSON( testDataDir( 'Z883.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ testDataDir( 'Z883_expected.json' ),
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z886 (short form)',
		/* functionCall= */ readJSON( testDataDir( 'Z886.json' ) ),
		/* expectedResult= */ 'mus',
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z886 (short form) with Z881 input',
		/* functionCall= */ readJSON( testDataDir( 'Z886_with_Z881.json' ) ),
		/* expectedResult= */ 'mus',
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z986 (code points to string)',
		/* functionCall= */ readJSON( testDataDir( 'Z986.json' ) ),
		/* expectedResult= */ 'mus',
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z986 (code points to string) with Z881 input',
		/* functionCall= */ readJSON( testDataDir( 'Z986_with_Z881.json' ) ),
		/* expectedResult= */ 'mus',
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z986 (code points to string) with combining characters',
		/* functionCall= */ readJSON( testDataDir( 'Z986_emoji.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ testDataDir( 'Z986_emoji_expected.json' ),
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z986 (code points to string) with combining characters, with Z881 input',
		/* functionCall= */ readJSON( testDataDir( 'Z986_emoji_with_Z881.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ testDataDir( 'Z986_emoji_expected.json' ),
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z888 with reference to Z988',
		/* functionCall= */ readJSON( testDataDir( 'Z888_same.json' ) ),
		/* expectedResult= */ { Z1K1: 'Z40', Z40K1: 'Z41' },
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z988 (same), and the arguments are truly same',
		/* functionCall= */ readJSON( testDataDir( 'Z988_same.json' ) ),
		/* expectedResult= */ { Z1K1: 'Z40', Z40K1: 'Z41' },
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z988 (same), and lo, they are not same',
		/* functionCall= */ readJSON( testDataDir( 'Z988_different.json' ) ),
		/* expectedResult= */ { Z1K1: 'Z40', Z40K1: 'Z42' },
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z899 with reference to Z999',
		/* functionCall= */ readJSON( testDataDir( 'Z899.json' ) ),
		/* expectedResult= */ 'Z11',
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z999 (unquote)',
		/* functionCall= */ readJSON( testDataDir( 'Z999.json' ) ),
		/* expectedResult= */ 'Z11',
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'non-normalized function call with array',
		/* functionCall= */ readJSON( testDataDir( 'Z988_different_non-normalized.json' ) ),
		/* expectedResult= */ { Z1K1: 'Z40', Z40K1: 'Z42' },
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'composition',
		/* functionCall= */ readJSON( testDataDir( 'composition.json' ) ),
		/* expectedResult= */ { Z1K1: 'Z40', Z40K1: 'Z42' },
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [ 'implementationId' ],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'composition consisting of an argument reference',
		/* functionCall= */ readJSON( testDataDir( 'composition_arg_only.json' ) ),
		/* expectedResult= */ { Z1K1: 'Z40', Z40K1: 'Z41' },
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [ 'implementationId' ],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'composition consisting of an argument reference again',
		/* functionCall= */ readJSON( testDataDir( 'composition_arg_only_false.json' ) ),
		/* expectedResult= */ { Z1K1: 'Z40', Z40K1: 'Z42' },
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [ 'implementationId' ],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z960 (language code to language)',
		/* functionCall= */ readJSON( testDataDir( 'Z6_english.json' ) ),
		/* expectedResult= */ { Z1K1: 'Z60', Z60K1: 'en' },
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z889/List equality with reference to Z989 and lists of different length',
		/* functionCall= */ readJSON( testDataDir( 'Z989_different_length.json' ) ),
		/* expectedResult= */ { Z1K1: 'Z40', Z40K1: 'Z42' },
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z889/List equality with reference to Z989 and lists with different elements',
		/* functionCall= */ readJSON( testDataDir( 'Z989_different_elements.json' ) ),
		/* expectedResult= */ { Z1K1: 'Z40', Z40K1: 'Z42' },
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call for Z889/List equality with reference to Z989 and equal lists',
		/* functionCall= */ readJSON( testDataDir( 'Z989_equal.json' ) ),
		/* expectedResult= */ { Z1K1: 'Z40', Z40K1: 'Z41' },
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call containing multilingual text with multiple languages (implicit test for Z212)',
		/* functionCall= */ readJSON( testDataDir( 'call-with-multilingual-text-with-multiple-langs.json' ) ),
		/* expectedResult= */ 'abc',
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ false,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [ 'implementationId' ],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'function call containing multilingual text with duplicate languages (implicit test for Z212)',
		/* functionCall= */ readJSON( testDataDir( 'call-with-multilingual-text-with-duplicate-langs.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ testDataDir( 'multilingual-text-duplicate-langs-error.json' ),
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [ 'implementationId', 'implementationType' ],
		/* implementationSelector= */ null
	);
} );

describe( 'orchestrate with specified implementation selector', function () { // eslint-disable-line no-undef

	// Same as 'function call for Z804', except with specified implementation selector
	attemptOrchestration(
		/* testName= */ 'function call for Z804, with FirstImplementationSelector',
		/* functionCall= */ readJSON( testDataDir( 'Z804.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ testDataDir( 'Z804_expected.json' ),
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ new FirstImplementationSelector()
	);

	// Same as 'function call for Z804', except with specified implementation selector
	attemptOrchestration(
		/* testName= */ 'function call for Z804, with RandomImplementationSelector',
		/* functionCall= */ readJSON( testDataDir( 'Z804.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ testDataDir( 'Z804_expected.json' ),
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ new RandomImplementationSelector()
	);

	// Same as 'evaluated function call', except with specified implementation selector
	attemptOrchestration(
		/* testName= */ 'evaluated function call, with FirstImplementationSelector',
		/* functionCall= */ readJSON( testDataDir( 'evaluated.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ testDataDir( 'evaluated-13.json' ),
		/* expectedErrorState= */ false,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [ 'implementationId' ],
		/* implementationSelector= */ new FirstImplementationSelector()
	);

	// Same as 'evaluated function call', except with specified implementation selector
	attemptOrchestration(
		/* testName= */ 'evaluated function call, with RandomImplementationSelector',
		/* functionCall= */ readJSON( testDataDir( 'evaluated.json' ) ),
		/* expectedResult= */ null,
		/* expectedResultFile= */ testDataDir( 'evaluated-13.json' ),
		/* expectedErrorState= */ false,
		/* expectedErrorValue= */ null,
		/* expectedErrorFile= */ null,
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [ 'implementationId' ],
		/* implementationSelector= */ new RandomImplementationSelector()
	);

	{
		class SecondImplementationSelector {
			select( implementations ) {
				return implementations[ 1 ];
			}
		}

		attemptOrchestration(
			/* testName= */ 'multiple implementations',
			/* functionCall= */ readJSON( testDataDir( 'multiple-implementations.json' ) ),
			/* expectedResult= */ null,
			/* expectedResultFile= */ testDataDir( 'multiple-implementations_expected.json' ),
			/* expectedErrorState= */ false,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ null,
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId' ],
			/* implementationSelector= */ new SecondImplementationSelector()
		);
	}
} );

describe( 'orchestrate 3', function () { // eslint-disable-line no-undef
	const testBadFunctionCall = function ( name, zobject ) {
		return attemptOrchestration(
			/* testName= */ name,
			/* functionCall= */ zobject,
			/* expectedResult= */ null,
			/* expectedResultFile= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ null,
			/* expectedErrorFile= */ testDataDir( 'error-not-fn.json' ),
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [ 'implementationId', 'implementationType' ],
			/* implementationSelector= */ null
		);
	};

	testBadFunctionCall( 'well-formed empty Z6 string', { Z1K1: 'Z6', Z6K1: '' } );

	testBadFunctionCall( 'return string literal', 'Hello' );

	testBadFunctionCall( 'return string literal with space', 'Hello World!' );

	testBadFunctionCall( 'empty Z6 string', '' );

	testBadFunctionCall( 'messy string', 'This is a [basic] complicated test {string}!' );

	testBadFunctionCall( 'empty list', [] );

	testBadFunctionCall( 'string singleton list', [ 'Test' ] );

	testBadFunctionCall( 'string multiple list', [ 'Test', 'Test2', 'Test3' ] );

	testBadFunctionCall( 'record singleton list', [ { Z1K1: 'Z60', Z2K1: 'Test' } ] );

	testBadFunctionCall( 'simple double-quoted string', '"test"' );

	testBadFunctionCall( 'empty double-quoted string', '""' );

	testBadFunctionCall( 'well formed Z6 object as string', '{ "Z1K1": "Z6", "Z6K1": "" }' );

	testBadFunctionCall( 'messy double-quoted string', '"This is a [basic] complicated test {string}!"' );

	testBadFunctionCall( 'string empty list', '[]' );

	testBadFunctionCall( 'string singleton list', '["Test"]' );

} );
