'use strict';

const fetch = require( '../lib/fetch.js' );
const { convertWrappedZObjectToVersionedBinary } = require( '../function-schemata/javascript/src/serialize.js' );
const WebSocket = require( 'ws' );

const AVRO_SCHEMA_VERSION_ = '0.0.2';

/**
 * Function evaluator. Wraps API calls to the function-evaluator service, which
 * runs native code implementations.
 */
class Evaluator {
	constructor( evaluatorConfig ) {
		this.useReentrance_ = evaluatorConfig.useReentrance;
		this.evaluatorWs_ = evaluatorConfig.evaluatorWs;
		if ( this.evaluatorWs_ === null && this.useReentrance_ ) {
			console.warn(
				'useReentrance was specified but no websocket location was supplied; ',
				'setting useReentrance to false' );
			this.useReentrance_ = false;
		}
		this.evaluatorUri_ = evaluatorConfig.evaluatorUri;
		this.invariants_ = null;
		this.timeout_ = 10000; // wait 10 seconds
		this.programmingLanguages_ = Object.freeze( evaluatorConfig.programmingLanguages );
		Object.defineProperty( this, 'programmingLanguages', {
			get: function () {
				return this.programmingLanguages_;
			}
		} );
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
				const { orchestrate } = require( './orchestrate' );
				theMessage = theMessage.replace( /^call\s*/, '' );
				const Z7 = JSON.parse( theMessage );
				const normalResult = ( await orchestrate(
					Z7, this.invariants_, /* implementationSelector= */ null,
					/* returnNormal= */ true ) ).Z22K1;
				client.send( JSON.stringify( normalResult ) );
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

	setInvariants( invariants ) {
		this.invariants_ = invariants;
	}
}

module.exports = { Evaluator };
