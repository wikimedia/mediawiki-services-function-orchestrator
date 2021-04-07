'use strict';

const { canonicalError, error } = require('../function-schemata/javascript/src/error');
const utils = require('../function-schemata/javascript/src/utils');

/**
 * HELPER FUNCTIONS
 */

/**
 * Z9 Reference to Z41 (true).
 *
 * @return {Object} a reference to Z41 (true)
 */
function BUILTIN_TRUE_() {
    return { Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z6', Z6K1: 'Z41' } };
}

/**
 * Z9 Reference to Z42 (false).
 *
 * @return {Object} a reference to Z42 (false)
 */
function BUILTIN_FALSE_() {
    return { Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z6', Z6K1: 'Z42' } };
}

/**
 * Returns true iff the input is equivalent to the builtin true value.
 *
 * @param {Object} Z40 A Z40
 * @return {bool} whether Z40 corresponds to Z41 (true) or not
 */
function isTrue(Z40) {
    return Z40.Z40K1.Z6K1 === BUILTIN_TRUE_().Z40K1.Z6K1;
}

/**
 * BUILTINS
 */

function BUILTIN_IF_(antecedent, trueConsequent, falseConsequent) {
    if (isTrue(antecedent)) {
        return trueConsequent;
    }
    return falseConsequent;
}

function BUILTIN_VALUE_BY_KEY_(Z39, Z1) {
    // TODO: Add test for error case.
    const key = Z39.Z39K1.Z6K1;
    if (Z1[key] === undefined) {
        return canonicalError(
            [ error.error_in_evaluation ],
            [ 'Object did not contain key "' + key + '"' ]);
    }
    return Z1[key];
}

function reifyRecursive(Z1) {
    if (typeof Z1 === 'string') {
        return {
            Z1K1: 'Z6',
            Z6K1: Z1
        };
    }
    const result = [];
    for (const key of Object.keys(Z1)) {
        const value = reifyRecursive(Z1[key]);
        result.push({
            Z1K1: {
                Z1K1: 'Z9',
                Z9K1: 'Z22'
            },
            Z22K1: {
                Z1K1: {
                    Z1K1: 'Z9',
                    Z9K1: 'Z39'
                },
                Z39K1: {
                    Z1K1: 'Z6',
                    Z6K1: key
                }
            },
            Z22K2: value
        });
    }
    return utils.arrayToZ10(result);
}

function BUILTIN_REIFY_(Z1) {
    return reifyRecursive(Z1);
}

function abstractRecursive(Z10) {
    if (Z10.Z1K1 === 'Z6') {
        return Z10.Z6K1;
    }
    const result = {};
    const arrayOfZ22 = utils.Z10ToArray(Z10);
    for (const Z22 of arrayOfZ22) {
        const Z39 = Z22.Z22K1;
        result[Z39.Z39K1.Z6K1] = abstractRecursive(Z22.Z22K2);
    }
    return result;
}

function BUILTIN_ABSTRACT_(Z10) {
    // TODO: Validate that List is a reified list, i.e. that all elements
    // are Z22s.
    return abstractRecursive(Z10);
}

function BUILTIN_CONS_(Z1, Z10) {
    const result = utils.arrayToZ10([Z1]);
    result.Z10K2 = Z10;
    return result;
}

function BUILTIN_HEAD_(Z10) {
    if (utils.isEmpty(Z10)) {
        return canonicalError(
            [ error.argument_type_error ],
            [ 'An empty list has no head.' ]);
    }

    return Z10.Z10K1;
}

function BUILTIN_TAIL_(Z10) {
    if (utils.isEmpty(Z10)) {
        return canonicalError(
            [ error.argument_type_error ],
            [ 'An empty list has no tail.' ]);
    }

    return Z10.Z10K2;
}

function BUILTIN_EMPTY_(Z10) {
    if (utils.isEmpty(Z10)) {
        return BUILTIN_TRUE_();
    }
    return BUILTIN_FALSE_();
}

function BUILTIN_FIRST_(Z22) {
    return Z22.Z22K1;
}

function BUILTIN_SECOND_(Z22) {
    return Z22.Z22K2;
}

function stringToCharsInternal(characterArray) {
    const Z86Array = [];
    for (const character of characterArray) {
        Z86Array.push({
            Z1K1: { Z1K1: 'Z9', Z9K1: 'Z86' },
            Z86K1: { Z1K1: 'Z6', Z6K1: character }
        });
    }
    return utils.arrayToZ10(Z86Array);
}

function BUILTIN_STRING_TO_CHARS_(Z6) {
    return stringToCharsInternal(Z6.Z6K1.split(''));
}

function charsToStringInternal(Z10) {
    const Z10Array = utils.Z10ToArray(Z10);
    const result = [];
    for (const Z86 of Z10Array) {
        result.push(Z86.Z86K1.Z6K1);
    }
    return result;
}

function BUILTIN_CHARS_TO_STRING_(Z10) {
    // TODO: Validate all members of Z10 are Z86.
    return {
        Z1K1: 'Z6',
        Z6K1: charsToStringInternal(Z10).join('')
    };
}

function BUILTIN_SAME_(Z86_1, Z86_2) {
    if (Z86_1.Z86K1.Z6K1 === Z86_2.Z86K1.Z6K1) {
        return BUILTIN_TRUE_();
    }
    return BUILTIN_FALSE_();
}

function BUILTIN_UNQUOTE_(Z99) {
    return Z99.Z99K1;
}

const builtinFunctions = new Map();
builtinFunctions.set('Z902', BUILTIN_IF_);
builtinFunctions.set('Z903', BUILTIN_VALUE_BY_KEY_);
builtinFunctions.set('Z905', BUILTIN_REIFY_);
builtinFunctions.set('Z908', BUILTIN_ABSTRACT_);
builtinFunctions.set('Z910', BUILTIN_CONS_);
builtinFunctions.set('Z911', BUILTIN_HEAD_);
builtinFunctions.set('Z912', BUILTIN_TAIL_);
builtinFunctions.set('Z913', BUILTIN_EMPTY_);
builtinFunctions.set('Z921', BUILTIN_FIRST_);
builtinFunctions.set('Z922', BUILTIN_SECOND_);
builtinFunctions.set('Z968', BUILTIN_STRING_TO_CHARS_);
builtinFunctions.set('Z986', BUILTIN_CHARS_TO_STRING_);
builtinFunctions.set('Z988', BUILTIN_SAME_);
builtinFunctions.set('Z999', BUILTIN_UNQUOTE_);

/**
 * Retrieves an in-memory JS function implementing a builtin.
 *
 * @param {Object} ZID the function to retrieve an implementation for
 * @return {Implementation} an implementation
 */
function getFunction(ZID) {
    const result = builtinFunctions.get(ZID);
    if (result === undefined) {
        return null;
    }
    return result;
}

module.exports = { getFunction };
