'use strict';

const { canonicalError, error } = require('../function-schemata/javascript/src/error');
const { Z10ToArray } = require('../function-schemata/javascript/src/utils');
const { createImplementation } = require('./implementation.js');
const { makePair } = require('./utils.js');
const { mutate } = require('./zobject.js');

/**
 * Accepts a function call, retrieves the appropriate implementation, and tries
 * to execute with supplied arguments.
 *
 * @param {Object} zobject object describing a function call
 * @param {string} evaluatorUri
 * @param {ReferenceResolver} resolver
 * @return {Object} result of executing function call
 */
async function execute(zobject, evaluatorUri, resolver) {
    await mutate(zobject, [ 'Z7K1', 'Z8K4' ], resolver);
    let implementations;
    if (zobject.Z7K1.Z8K4 !== undefined) {
        implementations = Z10ToArray(zobject.Z7K1.Z8K4);
    } else {
        implementations = [];
    }
    const builtin = implementations.find((impl) => Boolean(impl.Z14K4));

    // Retrieve the built-in function by its ZID.
    let ZID;
    if (builtin !== undefined) {
        ZID = builtin.Z14K4.Z6K1;
    } else {
        // Ensure that required references are resolved before sending to evaluator.
        await mutate(zobject, [ 'Z7K1', 'Z8K4', 'Z10K1', 'Z14K3', 'Z16K2', 'Z6K1' ], resolver);
        ZID = zobject.Z7K1.Z8K5.Z9K1;
    }

    const implementation = createImplementation(ZID, 'FUNCTION', evaluatorUri, resolver);
    if (implementation === null) {
        return makePair(
            null,
            canonicalError(
                [error.not_wellformed],
                ['Could not execute non-builtin function ' + ZID]));
    }

    return implementation.execute(zobject);
}

module.exports = { execute };
