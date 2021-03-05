'use strict';

const parse = require('./parse.js');
const wellformed = require('./wellformed.js');
const { isFunctionCall, execute } = require('./execute.js');

function orchestrate(str) {
    const zobject = parse(str);
    if (isFunctionCall(zobject)) {
        return execute(zobject);
    } else {
        return wellformed(zobject);
    }
}

module.exports = orchestrate;
