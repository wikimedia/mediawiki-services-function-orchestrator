'use strict';

const assert = require( '../../utils/assert.js' );
const { ZWrapper } = require( '../../../src/ZWrapper' );
const { BaseFrame, EmptyFrame } = require( '../../../src/frame.js' );

describe( 'ZWrapper test', function () { // eslint-disable-line no-undef

	it( 'ZWrapper class string construction', () => { // eslint-disable-line no-undef
		const stringIsNotAZWrapper = ZWrapper.create( 'Hello I am a test string', new EmptyFrame() );

		assert.deepEqual( stringIsNotAZWrapper, 'Hello I am a test string' );
	} );

	it( 'ZWrapper class construction', () => { // eslint-disable-line no-undef
		const emptyObject = {};
		const emptyZWrapper = ZWrapper.create( emptyObject, new EmptyFrame() );
		assert.deepEqual( emptyObject, emptyZWrapper.asJSON() );
		assert.deepEqual( new Set(), new Set( emptyZWrapper.keys() ) );

		const aReference = { Z1K1: 'Z9', Z9K1: 'Z9' };
		const aReferenceZWrapper = ZWrapper.create( aReference, new EmptyFrame() );
		assert.deepEqual( aReference, aReferenceZWrapper.asJSON() );
		assert.deepEqual( new Set( [ 'Z1K1', 'Z9K1' ] ), new Set( aReferenceZWrapper.keys() ) );
		assert.deepEqual( 'Z9', aReferenceZWrapper.Z1K1 );
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
		const georgieWrapper = ZWrapper.create( theTrueTrue, new EmptyFrame() );
		assert.deepEqual( theTrueTrue.Z1K1, georgieWrapper.original_.get( 'Z1K1' ).asJSON() );
		assert.deepEqual( false, georgieWrapper.resolved_.has( 'Z1K1' ) );

		await georgieWrapper.resolveKey( [ 'Z1K1' ], /* invariants= */ null );
		assert.deepEqual( theTrueTrue.Z1K1, georgieWrapper.resolved_.get( 'Z1K1' ).asJSON() );
	} );

	it( 'ZWrapper debugObject', () => { // eslint-disable-line no-undef
		const emptyObject = {};

		const nullZReferenceString = 'Z24';
		const nullZReference = { Z1K1: 'Z9', Z9K1: nullZReferenceString };

		const emptyZWrapper = ZWrapper.create( emptyObject, new EmptyFrame() );
		assert.deepEqual(
			{ object_: nullZReference, scope_: {} },
			emptyZWrapper.debugObject()
		);

		const recursiveEmptyZWrapper = ZWrapper.create(
			emptyObject,
			new BaseFrame( emptyZWrapper )
		);
		assert.deepEqual(
			{ object_: nullZReference, scope_: { object_: nullZReference, scope_: {} } },
			recursiveEmptyZWrapper.debugObject()
		);

		const emptyEnvelopeObject = { Z1K1: 'Z22', Z22K1: nullZReference, Z22K2: nullZReference };

		const baseZWrapper = ZWrapper.create( emptyEnvelopeObject, new BaseFrame( emptyZWrapper ) );
		assert.deepEqual(
			{
				// The nullZReferences (normal form) become nullZReferenceStrings (canonical)
				object_: { Z1K1: 'Z22', Z22K1: nullZReferenceString, Z22K2: nullZReferenceString },
				scope_: { object_: nullZReference, scope_: {} }
			},
			baseZWrapper.debugObject()
		);
	} );

	it( 'ZWrapper asJSON, asJSONEphemeral respect correct keys', () => { // eslint-disable-line no-undef
		const theObject = {
			Z1K1: {
				Z1K1: 'Z9',
				Z9K1: 'Z10000'
			},
			K1: {
				Z1K1: {
					Z1K1: 'Z9',
					Z9K1: 'Z18'
				},
				Z18K1: {
					Z1K1: 'Z9',
					Z9K1: 'Z10005'
				}
			},
			K2: {
				Z1K1: {
					Z1K1: 'Z9',
					Z9K1: 'Z18'
				},
				Z18K1: {
					Z1K1: 'Z9',
					Z9K1: 'Z10006'
				}
			}
		};
		const replacementStringOne = {
			Z1K1: 'Z6',
			Z6K1: 'diamond daimon monad i'
		};
		const replacementStringTwo = {
			Z1K1: 'Z6',
			Z6K1: 'adam kadmon in the sky'
		};
		const wrappedObject = ZWrapper.create( theObject, new EmptyFrame() );
		wrappedObject.setName( 'K1', replacementStringOne );
		wrappedObject.setNameEphemeral( 'K2', replacementStringTwo );

		// For asJSON, the non-ephemerally set key should be visible but not the ephemeral one.
		const actualJSON = wrappedObject.asJSON();
		const expectedJSON = { ...theObject };
		expectedJSON.K1 = replacementStringOne;
		assert.deepEqual( actualJSON, expectedJSON );

		// For asJSONEphemeral, both set keys should be visible.
		const actualJSONEphemeral = wrappedObject.asJSONEphemeral();
		const expectedJSONEphemeral = { ...theObject };
		expectedJSONEphemeral.K1 = replacementStringOne;
		expectedJSONEphemeral.K2 = replacementStringTwo;
		assert.deepEqual( actualJSONEphemeral, expectedJSONEphemeral );
	} );

} );
