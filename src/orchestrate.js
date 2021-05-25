'use strict';

const parse = require('./parse.js');
const wellformed = require('./wellformed.js');
const normalize = require('../function-schemata/javascript/src/normalize.js');
const canonicalize = require('../function-schemata/javascript/src/canonicalize.js');
const { arrayToZ10 } = require('../function-schemata/javascript/src/utils.js');
const { validate, isReference, isFunctionCall } = require('./validation.js');
const { execute } = require('./execute.js');
const { resolveReference } = require('./builtins.js');
const { makePair } = require('./utils');

function normalizeZObject(zobject) {
    return new Promise((resolve, reject) => {
        try {
            resolve(normalize(zobject));
        } catch (err) {
            reject(err);
        }
    });
}

function canonicalizeZObject(zobject) {
    return new Promise((resolve, reject) => {
        try {
            resolve(canonicalize(zobject));
        } catch (err) {
            reject(err);
        }
    });
}

function fixRef(zobject) {
    if (isReference(zobject.Z7K1)) {
        const clone = {};
        Object.assign(clone, zobject);
        clone.Z7K1 = resolveReference(clone.Z7K1.Z9K1);
        return clone;
    }
    return zobject;
}

function withReferenceResolved(zobject) {
    return new Promise((resolve, reject) => {
        resolve(fixRef(zobject));
    });
}

function orchestrate(str) {

    const orchestrationRequest = parse(str);
    let zobject = orchestrationRequest.zobject;
    if (zobject === undefined) {
        zobject = orchestrationRequest;
    }

    /*
     * TODO: Receiving the evaluator URI as a parameter (especially a GET
     * param!) is no good. Find a way to share config among services.
     */
    const evaluatorUri = orchestrationRequest.evaluatorUri || null;

    const executeBound = async (zObj) => {
        const errors = await validate(zObj);

        /**
         * TODO: errors should be rejected. For now, they are being returned
         * to avoid the "wellformed" flow.
         */
        return errors.length === 0 ?
            execute(zObj, evaluatorUri) :
            makePair(null, arrayToZ10(errors));
    };

    return normalizeZObject(zobject)
        .then(withReferenceResolved)
        .then(isFunctionCall)
        .then(executeBound)
        .then(canonicalizeZObject)
        .catch(() => wellformed(zobject));
}

module.exports = orchestrate;
