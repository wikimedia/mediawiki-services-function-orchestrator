'use strict';

const assert = require( '../../utils/assert.js' );
const { ZWrapper } = require( '../../../src/zobject.js' );

describe( 'ZWrapperFOO test', function () {

	it( 'ZWrapper class string construction', async () => {
		const stringIsNotAZWrapper = ZWrapper.create( 'Hello I am a test string' );

		assert.deepEqual( stringIsNotAZWrapper, 'Hello I am a test string' );
	} );

	it( 'ZWrapper class construction', async () => {
		let keyMap;

		const emptyZWrapper = ZWrapper.create( {} );
		assert.deepEqual( emptyZWrapper.asJSON(), {} );

		keyMap = emptyZWrapper.names_;
		assert.deepEqual( keyMap.size, 0 );

		const emptyListZWrapper = ZWrapper.create( { Z1K1: 'Z13' } );
		assert.deepEqual( emptyListZWrapper.asJSON(), { Z1K1: 'Z13' } );

		keyMap = emptyListZWrapper.names_;
		assert.deepEqual( keyMap.size, 1 );
		assert.ok( keyMap.has( 'Z1K1' ) );
		assert.deepEqual( keyMap.get( 'Z1K1' ), 'Z13' );
	} );
} );
