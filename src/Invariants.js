'use strict';

/**
 * Encapsulates objects which will not change over the course of a function execution.
 */
class Invariants {
	constructor( evaluator, resolver ) {
		// Evaluator wraps the function-evaluator service.
		Object.defineProperty( this, 'evaluator', {
			get: function () {
				return evaluator;
			}
		} );
		// Resolver wraps MediaWiki for the purpose of calling wikilambda-fetch.
		Object.defineProperty( this, 'resolver', {
			get: function () {
				return resolver;
			}
		} );
	}
}

module.exports = { Invariants };
