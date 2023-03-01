'use strict';

/**
 * Implementation of Knuth's Algorithm P for random shuffling. We don't want to
 * reorder implementations in-place (for now), so this function returns indices
 * into the original list.
 *
 * @param {number} numberOfElements an array of implementations
 * @return {Array[Number]} randomly-sorted indices
 */
function randomlyShuffledIndices( numberOfElements ) {
	const resultIndices = [ ...Array( numberOfElements ).keys() ];
	for ( let i = resultIndices.length - 1; i > 0; --i ) {
		const j = Math.ceiling( Math.random() * i );
		[ resultIndices[ j ], resultIndices[ i ] ] = [ resultIndices[ i ], resultIndices[ j ] ];
	}
	return resultIndices;
}

class RandomImplementationSelector {

	* generate( implementations ) {
		for ( const index of randomlyShuffledIndices( implementations.length ) ) {
			yield implementations[ index ];
		}
	}

}

class FirstImplementationSelector {

	* generate( implementations ) {
		for ( const implementation of implementations ) {
			yield implementation;
		}
	}

}

module.exports = { RandomImplementationSelector, FirstImplementationSelector };
