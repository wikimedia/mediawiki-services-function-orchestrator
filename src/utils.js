'use strict';

const { SchemaFactory } = require('../function-schemata/javascript/src/schema.js');

const normalize = require('../function-schemata/javascript/src/normalize.js');
const { canonicalError, error } = require('../function-schemata/javascript/src/error');

const normalFactory = SchemaFactory.NORMAL();
const normalValidator = normalFactory.create('Z1');

// TODO: T282891
function Z23(canonical = false) {
    if (canonical) {
        return 'Z23';
    }
	return { Z1K1: 'Z9', Z9K1: 'Z23' };
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

function normalizePromise(zobject) {
    return new Promise((resolve, reject) => {
        try {
            const result = normalize(zobject);
            // TODO: Remove exception for Z5s in normalize() to avoid this code path.
            if (!normalValidator.validate(result)) {
                reject(makePair(null, zobject, true));
            } else {
                resolve(result);
            }
        } catch (err) {
            // TODO: Add an appropriate error type in schemata; use here.
            // TODO: normalize() should return validation errors.
            reject(makePair(
                null,
                canonicalError(
                    [ error.not_wellformed ],
                    [ zobject ]
                ),
                true
            ));
        }
    });
}

module.exports = { makePair, Z23, normalizePromise };
