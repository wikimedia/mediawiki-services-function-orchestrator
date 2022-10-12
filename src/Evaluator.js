'use strict';

const fetch = require( '../lib/fetch.js' );
const { convertZObjectToBinary } = require( '../function-schemata/javascript/src/serialize.js' );

/**
 * Function evaluator. Wraps API calls to the function-evaluator service, which
 * runs native code implementations.
 */
class Evaluator {
	constructor( evaluatorUri ) {
		this.evaluatorUri_ = evaluatorUri;
	}

	async evaluate( functionCall ) {
		const serialized = convertZObjectToBinary( functionCall );
		return await fetch(
			this.evaluatorUri_, {
				method: 'POST',
				body: serialized,
				headers: { 'Content-type': 'application/octet-stream' }
			}
		);
	}
}

module.exports = { Evaluator };
