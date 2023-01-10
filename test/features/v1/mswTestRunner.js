'use strict';

const assert = require( '../../utils/assert.js' );
const { getZMapValue, getError } =
	require( '../../../function-schemata/javascript/src/utils.js' );
const orchestrate = require( '../../../src/orchestrate.js' );
const { readJSON } = require( '../../../src/fileUtils.js' );
const { writeJSON } = require( '../../utils/testFileUtils.js' );
const { makeVoid, isZMap } = require( '../../../function-schemata/javascript/src/utils' );
const canonicalize = require( '../../../function-schemata/javascript/src/canonicalize' );

const WIKI_URI = 'http://thewiki';
const EVAL_URI = 'http://theevaluator';

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
			if ( expectedResult === null ) {
				expectedResult = makeVoid( /* canonical= */ true );
			} else {
				// There are still some expected result files in normal form
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

			assert.isTrue( isZMap( result.Z22K2 ), testName + ' returns a ZMap for Z22K2' );
			const responseError = getError( result );
			if ( expectedErrorState ) {
				assert.isNotNull( responseError, testName + ' should be in an execution/validation error state' );
				if ( expectedErrorValue !== null ) {
					assert.deepEqual(
						responseError,
						expectedErrorValue,
						testName + ' returns the expected error, if any'
					);
				}
			} else {
				assert.deepEqual( responseError, makeVoid( /* canonical= */ true ), testName + ' should not be in an execution/validation error state' );
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
			const executionBlock = {
				zobject: functionCall,
				wikiUri: 'http://thewiki',
				evaluatorUri: 'http://theevaluator',
				doValidate: doValidate
			};

			// Run the orchestrator.
			let result;
			try {
				result = await orchestrate( executionBlock, implementationSelector );
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
