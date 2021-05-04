'use strict';

const parse = require('./parse.js');
const wellformed = require('./wellformed.js');
const normalize = require('../function-schemata/javascript/src/normalize.js');
const { isFunctionCall, execute } = require('./execute.js');

function normalizeZObject(zobject) {
    return new Promise((resolve, reject) => {
        try {
            resolve(normalize(zobject));
        } catch (err) {
            reject();
        }
    });
}

function orchestrate(str) {
    const zobject = parse(str);

    return normalizeZObject(zobject)
        .then(isFunctionCall)
        .then(execute)
        .catch(() => wellformed(zobject));
}

module.exports = orchestrate;
