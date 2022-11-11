'use strict';

const fetch = require( '../lib/fetch.js' );
const { convertWrappedZObjectToVersionedBinary } = require( '../function-schemata/javascript/src/serialize.js' );
const normalize = require( '../function-schemata/javascript/src/normalize.js' );
const WebSocket = require( 'ws' );

const AVRO_SCHEMA_VERSION_ = '0.0.2';

/**
 * Function evaluator. Wraps API calls to the function-evaluator service, which
 * runs native code implementations.
 */
class Evaluator {
	constructor( evaluatorWs, evaluatorUri, wikiUri, useReentrance, doValidate ) {
		this.evaluatorWs_ = evaluatorWs;
		this.evaluatorUri_ = evaluatorUri;
		this.wikiUri_ = wikiUri;
		this.doValidate_ = doValidate;
		this.useReentrance_ = useReentrance;
		this.timeout_ = 10000; // wait 10 seconds
	}

	async evaluate( functionCall ) {
		if ( this.useReentrance_ ) {
			return await this.evaluateReentrant_( functionCall );
		} else {
			return await this.evaluate_( functionCall );
		}
	}

	async evaluate_( functionCall ) {
		const serialized = convertWrappedZObjectToVersionedBinary( {
			zobject: functionCall,
			reentrant: this.useReentrance_
		}, /* version= */ AVRO_SCHEMA_VERSION_ );
		return await fetch(
			this.evaluatorUri_, {
				method: 'POST',
				body: serialized,
				headers: { 'Content-type': 'application/octet-stream' }
			}
		);
	}

	/*
     * Ignore the subsequent function for coverage purposes; we can't feasibly
     * unit-test this functionality.
     *
     * TODO (T322056): Make EvaluatorStub able to recognize and handle multiple
     * reentrant websocket-based function calls.
     */
	// istanbul ignore next
	async evaluateReentrant_( functionCall ) {
		const evaluatePromise = this.evaluate_( functionCall );
		const client = new WebSocket( this.evaluatorWs_ );
		client.on( 'open', () => {
			console.log( 'WS connection opened' );
		} );
		client.on( 'message', async ( theMessage ) => {
			theMessage = theMessage.toString();
			console.log( 'message received:', theMessage );
			if ( theMessage.startsWith( 'call' ) ) {
				const orchestrate = require( './orchestrate' );
				theMessage = theMessage.replace( /^call\s*/, '' );
				const Z7 = JSON.parse( theMessage );
				const toOrchestrate = {
					zobject: Z7,
					evaluatorWs: this.evaluatorWs_,
					evaluatorUri: this.evaluatorUri_,
					wikiUri: this.wikiUri_,
					useReentrance: true,
					doValidate: this.doValidate_
				};
				const callResult = await orchestrate( toOrchestrate );
				const normalized = ( await normalize( callResult.Z22K1 ) ).Z22K1;
				console.log( 'normalized is', normalized );
				client.send( JSON.stringify( normalized ) );
			}
		} );
		client.on( 'close', () => {
			console.log( 'WS connection closed' );
		} );
		const result = await evaluatePromise;
		// TODO: How to wait until connection opens?
		client.close();
		return result;
	}
}

module.exports = { Evaluator };
