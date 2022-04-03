'use strict';

const assert = require( '../../utils/assert.js' );
const { rest } = require( 'msw' );
const { setupServer } = require( 'msw/node' );
const performTest = require( '../../../src/performTest.js' );
const { readJSON, readZObjectsFromDirectory } = require( '../../utils/read-json.js' );

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

describe( 'performTest', function () {
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
		rest.get( 'http://localhost:6254/*', ( req, res, ctx ) => {} )
	];
	const mockServiceWorker = setupServer( ...restHandlers );

	before( () => mockServiceWorker.listen() );

	after( () => {
		return mockServiceWorker.resetHandlers();
	} );

	it( 'performs a test and validation, and returns the result.', async () => {
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

		const result = await performTest( JSON.stringify( {
			zfunction: 'Z10006',
			zimplementations: '[]',
			ztesters: '[]',
			wikiUri: 'http://thewiki',
			evaluatorUri: 'http://theevaluator',
			doValidate: false
		} ) );

		delete result[ 0 ].duration;

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
					},
					Z22K2: 'Z24'
				}
			}
		] );
	} );
} );
