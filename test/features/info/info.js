'use strict';

const preq = require( 'preq' );
const assert = require( '../../utils/assert.js' );
const Server = require( '../../utils/server.js' );

describe( 'service information', function () { // eslint-disable-line no-undef

	this.timeout( 20000 );

	let infoUri = null;

	const server = new Server();

	before( () => { // eslint-disable-line no-undef
		return server.start()
			.then( () => {
				infoUri = `${server.config.uri}_info/`;
			} );
	} );

	after( () => server.stop() ); // eslint-disable-line no-undef

	// common function used for generating requests
	// and checking their return values
	function checkRet( fieldName ) {
		return preq.get( {
			uri: infoUri + fieldName
		} ).then( ( res ) => {
			// check the returned Content-Type header
			assert.contentType( res, 'application/json' );
			// the status as well
			assert.status( res, 200 );
			// finally, check the body has the specified field
			assert.notDeepEqual( res.body, undefined, 'No body returned!' );
			assert.notDeepEqual( res.body[ fieldName ], undefined, `No ${fieldName} field returned!` );
		} );
	}

	it( 'should get the service name', () => { // eslint-disable-line no-undef
		return checkRet( 'name' );
	} );

	it( 'should get the service version', () => { // eslint-disable-line no-undef
		return checkRet( 'version' );
	} );

	it( 'should redirect to the service home page', () => { // eslint-disable-line no-undef
		return preq.get( {
			uri: `${infoUri}home`,
			followRedirect: false
		} ).then( ( res ) => {
			// check the status
			assert.status( res, 301 );
		} );
	} );

	it( 'should get the service info', () => { // eslint-disable-line no-undef
		return preq.get( {
			uri: infoUri
		} ).then( ( res ) => {
			// check the status
			assert.status( res, 200 );
			// check the returned Content-Type header
			assert.contentType( res, 'application/json' );
			// inspect the body
			assert.notDeepEqual( res.body, undefined, 'No body returned!' );
			assert.notDeepEqual( res.body.name, undefined, 'No name field returned!' );
			assert.notDeepEqual( res.body.version, undefined, 'No version field returned!' );
			assert.notDeepEqual( res.body.description, undefined, 'No description field returned!' );
			assert.notDeepEqual( res.body.home, undefined, 'No home field returned!' );
		} );
	} );

	it( 'should fail to get the service info for invalid endpoint', () => { // eslint-disable-line no-undef
		return assert.fails(
			preq.get( { uri: `${infoUri}zzz` } ),
			( res ) => {
				assert.deepEqual( res.status, 404 );
			}
		);
	} );
} );
