'use strict';

const assert = require( '../../utils/assert.js' );
const { getZMapValue, getError, isVoid, isZMap } =
	require( '../../../function-schemata/javascript/src/utils.js' );
const { orchestrate } = require( '../../../src/orchestrate.js' );
const { Evaluator } = require( '../../../src/Evaluator.js' );
const { Invariants } = require( '../../../src/Invariants.js' );
const { ReferenceResolver } = require( '../../../src/db.js' );
const { readJSON } = require( '../../../src/fileUtils.js' );
const { writeJSON } = require( '../../utils/testFileUtils.js' );
const canonicalize = require( '../../../function-schemata/javascript/src/canonicalize.js' );

const WIKI_URI = 'http://thewiki';
const EVAL_URI = 'http://theevaluator';

function getInvariants( doValidate, remainingTime ) {
	const resolver = new ReferenceResolver( WIKI_URI );
	const evaluators = [
		new Evaluator( {
			programmingLanguages: [
				'javascript-es2020', 'javascript-es2019', 'javascript-es2018',
				'javascript-es2017', 'javascript-es2016', 'javascript-es2015',
				'javascript', 'python-3-9', 'python-3-8', 'python-3-7', 'python-3',
				'python'
			],
			evaluatorUri: EVAL_URI,
			evaluatorWs: null,
			useReentrance: false } )
	];
	const orchestratorConfig = { doValidate: doValidate };
	function getRemainingTime() {
		return remainingTime;
	}
	return new Invariants( resolver, evaluators, orchestratorConfig, getRemainingTime );
}

function createExpectation( expectedValue, failureString, doCanonicalize = false ) {
	if ( expectedValue === null ) {
		return function ( actualResult ) {
			assert.deepEqual( isVoid( actualResult ), true, failureString );
		};
	}
	if ( doCanonicalize ) {
		expectedValue = canonicalize( expectedValue ).Z22K1;
	}
	return function ( actualValue ) {
		assert.deepEqual( actualValue, expectedValue, failureString );
	};
}

/**
 * Orchestrate and test the resulting output, error, and/or metadata.
 *
 * @param {string} testName unique name to apppend to the test
 * @param {Object} functionCall zobject, input to the orchestrator
 * @param {Mixed} expectedResult zobject, successful output or null
 * @param {boolean} expectedErrorState whether to expect an error
 * @param {Mixed} expectedErrorValue Z5 for an error or null
 * @param {Array} expectedExtraMetadata array of expected extra metadata
 * @param {Array} expectedMissingMetadata array of expected missing metadata
 * @param {Mixed} implementationSelector an ImplementationSelector subclass or null
 * @param {boolean} doValidate whether to perform static validation
 * @param {boolean} skip whether to skip this test
 */
const attemptOrchestrationTestMode = function (
	testName,
	functionCall,
	expectedResult,
	expectedErrorState,
	expectedErrorValue,
	expectedExtraMetadata,
	expectedMissingMetadata,
	implementationSelector,
	doValidate,
	skip ) {

	( skip ? it.skip : it )( // eslint-disable-line no-undef
		'orchestration test: ' + testName,
		async () => {
			const resultExpectationFailure = testName + ' returns the expected output, if any';
			// There are still some expected result files in normal form, so canonicalize here.
			const resultExpectation = createExpectation(
				expectedResult, resultExpectationFailure, /* doCanonicalize= */ true );

			let result = {};
			let thrownError = null;

			const invariants = getInvariants( doValidate, 15 );

			try {
				result = await orchestrate( functionCall, invariants, implementationSelector );
			} catch ( err ) {
				console.trace();
				console.log( err );
				thrownError = err;
			}
			assert.isNull( thrownError, testName + ' should not throw an execution/validation error' );

			resultExpectation( result.Z22K1 );

			assert.isTrue( isZMap( result.Z22K2 ), testName + ' returns a ZMap for Z22K2' );
			const responseError = getError( result );
			if ( expectedErrorState ) {
				assert.isNotNull( responseError, testName + ' should be in an execution/validation error state' );
				if ( expectedErrorValue !== null ) {
					const errorExpectation = createExpectation( expectedErrorValue, testName + ' returns the expected error, if any' );
					errorExpectation( responseError );
				}
			} else {
				const errorExpectation = createExpectation( expectedErrorValue, testName + ' should not be in an execution/validation error state' );
				errorExpectation( responseError );
			}

			// Note: Keep this list in sync with the key block in the orchestrate() function,
			// and calls to setMetadataValue and setMetadataValues in other places.
			const standardMetaData = [
				'orchestrationMemoryUsage',
				'orchestrationCpuUsage',
				'orchestrationStartTime',
				'orchestrationEndTime',
				'orchestrationDuration',
				'orchestrationHostname',
				'implementationId',
				'implementationType'
			];

			standardMetaData.forEach( ( key ) => {
				const metaDataValue = getZMapValue( result.Z22K2, key );
				if ( expectedMissingMetadata.includes( key ) ) {
					assert.deepEqual( metaDataValue, undefined, testName + ' should not have the `' + key + '` meta-data key set' );
				} else {
					assert.isDefined( metaDataValue, testName + ' should have the `' + key + '` meta-data key set' );
				}
			} );

			expectedExtraMetadata.forEach( ( key ) => {
				const metaDataValue = getZMapValue( result.Z22K2, key );
				assert.isDefined( metaDataValue, testName + ' should have the `' + key + '` meta-data key set' );
			} );
		}
	);

};

