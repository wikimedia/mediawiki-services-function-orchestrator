'use strict';

const assert = require( '../../utils/assert.js' );
const { ZWrapper } = require( '../../../src/ZWrapper' );

describe( 'ZWrapper test', function () { // eslint-disable-line no-undef

	it( 'ZWrapper class string construction', () => { // eslint-disable-line no-undef
		const stringIsNotAZWrapper = ZWrapper.create( 'Hello I am a test string' );

		assert.deepEqual( stringIsNotAZWrapper, 'Hello I am a test string' );
	} );

	it( 'ZWrapper class construction', () => { // eslint-disable-line no-undef
		const emptyObject = {};
		const emptyZWrapper = ZWrapper.create( emptyObject );
		assert.deepEqual( emptyZWrapper.asJSON(), emptyObject );
		assert.deepEqual( new Set( emptyZWrapper.keys() ), new Set() );

		const aReference = { Z1K1: 'Z9', Z9K1: 'Z9' };
		const aReferenceZWrapper = ZWrapper.create( aReference );
		assert.deepEqual( aReferenceZWrapper.asJSON(), aReference );
		assert.deepEqual( new Set( aReferenceZWrapper.keys() ), new Set( [ 'Z1K1', 'Z9K1' ] ) );
		assert.deepEqual( aReferenceZWrapper.Z1K1, 'Z9' );
	} );

	it( 'ZWrapper resolution', async () => { // eslint-disable-line no-undef
		const theTrueTrue = {
			Z1K1: {
				Z1K1: 'Z9',
				Z9K1: 'Z40'
			},
			Z40K1: {
				Z1K1: 'Z9',
				Z9K1: 'Z41'
			}
		};
		const georgieWrapper = ZWrapper.create( theTrueTrue );
		assert.deepEqual( georgieWrapper.original_.get( 'Z1K1' ).asJSON(), theTrueTrue.Z1K1 );
		assert.deepEqual( georgieWrapper.resolved_.has( 'Z1K1' ), false );

		await georgieWrapper.resolveKey( [ 'Z1K1' ], /* invariants= */ null );
		assert.deepEqual( georgieWrapper.resolved_.get( 'Z1K1' ).asJSON(), theTrueTrue.Z1K1 );
	} );
} );
