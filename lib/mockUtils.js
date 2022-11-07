/**
 * Util classes and functions involving mocking. Used mainly for
 * testing and performance benchmark purposes.
 */

'use strict';

const { readJSON } = require( '../src/fileUtils' );
const path = require( 'path' );
const { rest } = require( 'msw' );
const normalize = require( '../function-schemata/javascript/src/normalize.js' );
const { getWrappedZObjectFromVersionedBinary } = require( '../function-schemata/javascript/src/serialize.js' );

/**
 * A simple stub for mediaWiki API that holds fake ZObjects. When fake
 * ZObjects are not set, real ones from the file system are used.
 *
 * How to use: set up with your expected values in the tests/benchmarks, and have
 * mock REST handlers "query" from it.
 */
class MediaWikiStub {

	constructor() {
		this.reset();
		this.zObjectDir_ = 'function-schemata/data/definitions/';
	}

	reset() {
		this.wiki_ = {};
	}

	/**
	 * Set up a fake definition for a ZID.
	 *
	 * @param {string} zid The ZID you want to set up a fake for.
	 * @param {*} value The JSON definition for this zid.
	 */
	setZId( zid, value ) {
		this.wiki_[ zid ] = value;
	}

	/**
	 * Gets the fake JSON object for a certain ZID. If the value was not
	 * previously set via setZid(), then the value will be set from the
	 * real directory and returned.
	 *
	 * @param {string} zid
	 * @return {*} A fake JSON representation of the ZID.
	 */
	getZId( zid ) {
		if ( !( zid in this.wiki_ ) ) {
			const jsonObj = readJSON( path.join( this.zObjectDir_, zid + '.json' ) );
			this.setZId( zid, jsonObj );
		}
		return this.wiki_[ zid ];
	}

}

/**
 * A simple stub for the function evaluator API that holds
 * preset interactions (status code and callback) for ZIDs.
 *
 * How to use: set up with your expected values in the tests/benchmarks, and have
 * mock REST handlers "query" from it.
 */
class EvaluatorStub {
	constructor() {
		this.reset();
	}

	reset() {
		this.evaluator_ = {};
	}

	/**
	 * Set up a fake evaluator result (callback + statusCode) for a ZID.
	 *
	 * @param {string} zid
	 * @param {Function} callback A function that performs the desired outcome.
	 * @param {number} statusCode The status code to return when this ZID is queried.
	 *     Default is 200.
	 */
	setZId( zid, callback, statusCode = 200 ) {
		this.evaluator_[ zid ] = {
			statusCode: statusCode,
			callback: callback
		};
	}

	/**
	 * Gets the fake evaluator status code and callback for a certain ZID.
	 * If the value was not previously set via setEvaluator, an error will
	 * be thrown.
	 *
	 * @param {string} zid
	 * @return {*} A fake evaluator response template consisted of two parts:
	 *     {statusCode: number, callback: Function}.
	 */
	getZId( zid ) {
		if ( !( zid in this.evaluator_ ) ) {
			throw new Error( 'The evaluator for this ZID was never set!' );
		}
		return this.evaluator_[ zid ];
	}
}

/**
 * Sets up the mocking for GET requests to a mediaWiki URI so that it will
 * return preset ZObjects saved in a stub.
 *
 * @param {string} mediaWikiUri The mediaWiki URI used in a orchestrator.
 * @param {MediaWikiStub} mediaWikiStub A stub that contains JSON definitions of ZIDs.
 * @return {*} A REST mock handler. Needed for server setup.
 */
function mockMediaWiki( mediaWikiUri, mediaWikiStub ) {
	return rest.get( mediaWikiUri, ( req, res, ctx ) => {
		// Gets all the ZIDs from the request.
		const zids = req.url.searchParams.get( 'zids' );
		// Compose a map of ZID to JSON definition.
		const result = {};
		for ( const ZID of zids.split( '|' ) ) {
			result[ ZID ] = {
				wikilambda_fetch: JSON.stringify( mediaWikiStub.getZId( ZID ) )
			};
		}
		return res( ctx.status( 200 ), ctx.json( result ) );
	} );
}

/**
 * Sets up the mocking for POST requests to a evaluator URI so that it will
 * perform preset callbacks and return preset status codes.
 *
 * @param {string} evaluatorUri The evaluator URI used in a orchestrator.
 * @param {MediaWikiStub} evaluatorStub A stub that contains preset callbacks
 *     and status codes for ZIDs.
 * @return {*} A REST mock handler. Needed for server setup.
 */
function mockEvaluator( evaluatorUri, evaluatorStub ) {
	return rest.post( evaluatorUri, ( req, res, ctx ) => {
        const buffer = Buffer.from( req.body );
        const functionCall = getWrappedZObjectFromVersionedBinary( buffer ).zobject;
		const ZID = functionCall.Z7K1.Z8K5.Z9K1;
		const { statusCode, callback } = evaluatorStub.getZId( ZID );
		const value = normalize( callback( functionCall ) ).Z22K1;
		return res( ctx.status( statusCode ), ctx.json( value ) );
	} );
}

/**
 * Silently mock GET requests to the API running at :6254 and do nothing.
 *
 * @return {*} A REST mock handler. Needed for server setup.
 */
function mockLocalhost() {
	return rest.get( 'http://localhost:6254/*', ( req, res, ctx ) => {} );
}

module.exports = {
	MediaWikiStub,
	EvaluatorStub,
	mockMediaWiki,
	mockEvaluator,
	mockLocalhost
};
