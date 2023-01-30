'use strict';

const { BuiltIn } = require( './implementation.js' );

class RandomImplementationSelector {

	// Each implementation is an instance of class Implementation.
	select( implementations ) {
		// TODO (T296677): Implement heuristics to decide which implementation to
		// use. Implicitly, current heuristic is to use a builtin if available;
		// otherwise, choose a random implementation and return that.
		const builtin = implementations.find( ( impl ) => ( impl instanceof BuiltIn ) );
		if ( builtin !== undefined ) {
			return builtin;
		}
		return implementations[ Math.floor( Math.random() * implementations.length ) ];
	}

}

class FirstImplementationSelector {

	// Each implementation is an instance of class Implementation.
	select( implementations ) {
		return implementations[ 0 ];
	}

}

module.exports = { RandomImplementationSelector, FirstImplementationSelector };
