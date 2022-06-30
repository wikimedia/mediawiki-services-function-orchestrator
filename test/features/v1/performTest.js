'use strict';

const assert = require( '../../utils/assert.js' );
const { rest } = require( 'msw' );
const { setupServer } = require( 'msw/node' );
const performTest = require( '../../../src/performTest.js' );
const { readJSON, readZObjectsFromDirectory } = require( '../../utils/read-json.js' );
const { getError, makeVoid } = require( '../../../function-schemata/javascript/src/utils.js' );

class Canned {

	constructor() {
		this.reset();
	}

	reset() {
		this.dict_ = {
			wiki: readZObjectsFromDirectory( 'function-schemata/data/definitions/' ),
			evaluator: readJSON( 'test/features/v1/test_data/evaluator_result.json' )
		};
	}

	setWiki( key, value ) {
		this.dict_.wiki[ key ] = value;
	}

	setEvaluator( key, value ) {
		this.dict_.evaluator[ key ] = value;
	}

	getWiki( key ) {
		return this.dict_.wiki[ key ];
	}

	getEvaluator( key ) {
		return this.dict_.evaluator[ key ];
	}

}

describe( 'performTest', function () { // eslint-disable-line no-undef
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
			return res( ctx.status( 200 ), ctx.json( cannedResponses.getEvaluator( ZID ) ) );
		} ),

		// Silently forward GET requests to the API running at :6254.
		rest.get( 'http://localhost:6254/*', ( req, res, ctx ) => {} ) // eslint-disable-line no-unused-vars
	];
	const mockServiceWorker = setupServer( ...restHandlers );

	before( () => mockServiceWorker.listen() ); // eslint-disable-line no-undef

	after( () => { // eslint-disable-line no-undef
		return mockServiceWorker.resetHandlers();
	} );

	it( 'throws if you give it invalid JSON in the outer data structure', async () => { // eslint-disable-line no-undef
		// This covers the parse() function
		let result;
		try {
			// We're passing invalid JSON so this should throw rather than return.
			result = await performTest(
				'{ zfunction: "{}", zimplementations: "[{]", ztesters: "[]", doValidate: false',
				'http://thewiki',
				'http://theevaluator'
			);
		} catch ( error ) {
			// This is the expected behaviour
			assert.ok( 'Yay' );
		}
		// The result should be left undefined.
		assert.deepEqual( result, undefined );
	} );

	it( 'throws if you give it invalid JSON in the inner values', async () => { // eslint-disable-line no-undef
		// This covers bits of the getTestResults() function
		let result;
		try {
			// We're passing invalid JSON so this should throw rather than return.
			result = await performTest(
				JSON.stringify( {
					zfunction: '{}',
					zimplementations: '[{]',
					ztesters: '[]',
					doValidate: false
				} ),
				'http://thewiki',
				'http://theevaluator'
			);
		} catch ( error ) {
			// This is the expected behaviour
			assert.ok( 'Yay' );
		}
		// The result should be left undefined.
		assert.deepEqual( result, undefined );
	} );

	it( 'performs a test and validation, and returns the result.', async () => { // eslint-disable-line no-undef
		cannedResponses.setWiki( 'Z10006', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10006' },
			Z2K2: readJSON( 'test/features/v1/test_data/Z10006.json' )
		} );

		cannedResponses.setWiki( 'Z10008', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10008' },
			Z2K2: readJSON( 'test/features/v1/test_data/Z10008.json' )
		} );

		cannedResponses.setWiki( 'Z10011', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10011' },
			Z2K2: readJSON( 'test/features/v1/test_data/Z10011.json' )
		} );

		const result = await performTest(
			JSON.stringify( {
				zfunction: 'Z10006',
				zimplementations: '[]',
				ztesters: '[]',
				doValidate: false
			} ),
			'http://thewiki',
			'http://theevaluator'
		);

		delete result[ 0 ].duration;
		// We don't  deepEqual against Z22K2 because it contains metrics with arbitrary values
		assert.strictEqual( getError( result[ 0 ].validationResponse ),
			makeVoid( /* canonical */ true ) );
		delete result[ 0 ].validationResponse.Z22K2;

		assert.deepEqual( result, [
			{
				zFunctionId: 'Z10006',
				zImplementationId: 'Z10008',
				zTesterId: 'Z10011',
				validationResponse: {
					Z1K1: 'Z22',
					Z22K1: {
						Z1K1: 'Z40',
						Z40K1: 'Z41'
					}
				}
			}
		] );
	} );

	it( 'performs a test and validation, and returns failed test result.', async () => { // eslint-disable-line no-undef
		cannedResponses.setWiki( 'Z10006', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10006' },
			Z2K2: readJSON( 'test/features/v1/test_data/Z10006.json' )
		} );

		cannedResponses.setWiki( 'Z10008', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10008' },
			Z2K2: readJSON( 'test/features/v1/test_data/Z10008.json' )
		} );

		cannedResponses.setWiki( 'Z10012', {
			Z1K1: 'Z2',
			Z2K1: { Z1K1: 'Z6', Z6K1: 'Z10012' },
			Z2K2: readJSON( 'test/features/v1/test_data/Z10012.json' )
		} );

		const result = await performTest(
			JSON.stringify( {
				zfunction: 'Z10006',
				zimplementations: '[]',
				ztesters: '[ "Z10012" ]',
				doValidate: false
			} ),
			'http://thewiki',
			'http://theevaluator'
		);

		const testError = result[ 0 ].validationResponse.Z22K2;
		assert.deepEqual(
			testError,
			readJSON( './test/features/v1/test_data/Z10012_test_error.json' )
		);

		delete result[ 0 ].duration;
		delete result[ 0 ].validationResponse.Z22K2;

		assert.deepEqual( result, [
			{
				zFunctionId: 'Z10006',
				zImplementationId: 'Z10008',
				zTesterId: 'Z10012',
				validationResponse: {
					Z1K1: 'Z22',
					Z22K1: {
						Z1K1: 'Z40',
						Z40K1: 'Z42'
					}
				}
			}
		] );
	} );

} );
