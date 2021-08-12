'use strict';

const { SchemaFactory } = require('../function-schemata/javascript/src/schema.js');
const normalize = require('../function-schemata/javascript/src/normalize.js');
const { normalError, error } = require('../function-schemata/javascript/src/error');

const normalFactory = SchemaFactory.NORMAL();
const Z1Validator = normalFactory.create('Z1');
const Z6Validator = normalFactory.create('Z6');
const Z7BackendValidator = normalFactory.create('Z7_backend');
const Z9Validator = normalFactory.create('Z9');
const Z18Validator = normalFactory.create('Z18');
const Z23Validator = normalFactory.create('Z23');

function createSchema(ZID) {
    if (ZID === 'Z7') {
        ZID = 'Z7_backend';
    }
    return normalFactory.create(ZID);
}

/**
 * Validates a ZObject.
 *
  @param {Object} Z1 object to be validated
 * @return {bool} whether Z1 can validate as a Z1
 */
function isZObject(Z1) {
    return Z1Validator.validate(Z1);
}

/**
 * Validates a ZObject against the Error schema.
 *
  @param {Object} Z1 object to be validated
 * @return {bool} whether Z1 can validate as an Error
 */
function isError(Z1) {
    // TODO(T287921): Assay that Z1 validates as Z5 but not as Z9 or Z18.
    try {
        return Z1.Z1K1 === 'Z5' || Z1.Z1K1.Z9K1 === 'Z5';
    } catch (error) {
        return false;
    }
}

/**
 * Determines whether argument is a Z6 or Z9. These two types' Z1K1s are
 * strings instead of Z9s, so some checks below need to special-case their
 * logic.
 *
 * @param {Object} Z1 a ZObject
 * @return {bool} true if Z1 validates as either Z6 or Z7
 */
function isRefOrString(Z1) {
    // TODO: Prohibit Z18s.
    return Z6Validator.validate(Z1) || Z9Validator.validate(Z1);
}

/**
 * Validates a ZObject against the Function Call schema.
 *
  @param {Object} Z1 object to be validated
 * @return {bool} whether Z1 can validated as a Function Call
 */
function isFunctionCall(Z1) {
    return (Z7BackendValidator.validate(Z1) &&
        !(Z9Validator.validate(Z1)) &&
        !(Z18Validator.validate(Z1)));
}

/**
 * Determines whether argument is a Z9.
 *
 * @param {Object} Z1 a ZObject
 * @return {bool} true if Z1 validates as Z9
 */
function isReference(Z1) {
    return Z9Validator.validate(Z1);
}

/**
 * Determines whether argument is a Z18.
 *
 * @param {Object} Z1 a ZObject
 * @return {bool} true if Z1 validates as Z18
 */
function isArgumentReference(Z1) {
    return Z18Validator.validate(Z1) && !Z9Validator.validate(Z1);
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
 * Determines whether a pair contains an error.
 *
 * @param {Object} pair a Z22
 * @return {bool} true if Z22K2 is a Z5; false otherwise
 */
function containsError(pair) {
    return isError(pair.Z22K2);
}

/**
 * Determines whether a pair contains an error Z23.
 *
 * @param {Object} pair a Z22
 * @return {bool} true if Z22K2 is not the Unit; false otherwise
 */
function containsValue(pair) {
    return isZObject(pair.Z22K1) && !(isNothing(pair.Z22K1));
}

// TODO: T282891
function Z23(canonical = false) {
    if (canonical) {
        return 'Z23';
    }
	return { Z1K1: 'Z9', Z9K1: 'Z23' };
}

/**
 * Z9 Reference to Z41 (true).
 * TODO: T282891
 *
 * @return {Object} a reference to Z41 (true)
 */
function Z41() {
    return { Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z41' } };
}

/**
 * Z9 Reference to Z42 (false).
 * TODO: T282891
 *
 * @return {Object} a reference to Z42 (false)
 */
function Z42() {
    return { Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z42' } };
}

/**
 * Validates a ZObject against the Function Call schema.
 *
  @param {Object} Z1 object to be validated
 * @return {bool} whether Z1 can validated as a Function Call
 */
function isEvaluableFunctionCall(Z1) {
    return (
        isFunctionCall(Z1) &&
        Z1.Z7K2.Z40K1.Z9K1 === Z41().Z40K1.Z9K1);
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

function makeBoolean(truthy = false, canonical = false) {
    const zobject = {};
    if (canonical) {
        zobject.Z1K1 = 'Z40';
    } else {
        zobject.Z1K1 = {
            Z1K1: 'Z9',
            Z9K1: 'Z40'
        };
    }

    if (truthy) {
        if (canonical) {
            zobject.Z40K1 = 'Z41';
        } else {
            zobject.Z40K1 = {
                Z1K1: 'Z9',
                Z9K1: 'Z41'
            };
        }
    } else {
        if (canonical) {
            zobject.Z40K1 = 'Z42';
        } else {
            zobject.Z40K1 = {
                Z1K1: 'Z9',
                Z9K1: 'Z42'
            };
        }
    }

    return zobject;
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
        return makePair(result, null);
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

module.exports = {
    containsError,
    containsValue,
    createSchema,
    generateError,
    isArgumentReference,
    isError,
    isEvaluableFunctionCall,
    isFunctionCall,
    isNothing,
    isRefOrString,
    isReference,
    makeBoolean,
    makePair,
    maybeNormalize,
    Z23,
    Z41,
    Z42
};
