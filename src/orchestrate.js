'use strict';

// TODO: Replace this function. Delete parse.js. Delete utils.js:generateError.
const parse = require('./parse.js');
const canonicalize = require('../function-schemata/javascript/src/canonicalize.js');
const { arrayToZ10 } = require('../function-schemata/javascript/src/utils.js');
const { error, normalError } = require('../function-schemata/javascript/src/error');
const { validate } = require('./validation.js');
const { execute } = require('./execute.js');
const { containsError, isError, isFunctionCall, isNothing, makePair, maybeNormalize, Z41 } = require('./utils.js');
const { ReferenceResolver } = require('./db.js');

/**
 * Decides whether to validate a function. Returns the pair
 * <original ZObject, Unit> if validation succeeds; otherwise returns the pair
 * <Unit, Z5>.
 *
 * @param {Object} zobject
 * @param {boolean} doValidate whether to run validation; succeeds trivially if false
 * @param {ReferenceResolver} resolver for resolving Z9s
 * @return {Object} a Z22
 */
async function maybeValidate(zobject, doValidate, resolver) {
    if (doValidate) {
        const errors = await validate(zobject, resolver);
        if (errors.length > 0) {
            // TODO: Wrap errors in a Z5.
            return makePair(null, arrayToZ10(errors));
        }
    }
    return makePair(zobject, null);
}

/**
 * Returns the pair <original ZObject, Unit> if the input object is a Z7;
 * otherwise returns the pair <Unit, Z5>.
 *
 * @param {Object} zobject
 * @return {Object} a Z22 as described above
 */
async function Z7OrError(zobject) {
    if (isFunctionCall(zobject)) {
        zobject.Z7K2 = Z41();
        return makePair(zobject, null);
    }
    return makePair(
        null,
        normalError(
            [ error.wrong_content_type ],
            [ 'The provided object is not a function call' ]
        )
    );
}

/**
 * Main orchestration workflow. Executes an input Z7 and returns either the
 * results of function evaluation or the relevant error(s).
 *
 * @param {string} str a string containing the JSON-serialized ZObject and other parameters
 * @return {Object} a Z22 containing the result of function evaluation or a Z5
 */
async function orchestrate(str) {

    const orchestrationRequest = parse(str);
    let zobject = orchestrationRequest.zobject;
    if (zobject === undefined) {
       zobject = orchestrationRequest;
    }

    let currentPair;

    if (isError(zobject)) {
        currentPair = makePair(null, zobject, /* canonicalize= */true);
    } else {
        currentPair = makePair(zobject, null, /* canonicalize= */true);
    }

    /*
     * TODO: Receiving the evaluator and wiki URIs as parameters (especially a
     * GET param!) is no good. Find a way to share config among services.
     */
    const evaluatorUri = orchestrationRequest.evaluatorUri || null;
    const wikiUri = orchestrationRequest.wikiUri || null;
    const resolver = new ReferenceResolver(wikiUri);
    // TODO: Default to true; add switch in tests to override default in CI.
    const doValidate = orchestrationRequest.doValidate || false;

    const callTuples = [
        [maybeNormalize, [], 'maybeNormalize'],
        // TODO: Dereference top-level object if it is a Z9?
        [Z7OrError, [], 'Z7OrError'],
        [maybeValidate, [doValidate, resolver], 'maybeValidate'],
        [execute, [evaluatorUri, resolver], 'execute']
    ];

    for (const callTuple of callTuples) {
        // TODO(T287986): isNothing check is redundant once validation returns
        // correct type.
        if (containsError(currentPair) || isNothing(currentPair.Z22K1)) {
            break;
        }
        console.log('calling function', callTuple[2], 'on currentPair:', currentPair);
        const callable = callTuple[0];
        const args = callTuple[1];
        const zobject = currentPair.Z22K1;
        currentPair = await callable(...[zobject, ...args]);
    }

    try {
        return await canonicalize(currentPair);
    } catch (err) {
        // If canonicalization fails, return normalized form instead.
        console.log('Could not canonicalize; outputting in normal form.');
        return currentPair;
    }
}

module.exports = orchestrate;