const attemptOrchestrationRegenerationMode = function (
	testName,
	functionCall,
	expectedResultFile,
	expectedErrorFile,
	implementationSelector,
	doValidate,
	skip ) {
	( skip ? it.skip : it )( // eslint-disable-line no-undef
		'regenerating output for ' + testName,
		async () => {
			const invariants = getInvariants( doValidate, 15 );

			// Run the orchestrator.
			let result;
			try {
				result = await orchestrate( functionCall, invariants, implementationSelector );
			} catch ( err ) {
				assert.isNotNull( null, 'could not regenerate output for ' + testName );
				return;
			}

			// Write expected output, if any.
			if ( expectedResultFile !== null ) {
				writeJSON( result.Z22K1, expectedResultFile );
			}

			// Write expected error, if any.
			if ( expectedErrorFile !== null ) {
				writeJSON( getError( result ), expectedErrorFile );
			}

			assert.isNull( null, '' ); // must assert something lest Mocha complain
		}
	);
};

// Determine whether to run in test or regeneration mode.
let regenerationMode = false;
for ( const argument of process.argv ) {
	if ( argument === '--regenerate-output' ) {
		regenerationMode = true;
		break;
	}
}

/**
 * Orchestrate and test the resulting output, error, and/or metadata.
 *
 * If there is an expected result, it can be indicated with expectedResult
 * or expectedResultFile, but not both.  (If both are given, expectedResult
 * will be ignored.)  Similarly for expectedErrorValue and expectedErrorFile.
 *
 * When regenerationMode = true and there is a value for expectedResultFile, the expected
 * result will be written to that file.  Similarly for expectedErrorFile.
 *
 * @param {string} testName unique name to apppend to the test
 * @param {Object} functionCall zobject, input to the orchestrator
 * @param {Mixed} expectedResult zobject, successful output or null
 * @param {Mixed} expectedResultFile null, or name of file containing successful output
 * @param {boolean} expectedErrorState whether to expect an error
 * @param {Mixed} expectedErrorValue Z5 for an error or null
 * @param {Mixed} expectedErrorFile null, or name of file containing Z5
 * @param {Array} expectedExtraMetadata array of expected extra metadata
 * @param {Array} expectedMissingMetadata array of expected missing metadata
 * @param {Mixed} implementationSelector an ImplementationSelector subclass or null
 * @param {boolean} doValidate whether to perform static validation
 * @param {boolean} skip whether to skip this test
 */
const attemptOrchestration = function (
	testName,
	functionCall,
	expectedResult = null,
	expectedResultFile = null,
	expectedErrorState = false,
	expectedErrorValue = null,
	expectedErrorFile = null,
	expectedExtraMetadata = [],
	expectedMissingMetadata = [],
	implementationSelector = null,
	doValidate = true,
	skip = false ) {
	if ( regenerationMode ) {
		attemptOrchestrationRegenerationMode(
			testName, functionCall, expectedResultFile, expectedErrorFile,
			implementationSelector, doValidate, skip );
	} else {
		if ( expectedResultFile ) {
			expectedResult = readJSON( expectedResultFile );
		}
		if ( expectedErrorFile ) {
			expectedErrorValue = readJSON( expectedErrorFile );
		}
		attemptOrchestrationTestMode(
			testName,
			functionCall,
			expectedResult,
			expectedErrorState,
			expectedErrorValue,
			expectedExtraMetadata,
			expectedMissingMetadata,
			implementationSelector,
			doValidate,
			skip );
	}
};

module.exports = { attemptOrchestration, WIKI_URI, EVAL_URI };
