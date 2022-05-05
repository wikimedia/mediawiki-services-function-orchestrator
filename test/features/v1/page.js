'use strict';

const preq = require( 'preq' );
const assert = require( '../../utils/assert.js' );
const Server = require( '../../utils/server.js' );

describe( 'page gets', function () { // eslint-disable-line no-undef

	this.timeout( 20000 );

	let uri = null;
	const server = new Server();

	before( () => { // eslint-disable-line no-undef
		return server.start()
			.then( () => {
				uri = `${server.config.uri}en.wikipedia.org/v1/page/Table_(database)/`;
			} );
	} );

	after( () => server.stop() ); // eslint-disable-line no-undef

	it( 'should get the whole page body', () => { // eslint-disable-line no-undef
		return preq.get( {
			uri
		} ).then( ( res ) => {
			// check the status
			assert.status( res, 200 );
			// check the returned Content-Type header
			assert.contentType( res, 'text/html' );
			// inspect the body
			assert.notDeepEqual( res.body, undefined, 'No body returned!' );
			// this should be the right page
			if ( !/Table_\(database\)#cite/.test( res.body ) ) {
				throw new Error( 'Not the title I was expecting!' );
			}
		} );
	} );

	it( 'should get only the leading section', () => { // eslint-disable-line no-undef
		return preq.get( {
			uri: `${uri}lead`
		} ).then( ( res ) => {
			// check the status
			assert.status( res, 200 );
			// check the returned Content-Type header
			assert.contentType( res, 'text/html' );
			// inspect the body
			assert.notDeepEqual( res.body, undefined, 'No body returned!' );
			// this should be the right page
			if ( !/Table/.test( res.body ) ) {
				throw new Error( 'Not the page I was expecting!' );
			}
			// .. and should start with <div id="lead_section">
			if ( !/^<div id="lead_section">/.test( res.body ) ) {
				throw new Error( 'This is not a leading section!' );
			}
		} );
	} );

	it( 'should throw a 404 for a non-existent page', () => { // eslint-disable-line no-undef
		return preq.get( {
			uri: `${server.config.uri}en.wikipedia.org/v1/page/Foobar_and_friends`
		} ).then( ( res ) => {
			// if we are here, no error was thrown, not good
			throw new Error( 'Expected an error to be thrown, got status: ', res.status );
		}, ( err ) => {
			// inspect the status
			assert.deepEqual( err.status, 404 );
		} );
	} );
} );
