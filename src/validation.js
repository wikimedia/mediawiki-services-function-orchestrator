'use strict';

const { SchemaFactory } = require('../function-schemata/javascript/src/schema.js');

const normalFactory = SchemaFactory.NORMAL();
const Z7Validator = normalFactory.create('Z7');

/**
 * Validates a ZObject against the function call schema.
 *
 * @param {Object} Z1 object to be validated
 * @return {bool} whether Z1 can validate as function call
 */
function isFunctionCall(Z1) {
    return new Promise((resolve, reject) => {
        if (Z7Validator.validate(Z1)) {
            resolve(Z1);
        } else {
            reject();
        }
    });
}

const Z6Validator = normalFactory.create('Z6');
const Z9Validator = normalFactory.create('Z9');

/**
 * Determines whether arguments is a Z6 or Z9. These two types' Z1K1s are
 * strings instead of Z9s, so some checks below need to special-case their
 * logic.
 *
 * @param {Object} Z1 a ZObject
 * @return {bool} true if Z1 validates as either Z6 or Z7
 */
function isRefOrString(Z1) {
    return Z6Validator.validate(Z1) || Z9Validator.validate(Z1);
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

module.exports = { isFunctionCall, isRefOrString, isReference, normalFactory };
