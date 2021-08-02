'use strict';

const { SchemaFactory } = require('../function-schemata/javascript/src/schema.js');
const normalize = require('../function-schemata/javascript/src/normalize.js');
const { normalError, error } = require('../function-schemata/javascript/src/error');

const normalFactory = SchemaFactory.NORMAL();
const Z23Validator = normalFactory.create('Z23');

// TODO: T282891
function Z23(canonical = false) {
    if (canonical) {
        return 'Z23';
    }
	return { Z1K1: 'Z9', Z9K1: 'Z23' };
}

/**
 * Determines whether argument is a Z23.
 *
 * TODO(T285433): Replace Z23 with Z21.
 *
 * @param {Object} Z1 a ZObject
 * @return {bool} true if Z1 validates as Z23
 */
function isNothing(Z1) {
    // TODO: More precise canonical-form validation of Z23.
    return Z23Validator.validate(Z1) || Z1 === 'Z23';
}

/**
 * Determines whether a pair contains an error Z23.
 *
 * @param {Object} pair a Z22
 * @return {bool} true if Z22K2 is not the Unit; false otherwise
 */
function containsError(pair) {
    return !(isNothing(pair.Z22K2));
}

// TODO: T282891
function makePair(goodResult = null, badResult = null, canonical = false) {
    let Z1K1;
    if (canonical) {
        Z1K1 = 'Z22';
    } else {
        Z1K1 = {
            Z1K1: 'Z9',
            Z9K1: 'Z22'
        };
    }
    return {
        Z1K1: Z1K1,
        Z22K1: goodResult === null ? Z23(canonical) : goodResult,
        Z22K2: badResult === null ? Z23(canonical) : badResult
    };
}

// TODO: This needs to generate an actual error instead of Z6s.
function generateError(errorString = 'An unknown error occurred') {
    return {
        Z1K1: {
            Z1K1: 'Z9',
            Z9K1: 'Z5'
        },
        Z5K2: {
            Z1K1: {
                Z1K1: 'Z9',
                Z9K1: 'Z10'
            },
            Z10K1: {
                Z1K1: {
                    Z1K1: 'Z9',
                    Z9K1: 'Z6'
                },
                Z6K1: errorString
            },
            Z10K2: {
                Z1K1: {
                    Z1K1: 'Z9',
                    Z9K1: 'Z10'
                }
            }
        }
    };
}

/**
 * Normalizes a ZObject. Returns a pair <normalized object, Unit> if normalization
 * succeeds; returns a pair <Unit, Z5> otherwise.
 *
 * @param {Object} zobject a ZObject
 * @return {Object} a Z22 as described above
 */
async function maybeNormalize(zobject) {
    try {
        const result = normalize(zobject);
        return makePair(result, null, true);
    } catch (err) {
        // TODO(T287886): failing to normalize() should return Z5s instead of throwing errors.
        return makePair(
            null,
            normalError(
                [ error.not_wellformed ],
                [ JSON.stringify(zobject) ]
            )
        );
    }
}

module.exports = { containsError, generateError, isNothing, makePair, maybeNormalize, Z23 };
