'use strict';

const { canonicalError, error } = require('../function-schemata/javascript/src/error');
const { createImplementation } = require('./implementation.js');
const { makePair } = require('./utils.js');

/**
 * Accepts a function call, retrieves the appropriate implementation, and tries
 * to execute with supplied arguments.
 *
 * @param {Object} zobject object describing a function call
 * @param {string} evaluatorUri
 * @return {Object} result of executing function call
 */
function execute(zobject, evaluatorUri) {

    // Retrieve the built-in function by its ZID.
    const ZID = zobject.Z7K1.Z8K5.Z9K1;
    const implementation = createImplementation(ZID, 'FUNCTION', evaluatorUri);
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
