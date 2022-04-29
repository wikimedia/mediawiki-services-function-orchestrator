'use strict';

const Bluebird = require( 'bluebird' );
const fetch = require( 'node-fetch' );

fetch.Promise = Bluebird;

/**
 * Function evaluator. Wraps API calls to the function-evaluator service, which
 * runs native code implementations.
 */
class Evaluator {
	constructor( evaluatorUri ) {
		this.evaluatorUri_ = evaluatorUri;
	}

	async evaluate( functionCall ) {
		return await fetch(
			this.evaluatorUri_, {
				method: 'POST',
				body: JSON.stringify( functionCall ),
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
}

module.exports = { Evaluator };
