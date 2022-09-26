'use strict';

const assert = require( '../../utils/assert.js' );
const canonicalize = require( '../../../function-schemata/javascript/src/canonicalize.js' );
const { makeFalse, makeMappedResultEnvelope, makeTrue, setZMapValue, getZMapValue, getError } =
	require( '../../../function-schemata/javascript/src/utils.js' );
const { setupServer } = require( 'msw/node' );
const orchestrate = require( '../../../src/orchestrate.js' );
const { readJSON } = require( '../../../src/read-json.js' );
const { normalError, error } = require( '../../../function-schemata/javascript/src/error.js' );
const { makeVoid } = require( '../../../function-schemata/javascript/src/utils' );
const { MediaWikiStub, EvaluatorStub, mockMediaWiki, mockEvaluator, mockLocalhost } = require( '../../../lib/mockUtils.js' );

const WIKI_URI = 'http://thewiki';
const EVAL_URI = 'http://theevaluator';

describe( 'orchestrate', function () { // eslint-disable-line no-undef
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
			readJSON( './test/features/v1/test_data/Z22-map-result-only.json' ),
		null );
		// Set evaluator response for test "evaluated function call, result and simple map"
		evaluatorStub.setZId( 'Z1002', ( unused ) => // eslint-disable-line no-unused-vars
			readJSON( './test/features/v1/test_data/Z22-map-basic.json' ),
		null );
		// Set evaluator response for test "evaluated function call, void result"
		const evaluatorResponse = readJSON( './test/features/v1/test_data/Z22-map-error.json' );
		const errorTerm = normalError( [ error.not_wellformed_value ], [ 'Error placeholder' ] );
		setZMapValue( evaluatorResponse.Z22K2, { Z1K1: 'Z6', Z6K1: 'errors' }, errorTerm );
		evaluatorStub.setZId( 'Z1003', ( unused ) => evaluatorResponse, null ); // eslint-disable-line no-unused-vars
		// Set evaluator response for string numeral increment function.
		// Used in scott numeral tests to convert scott numerals to strings.
		evaluatorStub.setZId( 'Z40002', ( zobject ) => makeMappedResultEnvelope( ( parseInt( zobject.Z40002K1.Z6K1 ) + 1 ).toString(), null ) );

		return mockServiceWorker.listen();
	} );

	after( () => { // eslint-disable-line no-undef
		return mockServiceWorker.resetHandlers();
	} );

	/**
	 * Orchestrate and test the resulting output, error, and/or metadata.
	 *
	 * @param {string} testName unique name to apppend to the test
	 * @param {Object} functionCall zobject, input to the orchestrator
	 * @param {Mixed} expectedResult zobject, successful output or null
	 * @param {bool} expectedErrorState whether to expect an error
	 * @param {Mixed} expectedErrorValue Z5 for an error or null
	 * @param {Array} expectedExtraMetadata array of expected extra metadata
	 * @param {Array} expectedMissingMetadata array of expected missing metadata
	 * @param {Mixed} implementationSelector an ImplementationSelector subclass or null
	 * @param {bool} doValidate whether to perform static validation
	 * @param {bool} skip whether to skip this test
	 */
	const attemptOrchestration = function (
		testName,
		functionCall,
		expectedResult = null,
		expectedErrorState = false,
		expectedErrorValue = null,
		expectedExtraMetadata = [],
		expectedMissingMetadata = [],
		implementationSelector = null,
		doValidate = true,
		skip = false ) {

		if ( expectedExtraMetadata === null ) {
			expectedExtraMetadata = [];
		}
		if ( expectedMissingMetadata === null ) {
			expectedMissingMetadata = [];
		}

		( skip ? it.skip : it )( // eslint-disable-line no-undef
			'orchestration test: ' + testName,
			async () => {
				if ( expectedResult === null ) {
					expectedResult = makeVoid( /* canonical= */ true );
				} else {
					expectedResult = canonicalize( expectedResult, /* withVoid= */ true ).Z22K1;
				}

				let result = {};
				let thrownError = null;

				const executionBlock = {
					zobject: functionCall,
					wikiUri: 'http://thewiki',
					evaluatorUri: 'http://theevaluator',
					doValidate: doValidate
				};

				try {
					result = await orchestrate( executionBlock, implementationSelector );
				} catch ( err ) {
					console.trace();
					console.log( err );
					thrownError = err;
				}
				assert.isNull( thrownError, testName + ' should not throw an execution/validation error' );

				assert.deepEqual( result.Z22K1, expectedResult, testName + ' returns the expected output, if any' );

				const responseError = getError( result );
				if ( expectedErrorState ) {
					assert.isNotNull( responseError, testName + ' should be in an execution/validation error state' );
					if ( expectedErrorValue !== null ) {
						assert.deepEqual(
							responseError,
							canonicalize( expectedErrorValue ).Z22K1,
							testName + ' returns the expected error, if any'
						);
					}
				} else {
					assert.deepEqual( responseError, makeVoid( /* canonical= */ true ), testName + ' should not be in an execution/validation error state' );
				}

				// Note: Keep this list in sync with the key block in the orchestrate() function.
				const standardMetaData = [
					'orchestrationMemoryUsage',
					'orchestrationCpuUsage',
					'orchestrationStartTime',
					'orchestrationEndTime',
					'orchestrationDuration',
					'orchestrationHostname'
				];

				standardMetaData.forEach( ( key ) => {
					if ( !expectedMissingMetadata.includes( key ) ) {
						const metaDataValue = getZMapValue( result.Z22K2, key );
						assert.isNotNull( metaDataValue, testName + ' should have the `' + key + '` meta-data key set' );
					}
				} );

				expectedExtraMetadata.forEach( ( key ) => {
					const metaDataValue = getZMapValue( result.Z22K2, key );
					assert.isNotNull( metaDataValue, testName + ' should have the `' + key + '` meta-data key set' );
				} );
			}
		);

	};

	attemptOrchestration(
		/* testName= */ 'validation error: invalid argument key for function call',
		/* functionCall= */ readJSON( './test/features/v1/test_data/invalid_call_argument_key.json' ),
		/* expectedResult= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ readJSON( './test/features/v1/test_data/invalid_call_argument_key_expected.json' ),
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'validation error: invalid argument type for function call',
		/* functionCall= */ readJSON( './test/features/v1/test_data/invalid_call_argument_type.json' ),
		/* expectedResult= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ readJSON( './test/features/v1/test_data/invalid_call_argument_type_expected.json' ),
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'validation error: invalid duplicated argument key in function definition',
		/* functionCall= */ readJSON( './test/features/v1/test_data/invalid_key_duplicated.json' ),
		/* expectedResult= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ readJSON( './test/features/v1/test_data/invalid_key_duplicated_expected.json' ),
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'validation error: invalid key for first argument in function definition',
		/* functionCall= */ readJSON( './test/features/v1/test_data/invalid_key_first_name.json' ),
		/* expectedResult= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ readJSON( './test/features/v1/test_data/invalid_key_first_name_expected.json' ),
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'validation error: invalid key name for argument in function definition',
		/* functionCall= */ readJSON( './test/features/v1/test_data/invalid_key_name.json' ),
		/* expectedResult= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ readJSON( './test/features/v1/test_data/invalid_key_name_expected.json' ),
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'validation error: invalid non-sequential key for argument in function definition',
		/* functionCall= */ readJSON( './test/features/v1/test_data/invalid_key_nonsequential.json' ),
		/* expectedResult= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ readJSON( './test/features/v1/test_data/invalid_key_nonsequential_expected.json' ),
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'argument type error: argument type does not match declared type',
		/* functionCall= */ readJSON( './test/features/v1/test_data/invalid_call_argument_not_of_declared_type.json' ),
		/* expectedResult= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ readJSON( './test/features/v1/test_data/invalid_call_argument_not_of_declared_type_expected.json' ),
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'return value type error: return value type does not match declared type',
		/* functionCall= */ readJSON( './test/features/v1/test_data/invalid_call_return_value_not_of_declared_type.json' ),
		/* expectedResult= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ readJSON( './test/features/v1/test_data/invalid_call_return_value_not_of_declared_type_expected.json' ),
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	{
		const mapCall = readJSON( './test/features/v1/test_data/invalid_key_type_passed_to_Z883.json' );
		mapCall.Z883K1 = 'Z1';
		attemptOrchestration(
			/* testName= */ 'argument value error: invalid value for Z883K1 / key type passed to Z883 / Typed Map',
			/* functionCall= */ mapCall,
			/* expectedResult= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ readJSON( './test/features/v1/test_data/invalid_key_type_passed_to_Z883_expected.json' ),
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [],
			/* implementationSelector= */ null
		);
	}

	attemptOrchestration(
		/* testName= */ 'input to composition type error: static validation is skipped',
		/* functionCall= */ readJSON( './test/features/v1/test_data/skips_static_validation.json' ),
		/* expectedResult= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ readJSON( './test/features/v1/test_data/skips_static_validation_expected.json' ),
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	attemptOrchestration(
		/* testName= */ 'input to Z804: missing keys',
		/* functionCall= */ readJSON( './test/features/v1/test_data/Z804_missing_keys.json' ),
		/* expectedResult= */ null,
		/* expectedErrorState= */ true,
		/* expectedErrorValue= */ readJSON( './test/features/v1/test_data/Z804_missing_keys_expected.json' ),
		/* expectedExtraMetadata= */ [],
		/* expectedMissingMetadata= */ [],
		/* implementationSelector= */ null
	);

	{
		const Z10122 = readJSON( './test/features/v1/test_data/Z10122.json' );
		wikiStub.setZId( 'Z10122', {
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
		attemptOrchestration(
			/* testName= */ 'composition returns type',
			/* functionCall= */ theFunctionCall,
			/* expectedResult= */ returnedType,
			/* expectedErrorState= */ false
		);
	}

	{
		const Z50000 = readJSON( './test/features/v1/test_data/generic-composition.json' );
		wikiStub.setZId( 'Z50000', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z50000' },
			Z2K2: Z50000
		} );
		const Z50001 = readJSON( './test/features/v1/test_data/generic-composition-implementation.json' );
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

		attemptOrchestration(
			/* testName= */ 'good generic defined as composition',
			/* functionCall= */ theFunctionCall,
			/* expectedResult= */ expectedOutput,
			/* expectedErrorState= */ false
		);
	}

	{
		const Z50000 = readJSON( './test/features/v1/test_data/generic-composition.json' );
		wikiStub.setZId( 'Z50000', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z50000' },
			Z2K2: Z50000
		} );
		const Z50001 = readJSON( './test/features/v1/test_data/generic-composition-implementation.json' );
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

		const expectedError = readJSON( './test/features/v1/test_data/bad_generic_composition_expected.json' );

		attemptOrchestration(
			/* testName= */ 'bad generic defined as composition',
			/* functionCall= */ theFunctionCall,
			/* expectedResult= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ expectedError,
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [],
			/* implementationSelector= */ null
		);
	}

	{
		wikiStub.setZId( 'Z12422', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z12422' },
			Z2K2: readJSON( './test/features/v1/test_data/misnamed-argument-Z12422.json' )
		} );

		attemptOrchestration(
			/* testName= */ 'argument name error: misnamed argument',
			/* functionCall= */ readJSON( './test/features/v1/test_data/misnamed-argument.json' ),
			/* expectedResult= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ readJSON( './test/features/v1/test_data/invalid_call_misnamed_argument_expected.json' ),
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [],
			/* implementationSelector= */ null
		);
	}

	{
		wikiStub.setZId( 'Z12423', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z12423' },
			Z2K2: readJSON( './test/features/v1/test_data/misnamed-argument-Z12423.json' )
		} );

		attemptOrchestration(
			/* testName= */ 'argument name error: list type misnamed argument',
			/* functionCall= */ readJSON( './test/features/v1/test_data/misnamed-argument-list.json' ),
			/* expectedResult= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ readJSON( './test/features/v1/test_data/invalid_call_misnamed_argument_list_expected.json' ),
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [],
			/* implementationSelector= */ null
		);
	}

	{
		wikiStub.setZId( 'Z12422', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z12422' },
			Z2K2: readJSON( './test/features/v1/test_data/misnamed-argument-Z12422.json' )
		} );

		attemptOrchestration(
			/* testName= */ 'argument error: missing argument',
			/* functionCall= */ readJSON( './test/features/v1/test_data/missing-argument.json' ),
			/* expectedResult= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ readJSON( './test/features/v1/test_data/invalid_call_missing_argument_expected.json' ),
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [],
			/* implementationSelector= */ null
		);
	}

	{
		wikiStub.setZId( 'Z10101', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10101' },
			Z2K2: readJSON( './test/features/v1/test_data/Z10101.json' )
		} );
		wikiStub.setZId( 'Z101030', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z101030' },
			Z2K2: readJSON( './test/features/v1/test_data/Z10103-bad.json' )
		} );
		const genericIf = readJSON( './test/features/v1/test_data/generic-if.json' );
		genericIf.Z1802K2 = 'Z101030';

		attemptOrchestration(
			/* testName= */ 'generic type validation error: bad list',
			/* functionCall= */ genericIf,
			/* expectedResult= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ readJSON( './test/features/v1/test_data/bad_generic_list_expected.json' ),
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [],
			/* implementationSelector= */ null
		);
	}

	{
		wikiStub.setZId( 'Z88201', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88201' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88201.json' )
		} );
		wikiStub.setZId( 'Z882030', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z882030' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88203-bad.json' )
		} );
		const genericPair = readJSON( './test/features/v1/test_data/generic-pair.json' );
		genericPair.Z1802K2 = 'Z882030';

		attemptOrchestration(
			/* testName= */ 'generic type validation error: bad pair',
			/* functionCall= */ genericPair,
			/* expectedResult= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ readJSON( './test/features/v1/test_data/bad_generic_pair_expected.json' ),
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [],
			/* implementationSelector= */ null
		);
	}

	{
		attemptOrchestration(
			/* testName= */ 'evaluated function call',
			/* functionCall= */ readJSON( './test/features/v1/test_data/evaluated.json' ),
			/* expectedResult= */ { Z1K1: 'Z6', Z6K1: '13' },
			/* expectedErrorState= */ false
		);
	}

	{
		const expectedError = {
			Z1K1: 'Z5',
			Z5K1: {
				Z1K1: 'Z507',
				Z507K1: 'Function evaluation failed with status 500: {"Z1K1":"Z6","Z6K1":"naw"}'
			}
		};
		attemptOrchestration(
			/* testName= */ 'failed evaluated function call',
			/* functionCall= */ readJSON( './test/features/v1/test_data/evaluated-failed.json' ),
			/* expectedResult= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ expectedError
		);
	}

	{
		attemptOrchestration(
			/* testName= */ 'evaluated function call, result and empty map',
			/* functionCall= */ readJSON( './test/features/v1/test_data/evaluated-map-result-only.json' ),
			/* expectedResult= */ { Z1K1: 'Z6', Z6K1: '13' },
			/* expectedErrorState= */ false
		);
	}

	{
		attemptOrchestration(
			/* testName= */ 'evaluated function call, result and simple map',
			/* functionCall= */ readJSON( './test/features/v1/test_data/evaluated-map-basic.json' ),
			/* expectedResult= */ { Z1K1: 'Z6', Z6K1: '13' },
			/* expectedErrorState= */ false
		);
	}

	{
		const expectedError = {
			Z1K1: 'Z5',
			Z5K1: { Z1K1: 'Z526', Z526K1: 'Error placeholder' } };
		attemptOrchestration(
			/* testName= */ 'evaluated function call, void result',
			/* functionCall= */ readJSON( './test/features/v1/test_data/evaluated-map-error.json' ),
			/* expectedResult= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ expectedError
		);
	}

	{
		wikiStub.setZId( 'Z10037', readJSON( './test/features/v1/test_data/all_Z10037.json' ) );
		const expectedOutput = makeTrue();
		attemptOrchestration(
			/* testName= */ 'composition of all empty',
			/* functionCall= */ readJSON( './test/features/v1/test_data/all_empty.json' ),
			/* expectedResult= */ expectedOutput,
			/* expectedErrorState= */ false
		);
	}

	{
		wikiStub.setZId( 'Z10037', readJSON( './test/features/v1/test_data/all_Z10037.json' ) );
		const expectedOutput = makeTrue();
		attemptOrchestration(
			/* testName= */ 'composition of all: [true, true]',
			/* functionCall= */ readJSON( './test/features/v1/test_data/all_true_true.json' ),
			/* expectedResult= */ expectedOutput,
			/* expectedErrorState= */ false
		);
	}

	{
		wikiStub.setZId( 'Z10037', readJSON( './test/features/v1/test_data/all_Z10037.json' ) );
		const expectedOutput = makeFalse();
		attemptOrchestration(
			/* testName= */ 'composition of all: [true, false]',
			/* functionCall= */ readJSON( './test/features/v1/test_data/all_true_false.json' ),
			/* expectedResult= */ expectedOutput,
			/* expectedErrorState= */ false
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
		const expectedOutput = makeFalse();
		attemptOrchestration(
			/* testName= */ 'one character("ab")',
			/* functionCall= */ input,
			/* expectedResult= */ expectedOutput,
			/* expectedErrorState= */ false
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
		const expectedOutput = makeTrue();
		attemptOrchestration(
			/* testName= */ 'one character("a")',
			/* functionCall= */ input,
			/* expectedResult= */ expectedOutput,
			/* expectedErrorState= */ false
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
		const expectedOutput = makeFalse();
		attemptOrchestration(
			/* testName= */ 'one character(<empty>)',
			/* functionCall= */ input,
			/* expectedResult= */ expectedOutput,
			/* expectedErrorState= */ false
		);
	}

	{
		wikiStub.setZId( 'Z10101', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10101' },
			Z2K2: readJSON( './test/features/v1/test_data/Z10101.json' )
		} );
		wikiStub.setZId( 'Z10103', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10103' },
			Z2K2: readJSON( './test/features/v1/test_data/Z10103.json' )
		} );
		const genericIf = readJSON( './test/features/v1/test_data/generic-if.json' );
		genericIf.Z1802K2 = 'Z10103';
		attemptOrchestration(
			/* testName= */ 'generic if',
			/* functionCall= */ genericIf,
			/* expectedResult= */ readJSON( './test/features/v1/test_data/Z10103-expanded.json' ),
			/* expectedErrorState= */ false
		);
	}

	{
		wikiStub.setZId( 'Z88201', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88201' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88201.json' )
		} );
		wikiStub.setZId( 'Z88203', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88203' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88203.json' )
		} );
		const genericPair = readJSON( './test/features/v1/test_data/generic-pair.json' );
		genericPair.Z1802K2 = 'Z88203';
		const expected = readJSON( './test/features/v1/test_data/Z88203-expanded.json' );
		attemptOrchestration(
			/* testName= */ 'generic pair',
			/* functionCall= */ genericPair,
			/* expectedResult= */ expected,
			/* expectedErrorState= */ false
		);
	}

	{
		wikiStub.setZId( 'Z88301', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88301' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88301.json' )
		} );
		wikiStub.setZId( 'Z88303', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88303' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88303.json' )
		} );
		wikiStub.setZId( 'Z88311', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88311' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88311.json' )
		} );
		wikiStub.setZId( 'Z88321', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88321' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88321.json' )
		} );
		const genericMap = readJSON( './test/features/v1/test_data/generic-map.json' );
		genericMap.Z1802K2 = 'Z88303';
		const expected = readJSON( './test/features/v1/test_data/Z88303-expanded.json' );
		attemptOrchestration(
			/* testName= */ 'generic map',
			/* functionCall= */ genericMap,
			/* expectedResult= */ expected,
			/* expectedErrorState= */ false
		);
	}

	{
		const mapCall = readJSON( './test/features/v1/test_data/invalid_key_type_passed_to_Z883.json' );
		mapCall.Z883K1 = 'Z6';
		const expected = readJSON( './test/features/v1/test_data/map-key-z6-expected.json' );
		attemptOrchestration(
			/* testName= */ 'map key can be Z6/String',
			/* functionCall= */ mapCall,
			/* expectedResult= */ expected,
			/* expectedErrorState= */ false
		);
	}

	{
		wikiStub.setZId( 'Z10044', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10044' },
			Z2K2: readJSON( './test/features/v1/test_data/map-Z10044.json' )
		} );
		const mapCall = readJSON( './test/features/v1/test_data/map-Z10043.json' );
		const expectedOutput = [
			{
				Z1K1: 'Z4',
				Z4K1: 'Z6',
				Z4K2: [
					'Z3',
					{
						Z1K1: 'Z3',
						Z3K1: 'Z6',
						Z3K2: 'Z6K1',
						Z3K3: {
							Z1K1: 'Z12',
							Z12K1: [
								'Z11',
								{
									Z1K1: 'Z11',
									Z11K1: 'Z1002',
									Z11K2: 'value'
								}
							]
						}
					}
				],
				Z4K3: 'Z106'
			},
			'acab'
		];
		attemptOrchestration(
			/* testName= */ 'map "echo" function to a list of items',
			/* functionCall= */ mapCall,
			/* expectedResult= */ expectedOutput,
			/* expectedErrorState= */ false
		);
	}

	{
		const mapCall = readJSON( './test/features/v1/test_data/invalid_key_type_passed_to_Z883.json' );
		mapCall.Z883K1 = 'Z39';
		const expected = readJSON( './test/features/v1/test_data/map-key-z39-expected.json' );
		attemptOrchestration(
			/* testName= */ 'map key can be Z39/Key Reference',
			/* functionCall= */ mapCall,
			/* expectedResult= */ expected,
			/* expectedErrorState= */ false
		);
	}

	{
		wikiStub.setZId( 'Z88401', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88401' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88401.json' )
		} );
		wikiStub.setZId( 'Z88402', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88402' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88402.json' )
		} );
		wikiStub.setZId( 'Z88403', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88403' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88403.json' )
		} );
		const userDefinedIf = readJSON( './test/features/v1/test_data/user-defined-type.json' );
		userDefinedIf.Z1802K2 = 'Z88403';
		const expected = readJSON( './test/features/v1/test_data/Z88403-expected.json' );
		const Z831 = readJSON( './test/features/v1/test_data/Z831.json' );
		expected.Z1K1.Z4K3 = Z831;
		attemptOrchestration(
			/* testName= */ 'good user-defined type',
			/* functionCall= */ userDefinedIf,
			/* expectedResult= */ expected,
			/* expectedErrorState= */ false
		);
	}

	{
		wikiStub.setZId( 'Z88401', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88401' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88401.json' )
		} );
		wikiStub.setZId( 'Z88402', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88402' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88402.json' )
		} );
		wikiStub.setZId( 'Z88404', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z88403' },
			Z2K2: readJSON( './test/features/v1/test_data/Z88403-bad.json' )
		} );
		const userDefinedIf = readJSON( './test/features/v1/test_data/user-defined-type.json' );
		userDefinedIf.Z1802K2 = 'Z88404';
		attemptOrchestration(
			/* testName= */ 'bad user-defined type',
			/* functionCall= */ userDefinedIf,
			/* expectedResult= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ readJSON( './test/features/v1/test_data/bad_user_defined_type_expected.json' )
		);
	}

	{
		const Z10005 = readJSON( './test/features/v1/test_data/Z10005.json' );
		wikiStub.setZId( 'Z10005', {
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
		attemptOrchestration(
			/* testName= */ 'reference to user-defined type',
			/* functionCall= */ userDefinedEcho,
			/* expectedResult= */ expected,
			/* expectedErrorState= */ false
		);
	}

	{
		class SecondImplementationSelector {
			select( implementations ) {
				return implementations[ 1 ];
			}
		}
		attemptOrchestration(
			/* testName= */ 'multiple implementations',
			/* functionCall= */ readJSON( './test/features/v1/test_data/multiple-implementations.json' ),
			/* expectedResult= */ makeTrue(),
			/* expectedErrorState= */ false,
			/* expectedErrorValue= */ null,
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [],
			/* implementationSelector= */ new SecondImplementationSelector()
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
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ null,
			/* expectedExtraMetadata= */ [ 'test' ],
			/* expectedMissingMetadata= */ [],
			/* implementationSelector= */ null
		);
	}

	{
		const callToThrow = readJSON( './test/features/v1/test_data/throw.json' );
		const expected = callToThrow.Z820K2;
		attemptOrchestration(
			/* testName= */ 'throw throws Z5s',
			/* functionCall= */ callToThrow,
			/* expectedResult= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ expected
		);
	}

	{
		wikiStub.setZId( 'Z100101', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z100101' },
			Z2K2: 'just an ol string'
		} );
		const expectedError = {
			Z1K1: 'Z5',
			Z5K1: {
				Z1K1: 'Z507',
				Z507K1: 'Could not dereference Z7K1'
			}
		};
		attemptOrchestration(
			/* testName= */ 'referenced object is not correct type',
			/* functionCall= */ readJSON( './test/features/v1/test_data/bad-reference.json' ),
			/* expectedResult= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ expectedError
		);
	}

	{
		wikiStub.setZId( 'Z10081', readJSON( './test/features/v1/test_data/Z10081.json' ) );
		wikiStub.setZId( 'Z10086', readJSON( './test/features/v1/test_data/Z10086.json' ) );
		wikiStub.setZId( 'Z10084', readJSON( './test/features/v1/test_data/Z10084.json' ) );
		wikiStub.setZId( 'Z10085', readJSON( './test/features/v1/test_data/Z10085.json' ) );
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
			/* expectedResult= */ readJSON( './test/features/v1/test_data/Z10084_nonempty_string_expected.json' ),
			/* expectedErrorState= */ false
		);
	}

	{
		wikiStub.setZId( 'Z10081', readJSON( './test/features/v1/test_data/Z10081.json' ) );
		wikiStub.setZId( 'Z10086', readJSON( './test/features/v1/test_data/Z10086.json' ) );
		wikiStub.setZId( 'Z10084', readJSON( './test/features/v1/test_data/Z10084.json' ) );
		wikiStub.setZId( 'Z10085', readJSON( './test/features/v1/test_data/Z10085.json' ) );
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
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ readJSON( './test/features/v1/test_data/Z10084_empty_string_expected.json' ),
			/* expectedExtraMetadata= */ [],
			/* expectedMissingMetadata= */ [],
			/* implementationSelector= */ null
		);
	}

	{
		wikiStub.setZId( 'Z10088', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10088' },
			Z2K2: readJSON( './test/features/v1/test_data/curry-implementation-Z10088.json' )
		} );
		wikiStub.setZId( 'Z10087', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10087' },
			Z2K2: readJSON( './test/features/v1/test_data/curry-Z10087.json' )
		} );
		wikiStub.setZId( 'Z30086', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z30086' },
			Z2K2: readJSON( './test/features/v1/test_data/curry-call-Z30086.json' )
		} );
		wikiStub.setZId( 'Z10007', {
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
		attemptOrchestration(
			/* testName= */ 'curry',
			/* functionCall= */ curryCall,
			/* expectedResult= */ makeTrue(),
			/* expectedErrorState= */ false
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
			Z2K2: readJSON( './test/features/v1/test_data/save-argument-scope-Z10001.json' )
		} );
		wikiStub.setZId( 'Z10002', {
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
		attemptOrchestration(
			/* testName= */ 'save argument scope',
			/* functionCall= */ call,
			/* expectedResult= */ makeTrue(),
			/* expectedErrorState= */ false
		);
	}

	{
		wikiStub.setZId(
			'Z100920',
			readJSON( './test/features/v1/test_data/Z100920-wrap.json' ) );
		wikiStub.setZId(
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
		attemptOrchestration(
			/* testName= */ 'wrap type',
			/* functionCall= */ wrapCall,
			/* expectedResult= */ expected,
			/* expectedErrorState= */ false
		);
	}

	{
		wikiStub.setZId(
			'Z20022',
			readJSON( './test/features/v1/test_data/Z20022-natural-number-type.json' ) );
		wikiStub.setZId(
			'Z20095',
			readJSON( './test/features/v1/test_data/Z20095-natural-number-from-string.json' ) );
		wikiStub.setZId(
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
		attemptOrchestration(
			/* testName= */ 'construct positive integer from string',
			/* functionCall= */ naturalNumberCall,
			/* expectedResult= */ expected,
			/* expectedErrorState= */ false
		);
	}

	{
		wikiStub.setZId( 'Z31000', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z31000' },
			Z2K2: readJSON( './test/features/v1/test_data/bind-binary-Z31000.json' )
		} );
		wikiStub.setZId( 'Z31001', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z31001' },
			Z2K2: readJSON( './test/features/v1/test_data/bind-binary-implementation-Z31001.json' )
		} );
		wikiStub.setZId( 'Z10007', {
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
		attemptOrchestration(
			/* testName= */ 'bind binary function',
			/* functionCall= */ binaryBindCall,
			/* expectedResult= */ readJSON( './test/features/v1/test_data/bind-binary-expected.json' ),
			/* expectedErrorState= */ false
		);
	}

	{
		const noScrubs = readJSON( './test/features/v1/test_data/no-implementations.json' );
		attemptOrchestration(
			/* testName= */ 'no implementations',
			/* functionCall= */ noScrubs,
			/* expectedResult= */ null,
			/* expectedErrorState= */ true,
			/* expectedErrorValue= */ readJSON( './test/features/v1/test_data/no-implementations-expected.json' )
		);
	}

	{
		wikiStub.setZId( 'Z40002', readJSON( './test/features/v1/test_data/string-numeral-increment-Z40002.json' ) );
		const call = {
			Z1K1: 'Z7',
			Z7K1: 'Z40002',
			Z40002K1: '41'
		};
		attemptOrchestration(
			/* testName= */ 'Increment string numeral',
			/* functionCall= */ call,
			/* expectedResult= */ '42',
			/* expectedErrorState= */ false
		);
	}

	{
		wikiStub.setZId( 'Z40000', readJSON( './test/features/v1/test_data/scott-numeral-zero-Z40000.json' ) );
		wikiStub.setZId( 'Z40001', readJSON( './test/features/v1/test_data/scott-numeral-succ-Z40001.json' ) );
		wikiStub.setZId( 'Z40002', readJSON( './test/features/v1/test_data/string-numeral-increment-Z40002.json' ) );
		wikiStub.setZId( 'Z40003', readJSON( './test/features/v1/test_data/scott-numeral-convert-Z40003.json' ) );
		const call = {
			Z1K1: 'Z7',
			Z7K1: 'Z40003',
			Z40003K1: 'Z40000'
		};
		attemptOrchestration(
			/* testName= */ 'Scott numeral zero',
			/* functionCall= */ call,
			/* expectedResult= */ '0',
			/* expectedErrorState= */ false
		);
	}

	{
		wikiStub.setZId( 'Z40000', readJSON( './test/features/v1/test_data/scott-numeral-zero-Z40000.json' ) );
		wikiStub.setZId( 'Z40001', readJSON( './test/features/v1/test_data/scott-numeral-succ-Z40001.json' ) );
		wikiStub.setZId( 'Z40002', readJSON( './test/features/v1/test_data/string-numeral-increment-Z40002.json' ) );
		wikiStub.setZId( 'Z40003', readJSON( './test/features/v1/test_data/scott-numeral-convert-Z40003.json' ) );
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
			/* expectedResult= */ '1',
			/* expectedErrorState= */ false
		);
	}

	{
		wikiStub.setZId( 'Z40000', readJSON( './test/features/v1/test_data/scott-numeral-zero-Z40000.json' ) );
		wikiStub.setZId( 'Z40001', readJSON( './test/features/v1/test_data/scott-numeral-succ-Z40001.json' ) );
		wikiStub.setZId( 'Z40002', readJSON( './test/features/v1/test_data/string-numeral-increment-Z40002.json' ) );
		wikiStub.setZId( 'Z40003', readJSON( './test/features/v1/test_data/scott-numeral-convert-Z40003.json' ) );
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
			/* expectedResult= */ '2',
			/* expectedErrorState= */ false
		);
	}

	{
		// TODO(T310093): Speed this up until and bump up the input values, e.g. to Ackermann(2, 2).
		wikiStub.setZId( 'Z40000', readJSON( './test/features/v1/test_data/scott-numeral-zero-Z40000.json' ) );
		wikiStub.setZId( 'Z40001', readJSON( './test/features/v1/test_data/scott-numeral-succ-Z40001.json' ) );
		wikiStub.setZId( 'Z40002', readJSON( './test/features/v1/test_data/string-numeral-increment-Z40002.json' ) );
		wikiStub.setZId( 'Z40003', readJSON( './test/features/v1/test_data/scott-numeral-convert-Z40003.json' ) );
		wikiStub.setZId( 'Z40004', readJSON( './test/features/v1/test_data/scott-numeral-ack-Z40004.json' ) );
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
			/* expectedResult= */ '3',
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
					Z6K1: 'Z4K3'
				}
			},
			Z803K2: 'Z40'
		};
		attemptOrchestration(
			/* testName= */ 'Built-ins are resolved when they are an argument to a function.',
			/* functionCall= */ call,
			/* expectedResult= */ 'Z140',
			/* expectedErrorState= */ false
		);
	}

} );
