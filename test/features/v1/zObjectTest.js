'use strict';

const assert = require( '../../utils/assert.js' );
const { ZObject } = require( '../../../src/zobject.js' );

describe( 'ZObjectFOO test', function () {

	it( 'ZObject class string construction', async () => {
		const stringIsNotAZObject = ZObject.create( 'Hello I am a test string' );

		assert.deepEqual( stringIsNotAZObject, 'Hello I am a test string' );
	} );

	it( 'ZObject class construction', async () => {
		let keyMap;

		const emptyZObject = ZObject.create( {} );
		assert.deepEqual( emptyZObject.asJSON(), {} );

		keyMap = emptyZObject.names_;
		assert.deepEqual( keyMap.size, 0 );

		const emptyListZObject = ZObject.create( { Z1K1: 'Z13' } );
		assert.deepEqual( emptyListZObject.asJSON(), { Z1K1: 'Z13' } );

		keyMap = emptyListZObject.names_;
		assert.deepEqual( keyMap.size, 1 );
		assert.ok( keyMap.has( 'Z1K1' ) );
		assert.deepEqual( keyMap.get( 'Z1K1' ), 'Z13' );
	} );
} );
