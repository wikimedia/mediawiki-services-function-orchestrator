'use strict';

const { canonicalError, error } = require('../function-schemata/javascript/src/error');
const normalize = require('../function-schemata/javascript/src/normalize');
const utils = require('../function-schemata/javascript/src/utils');
const { makePair } = require('./utils.js');

/**
 * HELPER FUNCTIONS
 */

/**
 * Z9 Reference to Z41 (true).
 *
 * @return {Object} a reference to Z41 (true)
 */
function BUILTIN_TRUE_() {
    return { Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z41' } };
}

/**
 * Z9 Reference to Z42 (false).
 *
 * @return {Object} a reference to Z42 (false)
 */
function BUILTIN_FALSE_() {
    return { Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z42' } };
}

/**
 * Returns true iff the input is equivalent to the builtin true value.
 *
 * @param {Object} Z40 A Z40
 * @return {bool} whether Z40 corresponds to Z41 (true) or not
 */
function isTrue(Z40) {
    return Z40.Z40K1.Z9K1 === BUILTIN_TRUE_().Z40K1.Z9K1;
}

/**
 * BUILTINS
 */

function BUILTIN_IF_(antecedent, trueConsequent, falseConsequent) {
    let result;
    if (isTrue(antecedent)) {
        result = trueConsequent;
    } else {
        result = falseConsequent;
    }
    return makePair(result, null);
}

function BUILTIN_VALUE_BY_KEY_(Z39, Z1) {
    // TODO: Add test for error case.
    let goodResult = null, badResult = null;
    const key = Z39.Z39K1.Z6K1;
    if (Z1[key] === undefined) {
        badResult = canonicalError(
            [ error.error_in_evaluation ],
            [ 'Object did not contain key "' + key + '"' ]);
    } else {
        goodResult = Z1[key];
    }
    return makePair(goodResult, badResult);
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
    return makePair(reifyRecursive(Z1), null);
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
    return makePair(abstractRecursive(Z10), null);
}

function BUILTIN_CONS_(Z1, Z10) {
    const result = utils.arrayToZ10([Z1]);
    result.Z10K2 = Z10;
    return makePair(result, null);
}

function BUILTIN_HEAD_(Z10) {
    if (utils.isEmpty(Z10)) {
        return makePair(
            null,
            canonicalError(
                [ error.argument_type_error ],
                [ 'An empty list has no head.' ]));
    }

    return makePair(Z10.Z10K1, null);
}

function BUILTIN_TAIL_(Z10) {
    if (utils.isEmpty(Z10)) {
        return makePair(
            null,
            canonicalError(
                [ error.argument_type_error ],
                [ 'An empty list has no tail.' ]));
    }

    return makePair(Z10.Z10K2, null);
}

function BUILTIN_EMPTY_(Z10) {
    let result;
    if (utils.isEmpty(Z10)) {
        result = BUILTIN_TRUE_();
    } else {
        result = BUILTIN_FALSE_();
    }
    return makePair(result, null);
}

function BUILTIN_FIRST_(Z22) {
    return makePair(Z22.Z22K1, null);
}

function BUILTIN_SECOND_(Z22) {
    return makePair(Z22.Z22K2, null);
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
    return makePair(stringToCharsInternal(Z6.Z6K1.split('')), null);
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
    return makePair(
        {
            Z1K1: 'Z6',
            Z6K1: charsToStringInternal(Z10).join('')
        },
        null
    );
}

function BUILTIN_SAME_(Z86_1, Z86_2) {
    let result;
    if (Z86_1.Z86K1.Z6K1 === Z86_2.Z86K1.Z6K1) {
        result = BUILTIN_TRUE_();
    } else {
        result = BUILTIN_FALSE_();
    }
    return makePair(result, null);
}

function BUILTIN_UNQUOTE_(Z99) {
    return makePair(Z99.Z99K1, null);
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

/**
 * Creates a Z17.
 *
 * @param {string} ZType type of argument (Z17K1)
 * @param {string} argumentName identifier used when calling (Z17K2)
 * @return {Object} a Z17
 */
function createArgument(ZType, argumentName) {
    return {
        Z1K1: 'Z17',
        Z17K1: ZType,
        Z17K2: {
            Z1K1: 'Z6',
            Z6K1: argumentName
        },
        Z17K3: {
            Z1K1: 'Z12',
            Z12K1: {
                Z1K1: 'Z10'
            }
        }
    };
}

/**
 * Creates a Z8 corresponding to a bulitin function.
 *
 * @param {Array} argumentList list of Z17s
 * @param {string} returnType ZID of return type
 * @param {string} builtinName ZID reference to builtin implementation
 * @return {Object} a Z8
 */
function createZ8(argumentList, returnType, builtinName) {
    return normalize({
        Z1K1: 'Z8',
        Z8K1: argumentList,
        Z8K2: returnType,
        Z8K3: [],
        Z8K5: builtinName
    });
}

const builtinReferences = new Map();
builtinReferences.set('Z802', createZ8(
    [
        createArgument('Z40', 'Z802K1'),
        createArgument('Z1', 'Z802K2'),
        createArgument('Z1', 'Z802K3')
    ], 'Z1', 'Z902'
));
builtinReferences.set('Z803', createZ8(
    [
        createArgument('Z39', 'Z803K1'),
        createArgument('Z1', 'Z803K2')
    ], 'Z1', 'Z903'
));
builtinReferences.set('Z805', createZ8(
    [
        createArgument('Z1', 'Z805K1')
    ], 'Z1', 'Z905'
));
builtinReferences.set('Z808', createZ8(
    [
        createArgument('Z1', 'Z808K1')
    ], 'Z1', 'Z908'
));
builtinReferences.set('Z810', createZ8(
    [
        createArgument('Z1', 'Z810K1'),
        createArgument('Z10', 'Z810K2')
    ], 'Z1', 'Z910'
));
builtinReferences.set('Z811', createZ8(
    [
        createArgument('Z10', 'Z811K1')
    ], 'Z1', 'Z911'
));
builtinReferences.set('Z812', createZ8(
    [
        createArgument('Z10', 'Z812K1')
    ], 'Z1', 'Z912'
));
builtinReferences.set('Z813', createZ8(
    [
        createArgument('Z10', 'Z813K1')
    ], 'Z1', 'Z913'
));
builtinReferences.set('Z821', createZ8(
    [
        createArgument('Z22', 'Z821K1')
    ], 'Z1', 'Z921'
));
builtinReferences.set('Z822', createZ8(
    [
        createArgument('Z22', 'Z822K1')
    ], 'Z1', 'Z922'
));
builtinReferences.set('Z868', createZ8(
    [
        createArgument('Z6', 'Z868K1')
    ], 'Z1', 'Z968'
));
builtinReferences.set('Z886', createZ8(
    [
        createArgument('Z10', 'Z886K1')
    ], 'Z1', 'Z986'
));
builtinReferences.set('Z888', createZ8(
    [
        createArgument('Z86', 'Z888K1'),
        createArgument('Z86', 'Z888K2')
    ], 'Z1', 'Z988'
));
builtinReferences.set('Z899', createZ8(
    [
        createArgument('Z99', 'Z899K1')
    ], 'Z1', 'Z999'
));

/**
 * Creates a Z8 corresponding to a bulitin function.
 *
 * @param {string} ZID reference to a builtin function
 * @return {Object} a Z8
 */
function resolveReference(ZID) {
    // TODO: Resolve all terminal references (especially Z40), NOT just Z7K1.
    const result = builtinReferences.get(ZID);
    if (result === undefined) {
        throw Error('Not contained in builtinReferences');
    }
    return result;
}

module.exports = { getFunction, resolveReference };
