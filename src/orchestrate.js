'use strict';

const parse = require('./parse.js');
const canonicalize = require('../function-schemata/javascript/src/canonicalize.js');
const { arrayToZ10 } = require('../function-schemata/javascript/src/utils.js');
const { validate, isFunctionCall } = require('./validation.js');
const { execute } = require('./execute.js');
const { makePair } = require('./utils');
const { normalizePromise } = require('./utils.js');
const { ReferenceResolver } = require('./db.js');

function canonicalizeZObject(zobject) {
    return new Promise((resolve, reject) => {
        try {
            const result = canonicalize(zobject);
            resolve(result);
        } catch (err) {
            resolve(zobject);
        }
    });
}

function orchestrate(str) {

    const orchestrationRequest = parse(str);
    let zobject = orchestrationRequest.zobject;
    if (zobject === undefined) {
       zobject = orchestrationRequest;
    }

    if (zobject.Z1K1 && zobject.Z1K1.Z9K1 && zobject.Z1K1.Z9K1 === 'Z5') {
        return makePair(null, zobject, true);
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

    function validateBound(zObj) {
        return new Promise((resolve, reject) => {
            let errorPromise;
            if (doValidate) {
                errorPromise = validate(zObj, resolver);
            } else {
                errorPromise = Promise.resolve([]);
            }
            errorPromise.then((errors) => {
                if (errors.length > 0) {
                    reject(makePair(null, arrayToZ10(errors)));
                } else {
                    resolve(zObj);
                }
            });
        });
    }

    // In this promise chain, any function that rejects must reject with a
    // pair (Z22); any function that resolves (except execute) must resolve the
    // "good" ZObject that will be processed by the subsequent function. execute
    // also resolves with a Z22. This ensures that the orchestrator always
    // returns a pair containing either
    //
    // Z22K1: the original ZObject OR
    // Z22K1: the result of calling the original ZObject (if a Z7) OR
    // Z22K2: an error.
    const result = normalizePromise(zobject)
        .then((normalized) => {
            return validateBound(normalized);
        })
        .then((dereferenced) => {
            // TODO: Run embedded function calls, not just top-level.
            return isFunctionCall(dereferenced);
        })
        .then((Z7) => {
            return execute(Z7, evaluatorUri, resolver);
        })
        .catch((problem) => {
            // TODO: Why is the problem already a pair some of the time?
            if (problem.Z1K1 === 'Z22' || problem.Z1K1.Z9K1 === 'Z22') {
                return problem;
            }
            return makePair(null, problem, true);
        });

    // Attempt to canonicalize if possible.
    // TODO: Fix canonicalization code in function-schemata to handle mixed forms.
    return result.then((executed) => {
            return new Promise((resolve, reject) => {
                try {
                    const canonicalized = canonicalizeZObject(executed);
                    resolve(canonicalized);
                } catch (error) {
                    resolve(executed);
                }
            });
        });
}

module.exports = orchestrate;
