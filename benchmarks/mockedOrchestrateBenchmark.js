/**
 * Script to run a sample benchmark suite, testing main workflows
 * with the network calls mocked out.
 *
 * How to use:
 * `node path/to/mockedOrchestrateBenchmark.js`
 * OR
 * `npm run benchmark`
 * to run all benchmark suites
 *
 * Result will look like:
 * ```
 * Evaluate py3 function x 2.65 ops/sec ±7.03% (27 runs sampled)
 * Evaluate py3 function without validate x 21.93 ops/sec ±2.16% (70 runs sampled)
 * ```
 *
 * The higher the number (X ops/sec), the faster it is.
 */

'use strict';

const Benchmark = require( 'benchmark' );
const { makeMappedResultEnvelope } = require( '../function-schemata/javascript/src/utils.js' );
const { readJSON } = require( '../src/fileUtils.js' );
const { MediaWikiStub, EvaluatorStub, mockMediaWiki, mockEvaluator, mockLocalhost } = require( '../lib/mockUtils.js' );
const { setupServer } = require( 'msw/node' );
const orchestrate = require( '../src/orchestrate.js' );

const wikiStub = new MediaWikiStub();
const evaluatorStub = new EvaluatorStub();
const WIKI_URI = 'http://thewiki';
const EVAL_URI = 'http://theevaluator';

const mockServiceWorker = setupServer(
	mockMediaWiki( WIKI_URI, wikiStub ),
	mockEvaluator( EVAL_URI, evaluatorStub ),
	mockLocalhost() );
mockServiceWorker.listen();

/**
 * Helper function to run orchestrate and checks the result for correctness.
 *
 * @param {*} zobject The target object.
 * @param {*} expectedOutput This should match the returned result's Z22K1 field.
 * @param {boolean} doValidate whether to validate the function call.
 */
async function doOrchestrate( zobject, expectedOutput, doValidate = true ) {
	const input = {
		zobject: zobject,
		wikiUri: WIKI_URI,
		evaluatorUri: EVAL_URI,
		doValidate: doValidate
	};
	let result = {};
	try {
		result = await orchestrate( input, /* ImplementationSelector */ null );
	} catch ( err ) {
		console.trace();
		console.log( err );
	}
	const expStr = JSON.stringify( expectedOutput );
	const resStr = JSON.stringify( result.Z22K1 );
	console.assert(
		expStr === resStr,
		`Expected ${expStr} but got ${resStr}.\
Even though this is just a benchmark run, faulty results might indicate\
the expected sequence wasn't run correctly.` );

}

const suite = new Benchmark.Suite(
	'Mocked orchestrate benchmark suite',
	{
		onCycle: ( event ) => {
			// This gets called between benchmarks.
			console.log( String( event.target ) );
			mockServiceWorker.resetHandlers();
		}
	}
);

// Default benchmark options.
const defaultOptions = {
	defer: true, // for async calls.
	minSamples: 20, // ensure the result stability.
	initCount: 2 // default is one if not set.
};

suite.add( 'Evaluate py3 function', async function ( deferred ) {
	evaluatorStub.setZId(
		'Z1000',
		( unused ) => makeMappedResultEnvelope( { Z1K1: 'Z6', Z6K1: '13' }, null ) );
	await doOrchestrate(
		readJSON( './test/features/v1/test_data/evaluated.json' ),
		'13' );
	deferred.resolve(); // This is necessary for async calls.
}, defaultOptions );

suite.add( 'Evaluate py3 function without validating', async function ( deferred ) {
	evaluatorStub.setZId(
		'Z1000',
		( unused ) => makeMappedResultEnvelope( { Z1K1: 'Z6', Z6K1: '13' }, null ) );
	await doOrchestrate(
		readJSON( './test/features/v1/test_data/evaluated.json' ),
		'13',
		false );
	deferred.resolve();
}, defaultOptions );

suite.add( 'Evaluate generic defined as composition', async function ( deferred ) {
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
	await doOrchestrate( theFunctionCall, expectedOutput );
	deferred.resolve();
}, defaultOptions );

suite.run( { async: true } );
