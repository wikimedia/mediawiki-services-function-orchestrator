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

	const testFunctionCall = function ( name, input, output = null, error = null ) {
		it( 'orchestration endpoint: ' + name, async function () { // eslint-disable-line no-undef
			if ( output === null ) {
				output = makeVoid( /* canonical */ true );
			} else {
				output = canonicalize( output, /* withVoid= */ true ).Z22K1;
			}
			if ( error === null ) {
				error = makeVoid( /* canonical */ true );
			} else {
				error = canonicalize( error, /* withVoid= */ true ).Z22K1;
			}
			const result = await preq.post( {
				uri: uri,
				headers: {
					'content-type': 'application/json'
				},
				body: input
			} );
			assert.status( result, 200 );
			assert.contentType( result, 'application/json' );
			assert.deepEqual( output, result.body.Z22K1, name );
			// TODO( T323402 ): Check the content of Z22K2/metadata
			assert.isTrue( isZMap( result.body.Z22K2 ), name );
			assert.deepEqual( error, getError( result.body ), name );
		} );
	};

	// Z823 returns TypedPair<Z1, TypedMap<Z6, Z1>>.  As Z823 is the only function whose Z22K1/
	// result includes a metadata map (and metadata maps contain nondeterministic values), its
	// test requires special handling.
	// output is the expected value of the first element of the typed pair.
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
			assert.deepEqual( pairType, envelope.Z22K1.Z1K1, name );
			assert.deepEqual( output, envelope.Z22K1.K1, name );
			// TODO( T323402 ): Check the content of Z22K2/metadata
			assert.isTrue( isZMap( envelope.Z22K2 ), name );
			// TODO( T323402 ): Check the content of K2/metadata
			assert.isTrue( isZMap( envelope.Z22K1.K2 ), name );
			assert.deepEqual( makeVoid( /* canonical */ true ), getError( envelope ), name );
			assert.strictEqual( undefined, getZMapValue( envelope.Z22K1.K2, 'errors' ), name );
		} );
	};

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

	const test = function ( name, zobject, output = null, error = null ) {
		return testFunctionCall( name, { zobject }, output, error );
	};

	const testString = function ( name, zobject, output = null, error = null ) {
		return testFunctionCall( name, { zobject }, output, error );
	};

	test(
		'well-formed empty Z6 string',
		{ Z1K1: 'Z6', Z6K1: '' },
		null,
		readJSON( testDataDir( 'error-not-fn.json' ) )
	);

	test(
		'return string literal',
		{ Z1K1: 'Z6', Z6K1: 'Hello' },
		null,
		readJSON( testDataDir( 'error-not-fn.json' ) )
	);

	test(
		'return string literal with space',
		{ Z1K1: 'Z6', Z6K1: 'Hello World!' },
		null,
		readJSON( testDataDir( 'error-not-fn.json' ) )
	);

	test(
		'empty Z6 string',
		'',
		null,
		readJSON( testDataDir( 'error-not-fn.json' ) )
	);

	test(
		'messy string',
		'This is a [basic] complicated test {string}!',
		null,
		readJSON( testDataDir( 'error-not-fn.json' ) )
	);

	test(
		'empty list',
		[],
		null,
		readJSON( testDataDir( 'error-not-fn.json' ) )
	);

	test(
		'string singleton list',
		[ 'Test' ],
		null,
		readJSON( testDataDir( 'error-not-fn.json' ) )
	);

	test(
		'string multiple list',
		[ 'Test', 'Test2', 'Test3' ],
		null,
		readJSON( testDataDir( 'error-not-fn.json' ) )
	);

	test(
		'record singleton list',
		[ { Z1K1: 'Z60', Z2K1: 'Test' } ],
		null,
		readJSON( testDataDir( 'error-not-fn.json' ) )
	);

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

	// Parser

	testString( 'simple string parsed', '"test"', null, readJSON( testDataDir( 'error-not-fn.json' ) ) );

	testString( 'empty string', '""', null, readJSON( testDataDir( 'error-not-fn.json' ) ) );

	test( 'escaped empty string', '""', null, readJSON( testDataDir( 'error-not-fn.json' ) ) );

	testString(
		'well formed Z6 string',
		'{ "Z1K1": "Z6", "Z6K1": "" }',
		null,
		readJSON( testDataDir( 'error-not-fn.json' ) )
	);

	testString(
		'messy string',
		'"This is a [basic] complicated test {string}!"',
		null,
		readJSON( testDataDir( 'error-not-fn.json' ) )
	);

	testString( 'string empty list', '[]', null, readJSON( testDataDir( 'error-not-fn.json' ) ) );

	testString( 'string singleton list', '["Test"]', null, readJSON( testDataDir( 'error-not-fn.json' ) ) );

	// Tests function calls.
	testFunctionCall(
		'function call for Z802 with reference to Z902',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z802_false.json' ) ) },
		readJSON( testDataDir( 'Z902_false_expected.json' ) )
	);

	testFunctionCall(
		'function call for the false Z902 (if), the dissembler',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z902_false.json' ) ) },
		readJSON( testDataDir( 'Z902_false_expected.json' ) )
	);

	testFunctionCall(
		'function call for the true Z902 (if), the good if',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z902_true.json' ) ) },
		readJSON( testDataDir( 'Z902_true_expected.json' ) )
	);

	testFunctionCall(
		'function call for Z803 with reference to Z903',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z903.json' ) ) },
		{
			Z1K1: 'Z6',
			Z6K1: 'funicle'
		}
	);

	testFunctionCall(
		'function call for Z903 (value by key)',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z903.json' ) ) },
		{
			Z1K1: 'Z6',
			Z6K1: 'funicle'
		}
	);

	testFunctionCall(
		'function call for Z903 (value by key) with bad key',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z903_bad_key.json' ) ) },
		null,
		{ Z1K1: 'Z5', Z5K1: 'Z507', Z5K2: { Z1K1: { Z1K1: 'Z7', Z7K1: 'Z885', Z885K1: 'Z507' }, Z507K1: 'Object did not contain key "Z10000K5"' } }
	);

	testFunctionCall(
		'function call for Z804',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z804.json' ) ) },
		readJSON( testDataDir( 'Z804_expected.json' ) )
	);

	testFunctionCall(
		'function call for Z805 with reference to Z905',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z805.json' ) ) },
		readJSON( testDataDir( 'Z905_expected.json' ) )
	);

	testFunctionCall(
		'function call for Z905 (reify)',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z905.json' ) ) },
		readJSON( testDataDir( 'Z905_expected.json' ) )
	);

	testFunctionCall(
		'function call for Z808 with reference to Z908',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z808.json' ) ) },
		readJSON( testDataDir( 'Z908_expected.json' ) )
	);

	testFunctionCall(
		'function call for Z908 (abstract)',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z908.json' ) ) },
		readJSON( testDataDir( 'Z908_expected.json' ) )
	);

	testFunctionCall(
		'function call (short form) for Z810/Cons onto empty List',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z810.json' ) ) },
		readJSON( testDataDir( 'Z910_expected.json' ) )
	);

	testFunctionCall(
		'function call (short form) for Z810/Cons onto empty Z881',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z810_empty_Z881.json' ) ) },
		readJSON( testDataDir( 'Z910_empty_Z881_expected.json' ) )
	);

	testFunctionCall(
		'function call (short form) for Z810/Cons onto non-empty Z881',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z810_full_Z881.json' ) ) },
		readJSON( testDataDir( 'Z910_full_Z881_expected.json' ) )
	);

	testFunctionCall(
		'function call for Z910/Cons onto empty List',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z910.json' ) ) },
		readJSON( testDataDir( 'Z910_expected.json' ) )
	);

	testFunctionCall(
		'function call for Z910/Cons onto empty Z881',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z910_empty_Z881.json' ) ) },
		readJSON( testDataDir( 'Z910_empty_Z881_expected.json' ) )
	);

	testFunctionCall(
		'function call for Z910/Cons onto non-empty Z881',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z910_full_Z881.json' ) ) },
		readJSON( testDataDir( 'Z910_full_Z881_expected.json' ) )
	);

	testFunctionCall(
		'function call (short form) for Z811/Head with non-empty List',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z811.json' ) ) },
		{ Z1K1: 'Z6', Z6K1: 'arbitrary ZObject' }
	);

	testFunctionCall(
		'function call (short form) for Z811/Head with non-empty Z881',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z811_full_Z881.json' ) ) },
		{ Z1K1: 'Z6', Z6K1: 'i met a traveler from an antique land' }
	);

	testFunctionCall(
		'function call (short form) for Z811/Head with empty Z881',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z811_empty_Z881.json' ) ) },
		null,
		{ Z1K1: 'Z5', Z5K1: 'Z506', Z5K2: { Z1K1: { Z1K1: 'Z7', Z7K1: 'Z885', Z885K1: 'Z506' }, Z506K1: 'An empty list has no head.' } }
	);

	testFunctionCall(
		'function call for Z911 (head) with non-empty List',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z911.json' ) ) },
		{ Z1K1: 'Z6', Z6K1: 'arbitrary ZObject' }
	);

	testFunctionCall(
		'function call for Z811/Head with reference to Z911 and non-empty Z881',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z911_full_Z881.json' ) ) },
		{ Z1K1: 'Z6', Z6K1: 'i met a traveler from an antique land' }
	);

	testFunctionCall(
		'function call for Z911 (head) with empty List',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z911_empty.json' ) ) },
		null,
		{ Z1K1: 'Z5', Z5K1: 'Z506', Z5K2: { Z1K1: { Z1K1: 'Z7', Z7K1: 'Z885', Z885K1: 'Z506' }, Z506K1: 'An empty list has no head.' } }
	);

	testFunctionCall(
		'function call for Z811/Head with reference to Z911 and empty Z881',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z911_empty_Z881.json' ) ) },
		null,
		{ Z1K1: 'Z5', Z5K1: 'Z506', Z5K2: { Z1K1: { Z1K1: 'Z7', Z7K1: 'Z885', Z885K1: 'Z506' }, Z506K1: 'An empty list has no head.' } }
	);

	testFunctionCall(
		'function call (short form) for Z812/Tail with non-empty List',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z812.json' ) ) },
		[ 'Z6', 'specific ZObject' ]
	);

	testFunctionCall(
		'function call (short form) for Z812/Tail with non-empty Z881',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z812_full_Z881.json' ) ) },
		readJSON( testDataDir( 'Z912_full_Z881_expected.json' ) )
	);

	testFunctionCall(
		'function call (short form) for Z812/Tail with empty Z881',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z812_empty_Z881.json' ) ) },
		null,
		{ Z1K1: 'Z5', Z5K1: 'Z506', Z5K2: { Z1K1: { Z1K1: 'Z7', Z7K1: 'Z885', Z885K1: 'Z506' }, Z506K1: 'An empty list has no tail.' } }
	);

	testFunctionCall(
		'function call for Z812/Tail with reference to Z912 and non-empty List',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z912.json' ) ) },
		[ 'Z6', 'specific ZObject' ]
	);

	testFunctionCall(
		'function call for Z812/Tail with reference to Z912 and non-empty Z881',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z912_full_Z881.json' ) ) },
		readJSON( testDataDir( 'Z912_full_Z881_expected.json' ) )
	);

	testFunctionCall(
		'function call for Z812/Tail with reference to Z912 and empty List',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z912_empty.json' ) ) },
		null,
		{ Z1K1: 'Z5', Z5K1: 'Z506', Z5K2: { Z1K1: { Z1K1: 'Z7', Z7K1: 'Z885', Z885K1: 'Z506' }, Z506K1: 'An empty list has no tail.' } }
	);

	testFunctionCall(
		'function call for Z812/Tail with reference to Z912 and empty Z881',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z912_empty_Z881.json' ) ) },
		null,
		{ Z1K1: 'Z5', Z5K1: 'Z506', Z5K2: { Z1K1: { Z1K1: 'Z7', Z7K1: 'Z885', Z885K1: 'Z506' }, Z506K1: 'An empty list has no tail.' } }
	);

	testFunctionCall(
		'function call (short form) for Z813/Empty with an empty List (benjamin)',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z813_empty_benjamin.json' ) ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z41' } }
	);

	testFunctionCall(
		'function call (short form) for Z813/Empty with an empty Z881',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z813_empty_Z881.json' ) ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z41' } }
	);

	testFunctionCall(
		'function call (short form) for Z813/Empty with a non-empty Z881',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z813_full_Z881.json' ) ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z42' } }
	);

	testFunctionCall(
		'function call (short form) for Z813/Empty with a non-empty List (benjamin)',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z813_full_benjamin.json' ) ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z42' } }
	);

	testFunctionCall(
		'function call for Z813/Empty with reference to Z913 and an empty List (benjamin)',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z913_empty_benjamin.json' ) ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z41' } }
	);

	testFunctionCall(
		'function call for Z813/Empty with reference to Z913 and an empty Z881',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z913_empty_Z881.json' ) ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z41' } }
	);

	testFunctionCall(
		'function call for Z813/Empty with reference to Z913 and a non-empty List (benjamin)',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z913_full_benjamin.json' ) ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z42' } }
	);

	testFunctionCall(
		'function call for Z813/Empty with reference to Z913 and an non-empty Z881',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z913_full_Z881.json' ) ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z42' } }
	);

	testFunctionCall(
		'function call for Z821 (first)',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z821.json' ) ) },
		'first element of pair'
	);

	testFunctionCall(
		'function call for Z821 (first) with reference to Z921',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z921.json' ) ) },
		'first element of pair'
	);

	testFunctionCall(
		'function call for Z822 (second)',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z822.json' ) ) },
		'2nd element of pair'
	);

	testFunctionCall(
		'function call for Z822 (second) with reference to Z922',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z922.json' ) ) },
		'2nd element of pair'
	);

	testFunctionCall(
		'function call for Z868',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z868.json' ) ) },
		readJSON( testDataDir( 'Z968_expected.json' ) )
	);

	testFunctionCall(
		'function call for Z868 with Z881 output spec',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z868.json' ) ) },
		readJSON( testDataDir( 'Z968_expected_with_Z881.json' ) )
	);

	testFunctionCall(
		'function call for Z968 (string to code points)',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z968.json' ) ) },
		readJSON( testDataDir( 'Z968_expected.json' ) )
	);

	testFunctionCall(
		'function call for Z968 (string to code points) with Z881 output spec',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z968.json' ) ) },
		readJSON( testDataDir( 'Z968_expected_with_Z881.json' ) )
	);

	testFunctionCall(
		'function call for Z968 (string to code points) with combined Emoji',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z968_emoji.json' ) ) },
		readJSON( testDataDir( 'Z968_emoji_expected.json' ) )
	);

	testFunctionCall(
		'function call for Z883 (short form)',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z883.json' ) ) },
		readJSON( testDataDir( 'Z883_expected.json' ) )
	);

	testFunctionCall(
		'function call for Z886 (short form)',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z886.json' ) ) },
		{ Z1K1: 'Z6', Z6K1: 'mus' }
	);

	testFunctionCall(
		'function call for Z886 (short form) with Z881 input',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z886_with_Z881.json' ) ) },
		{ Z1K1: 'Z6', Z6K1: 'mus' }
	);

	testFunctionCall(
		'function call for Z986 (code points to string)',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z986.json' ) ) },
		{ Z1K1: 'Z6', Z6K1: 'mus' }
	);

	testFunctionCall(
		'function call for Z986 (code points to string) with Z881 input',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z986_with_Z881.json' ) ) },
		{ Z1K1: 'Z6', Z6K1: 'mus' }
	);

	testFunctionCall(
		'function call for Z986 (code points to string) with combining characters',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z986_emoji.json' ) ) },
		readJSON( testDataDir( 'Z986_emoji_expected.json' ) )
	);

	testFunctionCall(
		'function call for Z986 (code points to string) with combining characters, with Z881 input',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z986_emoji_with_Z881.json' ) ) },
		readJSON( testDataDir( 'Z986_emoji_expected.json' ) )
	);

	testFunctionCall(
		'function call for Z888 with reference to Z988',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z888_same.json' ) ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z41' } }
	);

	testFunctionCall(
		'function call for Z988 (same), and the arguments are truly same',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z988_same.json' ) ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z41' } }
	);

	testFunctionCall(
		'function call for Z988 (same), and lo, they are not same',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z988_different.json' ) ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z42' } }
	);

	testFunctionCall(
		'function call for Z899 with reference to Z999',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z899.json' ) ) },
		{ Z1K1: 'Z9', Z9K1: 'Z11' }
	);

	testFunctionCall(
		'function call for Z999 (unquote)',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z999.json' ) ) },
		{ Z1K1: 'Z9', Z9K1: 'Z11' }
	);

	testFunctionCall(
		'non-normalized function call with array',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z988_different_non-normalized.json' ) ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z42' } }
	);

	testFunctionCall(
		'composition',
		{ doValidate: true, zobject: readJSON( testDataDir( 'composition.json' ) ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z42' } }
	);

	testFunctionCall(
		'composition consisting of an argument reference',
		{ doValidate: true, zobject: readJSON( testDataDir( 'composition_arg_only.json' ) ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z41' } }
	);

	testFunctionCall(
		'composition consisting of an argument reference again',
		{ doValidate: true, zobject: readJSON( testDataDir( 'composition_arg_only_false.json' ) ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z42' } }
	);

	testFunctionCall(
		'function call for Z960 (language code to language)',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z6_english.json' ) ) },
		'Z1002'
	);

	testZ823Call(
		'function call for Z823/Get envelope',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z823.json' ) ) },
		{ Z1K1: 'Z6', Z6K1: 'arbitrary ZObject' }
	);

	testFunctionCall(
		'function call for Z889/List equality with reference to Z989 and lists of different length',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z989_different_length.json' ) ) },
		{ Z1K1: 'Z40', Z40K1: 'Z42' }
	);

	testFunctionCall(
		'function call for Z889/List equality with reference to Z989 and lists with different elements',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z989_different_elements.json' ) ) },
		{ Z1K1: 'Z40', Z40K1: 'Z42' }
	);

	testFunctionCall(
		'function call for Z889/List equality with reference to Z989 and equal lists',
		{ doValidate: true, zobject: readJSON( testDataDir( 'Z989_equal.json' ) ) },
		{ Z1K1: 'Z40', Z40K1: 'Z41' }
	);
} );
