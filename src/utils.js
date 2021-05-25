'use strict';

// TODO: T282891
function Z23() {
	return { Z1K1: { Z1K1: 'Z9', Z9K1: 'Z23' } };
}

// TODO: T282891
function makePair(goodResult = null, badResult = null) {
    return {
        Z1K1: {
            Z1K1: 'Z9',
            Z9K1: 'Z22'
        },
        Z22K1: goodResult || Z23(),
        Z22K2: badResult || Z23()
    };
}

module.exports = { makePair, Z23 };
