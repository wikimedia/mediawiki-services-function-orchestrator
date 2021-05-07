'use strict';

const parse = require('./parse.js');
const wellformed = require('./wellformed.js');
const normalize = require('../function-schemata/javascript/src/normalize.js');
const { isReference, isFunctionCall } = require('./validation.js');
const { execute } = require('./execute.js');
const { resolveReference } = require('./builtins.js');

function normalizeZObject(zobject) {
    return new Promise((resolve, reject) => {
        try {
            resolve(normalize(zobject));
        } catch (err) {
            reject();
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
    const zobject = parse(str);

    return normalizeZObject(zobject)
        .then(withReferenceResolved)
        .then(isFunctionCall)
        .then(execute)
        .catch(() => wellformed(zobject));
}

module.exports = orchestrate;
