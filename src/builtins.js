'use strict';

const utils = require('../function-schemata/javascript/src/utils');
const normalize = require('../function-schemata/javascript/src/normalize');
const { mutate } = require('./zobject.js');
const { makePair, makeBoolean } = require('./utils.js');
const { normalError, error } = require('../function-schemata/javascript/src/error');

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

function BUILTIN_ECHO_(input) {
    return makePair(input, null);
}

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
        badResult = normalError(
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
            normalError(
                [ error.argument_type_mismatch ],
                [ 'An empty list has no head.' ]));
    }

    return makePair(Z10.Z10K1, null);
}

function BUILTIN_TAIL_(Z10) {
    if (utils.isEmpty(Z10)) {
        return makePair(
            null,
            normalError(
                [ error.argument_type_mismatch ],
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

function BUILTIN_EQUALS_BOOLEAN_(Z40_1, Z40_2) {
    return makePair(
        makeBoolean((Z40_1.Z40K1.Z9K1 === Z40_2.Z40K1.Z9K1)),
        null
    );
}

function BUILTIN_EQUALS_STRING_(Z6_1, Z6_2) {
    return makePair(
        makeBoolean((Z6_1.Z6K1 === Z6_2.Z6K1)),
        null
    );
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

function BUILTIN_EMPTY_VALIDATOR_(Z1) {
    return makePair({
        Z1K1: {
            Z1K1: 'Z9',
            Z9K1: 'Z10'
        }
    }, null);
}

/**
 * Validates the keys of a normal Z10/List. This functions looks for duplicate or non-sequential
 * keys and keys that don't follow the expected format of Z<identity>Kn.
 *
 * @param {Object} Z10 the Z10/List being validated.
 * @param {Function} key a function to get the key of a list element.
 * @param {string} identity the identity of the Z10's parent.
 *
 * @return {Object} a Z10/List of Z5/Error.
 */
function arrayValidator(Z10, key, identity) {
    const keys = utils.Z10ToArray(Z10).map(key);
    const messages = [];

    let previous = 0;
    const seen = new Set();
    for (let i = 0; i < keys.length; ++i) {
        const key = keys[i];
        const expected = `${identity}K${previous + 1}`;

        if (!key.startsWith(identity)) {
            messages.push(`Invalid key at index ${i}: string should start with ${identity}`);
        }

        if (seen.has(key)) {
            messages.push(`Duplicated key at index ${i}: ${key}`);
        }

        if (key !== expected) {
            if (i === 0) {
                messages.push(`Invalid key at index ${i}: ${key} (should be ${identity}K1)`);
            } else {
                messages.push(`Non-sequential key at index ${i}: ${key}`);
            }
        }

        seen.add(key);
        previous = Number(utils.kid_from_global_key(key).replace('K', ''));
    }

    return makePair(
        utils.arrayToZ10(
            messages.map((message) =>
                normalError([error.array_element_not_well_formed], [message])
            )
        ), null);
}

function BUILTIN_FUNCTION_VALIDATOR_(Z1) {
    return arrayValidator(
        Z1.Z8K1,
        (x) => x.Z17K2.Z6K1,
        Z1.Z8K5.Z9K1
    );
}

function BUILTIN_Z4_TYPE_VALIDATOR_(Z1) {
    const errors = utils.Z10ToArray(
        arrayValidator(
            Z1.Z4K2,
            (x) => x.Z3K2.Z6K1,
            Z1.Z4K1.Z9K1
        )
    );

    if (Z1.Z4K3.Z8K2.Z9K1 !== 'Z10') {
        errors.push(
            normalError(
                [error.not_wellformed],
                ['Invalid return type for validator: should be Z10']
            )
        );
    }

    return makePair(utils.arrayToZ10(errors), null);
}

async function BUILTIN_FUNCTION_CALL_VALIDATOR_(Z1, resolver) {
    const argumentTypes = {};
    const errors = [];

    await mutate(Z1, [ 'Z7K1', 'Z8K1' ], resolver);
    const Z8K1 = Z1.Z7K1.Z8K1;
    for (const arg of utils.Z10ToArray(Z8K1)) {
        argumentTypes[arg.Z17K2.Z6K1] = arg.Z17K1.Z9K1;
    }

    for (const key of Object.keys(Z1)) {
        if (key === 'Z1K1' || key === 'Z7K1') {
            continue;
        }

        const type = Z1[key].Z1K1.Z9K1 || Z1[key].Z1K1;

        if (argumentTypes[key] === undefined) {
            errors.push(
                normalError(
                    [error.invalid_key],
                    [`Invalid key for function call: ${key}`]
                )
            );
        // if an argument type, it's not validated because every other type is Z1
        } else if (argumentTypes[key] !== type && argumentTypes[key] !== 'Z1') {
            errors.push(
                normalError(
                    [error.argument_type_mismatch],
                    [`Invalid argument type: expected ${argumentTypes[key]}, got ${type}`]
                )
            );
        }
    }

    return makePair(utils.arrayToZ10(errors), null);
}

function BUILTIN_MULTILINGUAL_TEXT_VALIDATOR_(Z1) {
    const errors = [];
    const Z11s = utils.Z10ToArray(Z1.Z12K1);
    const languages = Z11s.map((Z11) => Z11.Z11K1.Z60K1.Z6K1);

    const seen = new Set();
    for (let i = 0; i < languages.length; ++i) {
        if (seen.has(languages[i])) {
            errors.push(
                normalError(
                    [error.array_element_not_well_formed],
                    [`Duplicate Z11K1/language element in Z12/Multilingual text: '${languages[i]}'`]
                )
            );
        }

        seen.add(languages[i]);
    }

    return makePair(utils.arrayToZ10(errors), null);
}

function BUILTIN_MULTILINGUAL_STRINGSET_VALIDATOR_(Z1) {
    const errors = [];
    const Z31s = utils.Z10ToArray(Z1.Z32K1);
    const languages = Z31s.map((Z31) => Z31.Z31K1.Z60K1.Z6K1);

    const seen = new Set();
    for (let i = 0; i < languages.length; ++i) {
        if (seen.has(languages[i])) {
            errors.push(
                normalError(
                    [error.array_element_not_well_formed],
                    [`Duplicate Z31K1/language element in Z32/Multilingual stringset: '${languages[i]}'`]
                )
            );
        }

        seen.add(languages[i]);
    }

    return makePair(utils.arrayToZ10(errors), null);
}

function BUILTIN_ERROR_TYPE_VALIDATOR_(Z1) {
    return arrayValidator(
        Z1.Z50K1,
        (x) => x.Z3K2.Z6K1,
        Z1.Z8K5.Z9K1
    );
}

const builtinFunctions = new Map();

builtinFunctions.set('Z901', BUILTIN_ECHO_);
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
builtinFunctions.set('Z944', BUILTIN_EQUALS_BOOLEAN_);
builtinFunctions.set('Z966', BUILTIN_EQUALS_STRING_);
builtinFunctions.set('Z968', BUILTIN_STRING_TO_CHARS_);
builtinFunctions.set('Z986', BUILTIN_CHARS_TO_STRING_);
builtinFunctions.set('Z988', BUILTIN_SAME_);
builtinFunctions.set('Z999', BUILTIN_UNQUOTE_);

// validators
builtinFunctions.set('Z201', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z202', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z203', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z204', BUILTIN_Z4_TYPE_VALIDATOR_);
builtinFunctions.set('Z205', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z206', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z207', BUILTIN_FUNCTION_CALL_VALIDATOR_);
builtinFunctions.set('Z208', BUILTIN_FUNCTION_VALIDATOR_);
builtinFunctions.set('Z209', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z210', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z211', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z212', BUILTIN_MULTILINGUAL_TEXT_VALIDATOR_);
builtinFunctions.set('Z213', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z214', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z216', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z217', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z218', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z220', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z221', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z222', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z223', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z231', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z232', BUILTIN_MULTILINGUAL_STRINGSET_VALIDATOR_);
builtinFunctions.set('Z239', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z240', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z241', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z242', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z250', BUILTIN_ERROR_TYPE_VALIDATOR_);
builtinFunctions.set('Z260', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z261', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z270', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z280', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z286', BUILTIN_EMPTY_VALIDATOR_);
builtinFunctions.set('Z299', BUILTIN_EMPTY_VALIDATOR_);

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
 * @param {string} identity the function identity
 * @param {Array} argumentList list of Z17s
 * @param {string} returnType ZID of return type
 * @param {string} builtinName ZID reference to builtin implementation
 * @return {Object} a Z8
 */
function createZ8(identity, argumentList, returnType, builtinName) {
    return normalize({
        Z1K1: 'Z8',
        Z8K1: argumentList,
        Z8K2: returnType,
        Z8K3: [],
        Z8K4: [{
            Z1K1: 'Z14',
            Z14K1: identity,
            Z14K4: {
                Z1K1: 'Z6',
                Z6K1: builtinName
            }
        }],
        Z8K5: identity
    });
}

const builtinReferences = new Map();
builtinReferences.set('Z801', createZ8(
    'Z801',
    [
        createArgument('Z1', 'Z801K1')
    ], 'Z1', 'Z901'));

builtinReferences.set('Z802', createZ8(
    'Z802',
    [
        createArgument('Z40', 'Z802K1'),
        createArgument('Z1', 'Z802K2'),
        createArgument('Z1', 'Z802K3')
    ], 'Z1', 'Z902'
));
builtinReferences.set('Z803', createZ8(
    'Z803',
    [
        createArgument('Z39', 'Z803K1'),
        createArgument('Z1', 'Z803K2')
    ], 'Z1', 'Z903'
));
builtinReferences.set('Z805', createZ8(
    'Z805',
    [
        createArgument('Z1', 'Z805K1')
    ], 'Z1', 'Z905'
));
builtinReferences.set('Z808', createZ8(
    'Z808',
    [
        createArgument('Z1', 'Z808K1')
    ], 'Z1', 'Z908'
));
builtinReferences.set('Z810', createZ8(
    'Z810',
    [
        createArgument('Z1', 'Z810K1'),
        createArgument('Z10', 'Z810K2')
    ], 'Z1', 'Z910'
));
builtinReferences.set('Z811', createZ8(
    'Z811',
    [
        createArgument('Z10', 'Z811K1')
    ], 'Z1', 'Z911'
));
builtinReferences.set('Z812', createZ8(
    'Z812',
    [
        createArgument('Z10', 'Z812K1')
    ], 'Z1', 'Z912'
));
builtinReferences.set('Z813', createZ8(
    'Z813',
    [
        createArgument('Z10', 'Z813K1')
    ], 'Z1', 'Z913'
));
builtinReferences.set('Z821', createZ8(
    'Z821',
    [
        createArgument('Z22', 'Z821K1')
    ], 'Z1', 'Z921'
));
builtinReferences.set('Z822', createZ8(
    'Z822',
    [
        createArgument('Z22', 'Z822K1')
    ], 'Z1', 'Z922'
));
builtinReferences.set('Z844', createZ8(
    'Z844',
    [
        createArgument('Z1', 'Z844K1'),
        createArgument('Z1', 'Z844K2')
    ], 'Z1', 'Z944'
));
builtinReferences.set('Z866', createZ8(
    'Z866',
    [
        createArgument('Z1', 'Z866K1'),
        createArgument('Z1', 'Z866K2')
    ], 'Z1', 'Z966'
));
builtinReferences.set('Z868', createZ8(
    'Z868',
    [
        createArgument('Z6', 'Z868K1')
    ], 'Z1', 'Z968'
));
builtinReferences.set('Z886', createZ8(
    'Z886',
    [
        createArgument('Z10', 'Z886K1')
    ], 'Z1', 'Z986'
));
builtinReferences.set('Z888', createZ8(
    'Z888',
    [
        createArgument('Z86', 'Z888K1'),
        createArgument('Z86', 'Z888K2')
    ], 'Z1', 'Z988'
));
builtinReferences.set('Z899', createZ8(
    'Z899',
    [
        createArgument('Z99', 'Z899K1')
    ], 'Z1', 'Z999'
));

(function setValidatorsReferences() {
    const CORE_TYPES = [
        'Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7', 'Z8', 'Z9', 'Z10', 'Z11', 'Z12', 'Z13', 'Z14', 'Z16', 'Z17', 'Z18',
        'Z20', 'Z21', 'Z22', 'Z23', 'Z39', 'Z40', 'Z41', 'Z42', 'Z50', 'Z60', 'Z61', 'Z70', 'Z80', 'Z86', 'Z99'
    ];

    CORE_TYPES
        .map((zid) => Number(zid.replace('Z', '')))
        .forEach((id) => {
            builtinReferences.set(`Z${id + 100}`, createZ8(
                `Z${id + 100}`,
                [createArgument('Z1', `Z${id + 100}K1`)],
                'Z10',
                `Z${id + 200}`
            ));
        });
}());

/**
 * Creates a Z8 corresponding to a bulitin function.
 *
 * @param {string} ZID reference to a builtin function
 * @return {Object} a Z8 or null
 */
function resolveBuiltinReference(ZID) {
    // TODO: Resolve all terminal references (especially Z40), NOT just Z7K1.
    const result = builtinReferences.get(ZID);
    if (result === undefined) {
        return null;
    }
    return result;
}

module.exports = { getFunction, resolveBuiltinReference };
