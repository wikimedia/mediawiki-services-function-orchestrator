'use strict';

const preq = require( 'preq' );
const { strictEqual } = require( 'assert' );
const assert = require( '../../utils/assert.js' );
const Server = require( '../../utils/server.js' );
const canonicalize = require( '../../../function-schemata/javascript/src/canonicalize.js' );
const { getMissingZ5 } = require( '../../../function-schemata/javascript/test/testUtils.js' );
const utils = require( '../../../src/utils.js' );
const { readJSON } = require( '../../utils/read-json.js' );

describe( 'orchestration endpoint', function () {

	this.timeout( 20000 );

	let uri = null;
	const server = new Server();

	before( () => {
		return server.start()
			.then( () => {
				uri = `${server.config.uri}wikifunctions.org/v1/evaluate/`;
			} );
	} );

	after( () => server.stop() );

	const testFunctionCall = function ( name, input, output = null, error = null ) {
		if ( output !== null ) {
			output = canonicalize( output ).Z22K1;
		}
		if ( error !== null ) {
			error = canonicalize( error ).Z22K1;
		}
		it( 'orchestration endpoint: ' + name, function () {
			return preq.post( {
				uri: uri,
				headers: {
					'content-type': 'application/json'
				},
				body: typeof input === 'string' ? { doValidate: false, zobject: input } : input
			} )
				.then( function ( res ) {
					assert.status( res, 200 );
					assert.contentType( res, 'application/json' );
					assert.deepEqual(
						res.body,
						utils.makeResultEnvelopeAndMaybeCanonicalise( output, error, /* canonical= */ true ),
						name
					);
				} );
		} );
	};

	const testZ5 = function ( name, input, codes ) {
		it( 'orchestration endpoint: ' + name, function () {
			return preq
				.post( {
					uri: uri,
					headers: {
						'content-type': 'application/json'
					},
					body: typeof input === 'string' ? { doValidate: false, zobject: input } : input
				} )
				.then( function ( res ) {
					assert.status( res, 200 );
					assert.contentType( res, 'application/json' );

					const notFound = getMissingZ5( res.body, codes );

					strictEqual( notFound.size, 0 );
				} );
		} );
	};

	const test = function ( name, input, output = null, error = null ) {
		return testFunctionCall( name, input, output, error );
	};

	const testString = function ( name, input, output = null, error = null ) {
		return testFunctionCall( name, input, output, error );
	};

	test(
		'well-formed empty Z6 string',
		{ Z1K1: 'Z6', Z6K1: '' },
		null,
		readJSON( './test/features/v1/test_data/error-not-fn.json' )
	);

	test(
		'return string literal',
		{ Z1K1: 'Z6', Z6K1: 'Hello' },
		null,
		readJSON( './test/features/v1/test_data/error-not-fn.json' )
	);

	test(
		'return string literal with space',
		{ Z1K1: 'Z6', Z6K1: 'Hello World!' },
		null,
		readJSON( './test/features/v1/test_data/error-not-fn.json' )
	);

	test(
		'empty Z6 string',
		'',
		null,
		readJSON( './test/features/v1/test_data/error-not-fn.json' )
	);

	test(
		'messy string',
		'This is a [basic] complicated test {string}!',
		null,
		readJSON( './test/features/v1/test_data/error-not-fn.json' )
	);

	test(
		'empty list',
		[],
		null,
		readJSON( './test/features/v1/test_data/error-not-fn.json' )
	);

	test(
		'string singleton list',
		[ 'Test' ],
		null,
		readJSON( './test/features/v1/test_data/error-not-fn.json' )
	);

	test(
		'string multiple list',
		[ 'Test', 'Test2', 'Test3' ],
		null,
		readJSON( './test/features/v1/test_data/error-not-fn.json' )
	);

	test(
		'record singleton list',
		[ { Z1K1: 'Z60', Z2K1: 'Test' } ],
		null,
		readJSON( './test/features/v1/test_data/error-not-fn.json' )
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

	testString( 'simple string parsed', '"test"', null, readJSON( './test/features/v1/test_data/error-not-fn.json' ) );

	testString( 'empty string', '""', null, readJSON( './test/features/v1/test_data/error-not-fn.json' ) );

	test( 'escaped empty string', '""', null, readJSON( './test/features/v1/test_data/error-not-fn.json' ) );

	testString(
		'well formed Z6 string',
		'{ "Z1K1": "Z6", "Z6K1": "" }',
		null,
		readJSON( './test/features/v1/test_data/error-not-fn.json' )
	);

	testString(
		'messy string',
		'"This is a [basic] complicated test {string}!"',
		null,
		readJSON( './test/features/v1/test_data/error-not-fn.json' )
	);

	testString( 'string empty list', '[]', null, readJSON( './test/features/v1/test_data/error-not-fn.json' ) );

	testString( 'string singleton list', '["Test"]', null, readJSON( './test/features/v1/test_data/error-not-fn.json' ) );

	// Tests function calls.
	testFunctionCall(
		'function call for Z802 with reference to Z902',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z802_false.json' ) },
		readJSON( './test/features/v1/test_data/Z902_false_expected.json' )
	);

	testFunctionCall(
		'function call for the false Z902 (if), the dissembler',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z902_false.json' ) },
		readJSON( './test/features/v1/test_data/Z902_false_expected.json' )
	);

	testFunctionCall(
		'function call for the true Z902 (if), the good if',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z902_true.json' ) },
		readJSON( './test/features/v1/test_data/Z902_true_expected.json' )
	);

	testFunctionCall(
		'function call for Z803 with reference to Z903',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z903.json' ) },
		{
			Z1K1: 'Z6',
			Z6K1: 'funicle'
		}
	);

	testFunctionCall(
		'function call for Z903 (value by key)',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z903.json' ) },
		{
			Z1K1: 'Z6',
			Z6K1: 'funicle'
		}
	);

	testFunctionCall(
		'function call for Z903 (value by key) with bad key',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z903_bad_key.json' ) },
		null,
		{ Z1K1: 'Z5', Z5K1: { Z1K1: 'Z507', Z507K1: 'Object did not contain key "Z10K5"' } }
	);

	testFunctionCall(
		'function call for Z805 with reference to Z905',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z805.json' ) },
		readJSON( './test/features/v1/test_data/Z905_expected.json' )
	);

	testFunctionCall(
		'function call for Z905 (reify)',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z905.json' ) },
		readJSON( './test/features/v1/test_data/Z905_expected.json' )
	);

	testFunctionCall(
		'function call for Z808 with reference to Z908',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z808.json' ) },
		readJSON( './test/features/v1/test_data/Z908_expected.json' )
	);

	testFunctionCall(
		'function call for Z908 (abstract)',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z908.json' ) },
		readJSON( './test/features/v1/test_data/Z908_expected.json' )
	);

	testFunctionCall(
		'function call for Z810 with reference to Z910',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z810.json' ) },
		readJSON( './test/features/v1/test_data/Z910_expected.json' )
	);

	testFunctionCall(
		'function call for Z910 (cons)',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z910.json' ) },
		readJSON( './test/features/v1/test_data/Z910_expected.json' )
	);

	testFunctionCall(
		'function call (short form) for Z811/Head with non-empty Z10',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z811.json' ) },
		{ Z1K1: 'Z6', Z6K1: 'arbitrary ZObject' }
	);

	testFunctionCall(
		'function call (short form) for Z811/Head with non-empty Z881',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z811_full_Z881.json' ) },
		{ Z1K1: 'Z6', Z6K1: 'i met a traveler from an antique land' }
	);

	testFunctionCall(
		'function call (short form) for Z811/Head with empty Z881',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z811_empty_Z881.json' ) },
		null,
		{ Z1K1: 'Z5', Z5K1: { Z1K1: 'Z506', Z506K1: 'An empty list has no head.' } }
	);

	testFunctionCall(
		'function call for Z911 (head) with non-empty Z10',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z911.json' ) },
		{ Z1K1: 'Z6', Z6K1: 'arbitrary ZObject' }
	);

	testFunctionCall(
		'function call for Z811/Head with reference to Z911 and non-empty Z881',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z911_full_Z881.json' ) },
		{ Z1K1: 'Z6', Z6K1: 'i met a traveler from an antique land' }
	);

	testFunctionCall(
		'function call for Z911 (head) with empty Z10',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z911_empty.json' ) },
		null,
		{ Z1K1: 'Z5', Z5K1: { Z1K1: 'Z506', Z506K1: 'An empty list has no head.' } }
	);

	testFunctionCall(
		'function call (short form) for Z811/Head with reference to Z911 and empty Z881',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z911_empty_Z881.json' ) },
		null,
		{ Z1K1: 'Z5', Z5K1: { Z1K1: 'Z506', Z506K1: 'An empty list has no head.' } }
	);

	testFunctionCall(
		'function call for Z812 with reference to Z912',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z812.json' ) },
		{
			Z1K1: { Z1K1: 'Z9', Z9K1: 'Z10' },
			Z10K1: { Z1K1: 'Z6', Z6K1: 'specific ZObject' },
			Z10K2: {
				Z1K1: { Z1K1: 'Z9', Z9K1: 'Z10' }
			}
		}
	);

	testFunctionCall(
		'function call for Z912 (tail)',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z912.json' ) },
		{
			Z1K1: { Z1K1: 'Z9', Z9K1: 'Z10' },
			Z10K1: { Z1K1: 'Z6', Z6K1: 'specific ZObject' },
			Z10K2: {
				Z1K1: { Z1K1: 'Z9', Z9K1: 'Z10' }
			}
		}
	);

	testFunctionCall(
		'function call for Z912 (tail) with empty Z10',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z912_empty.json' ) },
		null,
		{ Z1K1: 'Z5', Z5K1: { Z1K1: 'Z506', Z506K1: 'An empty list has no tail.' } }
	);

	testFunctionCall(
		'function call (short form) for Z813/Empty with an empty Z10',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z813_empty_Z10.json' ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z41' } }
	);

	testFunctionCall(
		'function call (short form) for Z813/Empty with an empty Z881',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z813_empty_Z881.json' ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z41' } }
	);

	testFunctionCall(
		'function call (short form) for Z813/Empty with a non-empty Z881',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z813_full_Z881.json' ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z42' } }
	);

	testFunctionCall(
		'function call for Z813/Empty with reference to Z913 and an empty Z10',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z913_empty_Z10.json' ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z41' } }
	);

	testFunctionCall(
		'function call for Z813/Empty with reference to Z913 and an empty Z881',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z913_empty_Z881.json' ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z41' } }
	);

	testFunctionCall(
		'function call for Z813/Empty with reference to Z913 and a non-empty Z10',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z913_full_Z10.json' ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z42' } }
	);

	testFunctionCall(
		'function call for Z813/Empty with reference to Z913 and an non-empty Z881',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z913_full_Z881.json' ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z42' } }
	);

	testFunctionCall(
		'function call for Z821 with reference to Z921',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z821.json' ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z10' } }
	);

	testFunctionCall(
		'function call for Z921 (first)',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z921.json' ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z10' } }
	);

	testFunctionCall(
		'function call for Z822 with reference to Z922',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z822.json' ) },
		{ Z1K1: 'Z9', Z9K1: 'Z10' }
	);

	testFunctionCall(
		'function call for Z922 (second)',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z922.json' ) },
		{ Z1K1: 'Z9', Z9K1: 'Z10' }
	);

	testFunctionCall(
		'function call for Z868 with reference to Z968',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z868.json' ) },
		readJSON( './test/features/v1/test_data/Z968_expected.json' )
	);

	testFunctionCall(
		'function call for Z968 (string to code points)',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z968.json' ) },
		readJSON( './test/features/v1/test_data/Z968_expected.json' )
	);

	testFunctionCall(
		'function call for Z968 (string to code points) with combined Emoji',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z968_emoji.json' ) },
		readJSON( './test/features/v1/test_data/Z968_emoji_expected.json' )
	);

	testFunctionCall(
		'function call for Z886 with reference to Z986',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z886.json' ) },
		{ Z1K1: 'Z6', Z6K1: 'mus' }
	);

	testFunctionCall(
		'function call for Z986 (code points to string)',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z986.json' ) },
		{ Z1K1: 'Z6', Z6K1: 'mus' }
	);

	testFunctionCall(
		'function call for Z986 (code points to string) with combining characters',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z986_emoji.json' ) },
		readJSON( './test/features/v1/test_data/Z986_emoji_expected.json' )
	);

	testFunctionCall(
		'function call for Z888 with reference to Z988',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z888_same.json' ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z41' } }
	);

	testFunctionCall(
		'function call for Z988 (same), and the arguments are truly same',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z988_same.json' ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z41' } }
	);

	testFunctionCall(
		'function call for Z988 (same), and lo, they are not same',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z988_different.json' ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z42' } }
	);

	testFunctionCall(
		'function call for Z899 with reference to Z999',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z899.json' ) },
		{ Z1K1: 'Z9', Z9K1: 'Z10' }
	);

	testFunctionCall(
		'function call for Z999 (unquote)',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z999.json' ) },
		{ Z1K1: 'Z9', Z9K1: 'Z10' }
	);

	testFunctionCall(
		'non-normalized function call with array',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/Z988_different_non-normalized.json' ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z42' } }
	);

	testFunctionCall(
		'composition',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/composition.json' ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z42' } }
	);

	testFunctionCall(
		'composition consisting of an argument reference',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/composition_arg_only.json' ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z41' } }
	);

	testFunctionCall(
		'composition consisting of an argument reference again',
		{ doValidate: false, zobject: readJSON( './test/features/v1/test_data/composition_arg_only_false.json' ) },
		{ Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z42' } }
	);

} );
