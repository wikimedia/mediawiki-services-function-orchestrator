'use strict';

const preq = require( 'preq' );
const { strictEqual } = require( 'assert' );
const assert = require( '../../utils/assert.js' );
const Server = require( '../../utils/server.js' );
const canonicalize = require( '../../../function-schemata/javascript/src/canonicalize.js' );
const { getMissingZ5 } = require( '../../../function-schemata/javascript/test/testUtils.js' );
const { getError, makeVoid, isZMap, getZMapValue } = require( '../../../function-schemata/javascript/src/utils.js' );
const { readJSON } = require( '../../../src/fileUtils.js' );
const { testDataDir } = require( '../../utils/testFileUtils.js' );

describe( 'orchestration endpoint', function () { // eslint-disable-line no-undef

	this.timeout( 20000 );

	let uri = null;
	const server = new Server();

	before( () => { // eslint-disable-line no-undef
		return server.start()
			.then( () => {
				uri = `${server.config.uri}wikifunctions.org/v1/evaluate/`;
			} );
	} );

	after( () => server.stop() ); // eslint-disable-line no-undef

	const testZ5 = function ( name, input, codes ) {
		it( 'orchestration endpoint: ' + name, function () { // eslint-disable-line no-undef
			return preq
				.post( {
					uri: uri,
					headers: {
						'content-type': 'application/json'
					},
					body: { zobject: input }
				} )
				.then( function ( res ) {
					assert.status( res, 200 );
					assert.contentType( res, 'application/json' );

					const notFound = getMissingZ5( res.body, codes );

					strictEqual( notFound.size, 0 );
				} );
		} );
	};

	// Z823 returns TypedPair<Z1, TypedMap<Z6, Z1>>.  As Z823 is the only function whose
	// Z22K1/result includes a metadata map (and metadata maps contain nondeterministic values),
	// its test requires special handling; i.e., it cannot use attemptOrchestration.
	// (We could use a modified form of attemptOrchestration, but let's continue to use preq.post
	// for this test as an example of that approach.)
	//
	// output is the expected value of the *first element* of the typed pair.
	const testZ823Call = function ( name, input, output ) {
		it( 'orchestration endpoint: ' + name, async function () { // eslint-disable-line no-undef
			output = canonicalize( output, /* withVoid= */ true ).Z22K1;
			const result = await preq.post( {
				uri: uri,
				headers: {
					'content-type': 'application/json'
				},
				body: input
			} );
			assert.status( result, 200 );
			assert.contentType( result, 'application/json' );
			const envelope = result.body;
			const pairType = { Z1K1: 'Z7', Z7K1: 'Z882', Z882K1: 'Z1', Z882K2: 'Z1' };
			const resultType = envelope.Z22K1.Z1K1;
			for ( const key of [ 'Z1K1', 'Z882K1', 'Z882K2' ] ) {
				assert.deepEqual( pairType[ key ], resultType[ key ], name );
			}
			assert.deepEqual( output, envelope.Z22K1.K1, name );
			// TODO( T323402 ): Check the content of Z22K2/metadata
			assert.isTrue( isZMap( envelope.Z22K2 ), name );
			// TODO( T323402 ): Check the content of K2/metadata
			// TODO( T327415 ): Check isZMap( envelope.Z22K1.K2 ) once isZMap is fixed.
			assert.deepEqual( makeVoid( /* canonical */ true ), getError( envelope ), name );
			assert.strictEqual( undefined, getZMapValue( envelope.Z22K1.K2, 'errors' ), name );
		} );
	};

	testZ5(
		'record with list and invalid sub-record',
		{ Z1K1: 'Z8', K2: [ 'Test', 'Second test' ], Z2K1: { K2: 'Test' } },
		[ 'Z502', 'Z523' ]
	);

	testZ5(
		'invalid zobject (int not string/list/record)',
		{ Z1K1: 'Z2', Z2K1: 2 },
		[ 'Z502', 'Z521' ]
	);

	testZ5(
		'invalid zobject (float not string/list/record)',
		{ Z1K1: 'Z2', Z2K1: 2.0 },
		[ 'Z502', 'Z521' ]
	);

	testZ5(
		'number in array',
		[ 2 ],
		[ 'Z521' ]
	);

	testZ823Call(
		'function call for Z823/Get envelope',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z823.json' ) ) },
		{ Z1K1: 'Z6', Z6K1: 'arbitrary ZObject' }
	);
} );
