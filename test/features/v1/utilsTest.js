'use strict';

const assert = require( '../../utils/assert.js' );
const { responseEnvelopeContainsError, generateError, returnOnFirstError } = require( '../../../src/utils.js' );
const { makeMappedResultEnvelope, makeEmptyZResponseEnvelopeMap, setZMapValue } = require( '../../../function-schemata/javascript/src/utils.js' );

describe( 'utils test', function () { // eslint-disable-line no-undef

	const goodZ22 = makeMappedResultEnvelope(
		{ Z1K1: 'Z6', Z6K1: 'dull but reliable sigma string' }, null
	);

	const badZ22 = makeMappedResultEnvelope(
		null, generateError( 'extremely exciting but morally flawed error string' )
	);

	// responseEnvelopeContainsError

	it( 'responseEnvelopeContainsError finds nothing on undefined', async () => { // eslint-disable-line no-undef
		assert.equal( responseEnvelopeContainsError(), false );
	} );

	it( 'responseEnvelopeContainsError finds nothing on an empty object', async () => { // eslint-disable-line no-undef
		assert.equal( responseEnvelopeContainsError( {} ), false );
	} );

	it( 'responseEnvelopeContainsError finds nothing on a non-ZResponseEnvelope ZObject', async () => { // eslint-disable-line no-undef
		assert.equal( responseEnvelopeContainsError( { Z1K1: 'Z6', Z6K1: 'Hello' } ), false );
	} );

	it( 'responseEnvelopeContainsError finds nothing on an undefined ZResponseEnvelope Map', async () => { // eslint-disable-line no-undef
		assert.equal( responseEnvelopeContainsError( { Z1K1: 'Z22', Z22K1: 'Z1' } ), false );
	} );

	it( 'responseEnvelopeContainsError finds nothing on a null ZResponseEnvelope Map', async () => { // eslint-disable-line no-undef
		assert.equal( responseEnvelopeContainsError( goodZ22 ), false );
	} );

	it( 'responseEnvelopeContainsError finds nothing on void ZResponseEnvelope Map', async () => { // eslint-disable-line no-undef
		assert.equal( responseEnvelopeContainsError( makeMappedResultEnvelope( 'Z1', undefined ) ), false );
	} );

	it( 'responseEnvelopeContainsError finds nothing on empty ZResponseEnvelope Map', async () => { // eslint-disable-line no-undef
		assert.equal( responseEnvelopeContainsError( makeMappedResultEnvelope( 'Z1', makeEmptyZResponseEnvelopeMap() ) ), false );
	} );

	it( 'responseEnvelopeContainsError finds nothing on error-less ZResponseEnvelope Map', async () => { // eslint-disable-line no-undef
		const map = makeEmptyZResponseEnvelopeMap();
		setZMapValue( map, { Z1K1: 'Z6', Z6K1: 'hello' }, 'Z24' );
		assert.equal( responseEnvelopeContainsError( makeMappedResultEnvelope( 'Z1', map ) ), false );
	} );

	it( 'responseEnvelopeContainsError finds a direct error', async () => { // eslint-disable-line no-undef
		assert.equal( responseEnvelopeContainsError( badZ22 ), true );
	} );

	it( 'responseEnvelopeContainsError finds nothing on error set to Z24', async () => { // eslint-disable-line no-undef
		const map = makeEmptyZResponseEnvelopeMap();
		setZMapValue( map, { Z1K1: 'Z6', Z6K1: 'errors' }, 'Z24' );
		assert.equal( responseEnvelopeContainsError( makeMappedResultEnvelope( 'Z1', map ) ), false );
	} );

	// TODO (T300067): responseEnvelopeContainsValue
	// TODO (T300067): createSchema
	// TODO (T300067): createZObjectKey
	// TODO (T300067): isError
	// TODO (T300067): isGenericType
	// TODO (T300067): isRefOrString
	// TODO (T300067): makeBoolean
	// TODO (T300067): makeWrappedResultEnvelope
	// TODO (T300067): quoteZObject

	// returnOnFirstError

	it( 'returnOnFirstError encounters error in first function', async () => { // eslint-disable-line no-undef
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

	it( 'returnOnFirstError encounters no errors', async () => { // eslint-disable-line no-undef
		const theFunction = ( Z22K1 ) => {
			const result = { ...Z22K1 };
			result.Z6K1 = 'very ' + result.Z6K1;
			return makeMappedResultEnvelope( result, null );
		};
		const result = await returnOnFirstError(
			goodZ22, [
				[ theFunction, [], 'theFunction' ],
				[ theFunction, [], 'theFunction' ],
				[ theFunction, [], 'theFunction' ] ] );
		assert.deepEqual( 'very very very dull but reliable sigma string', result.Z22K1.Z6K1 );
	} );

	it( 'returnOnFirstError calls callback', async () => { // eslint-disable-line no-undef
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

	it( 'returnOnFirstError omits Z22 if requested', async () => { // eslint-disable-line no-undef
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

	// TODO (T300067): setMetadataValues
	// TODO (T300067): traverseZList

} );
