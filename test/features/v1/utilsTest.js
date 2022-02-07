'use strict';

const assert = require( '../../utils/assert.js' );
const { generateError, makeResultEnvelopeAndMaybeCanonicalise, returnOnFirstError } = require( '../../../src/utils.js' );

describe( 'utils test', function () {

	const goodZ22 = makeResultEnvelopeAndMaybeCanonicalise(
		{ Z1K1: 'Z6', Z6K1: 'dull but reliable sigma string' }, null
	);

	const badZ22 = makeResultEnvelopeAndMaybeCanonicalise(
		null, generateError( 'extremely exciting but morally flawed error string' )
	);

	it( 'returnOnFirstError encounters error in first function', async () => {
		const badFunction = () => {
			return badZ22;
		};
		const goodFunction = () => {
			return goodZ22;
		};
		const result = await returnOnFirstError(
			goodZ22, [
				[ badFunction, [], 'badFunction' ],
				[ goodFunction, [], 'goodFunction' ] ] );
		assert.deepEqual( badZ22, result );
	} );

	it( 'returnOnFirstError encounters no errors', async () => {
		const theFunction = ( Z22K1 ) => {
			const result = { ...Z22K1 };
			result.Z6K1 = 'very ' + result.Z6K1;
			return makeResultEnvelopeAndMaybeCanonicalise( result, null );
		};
		const result = await returnOnFirstError(
			goodZ22, [
				[ theFunction, [], 'theFunction' ],
				[ theFunction, [], 'theFunction' ],
				[ theFunction, [], 'theFunction' ] ] );
		assert.deepEqual( 'very very very dull but reliable sigma string', result.Z22K1.Z6K1 );
	} );

	it( 'returnOnFirstError calls callback', async () => {
		let stoolPigeon = false;
		const goodFunction = () => {
			return goodZ22;
		};
		const indicatorFunction = () => {
			stoolPigeon = true;
		};
		await returnOnFirstError(
			goodZ22, [ [ goodFunction, [], 'goodFunction' ] ], indicatorFunction );
		assert.deepEqual( true, stoolPigeon );
	} );

	it( 'returnOnFirstError omits Z22 if requested', async () => {
		let stoolPigeon = false;
		const indicatorFunction = ( firstArgument = null ) => {
			if ( firstArgument !== null ) {
				stoolPigeon = true;
			}
			return goodZ22;
		};
		await returnOnFirstError(
			goodZ22, [
				[ indicatorFunction, [], 'indicatorFunction' ]
			], /* callback= */null, /* addZ22= */false );
		assert.deepEqual( false, stoolPigeon );
	} );

} );
