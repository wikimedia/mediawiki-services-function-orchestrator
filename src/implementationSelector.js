'use strict';

class RandomImplementationSelector {

	select( implementations ) {
		// TODO(T296677): Implement heuristics to decide which implementation to
		// use. Implicitly, current heuristic is to use a builtin if available;
		// otherwise, choose a random implementation and return that.
		const builtin = implementations.find( ( impl ) => Boolean( impl.Z14K4 ) );
		if ( builtin !== undefined ) {
			return builtin;
		}
		return implementations[ Math.floor( Math.random() * implementations.length ) ];
	}

}

module.exports = { RandomImplementationSelector };
