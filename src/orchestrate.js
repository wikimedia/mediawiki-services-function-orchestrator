'use strict';

const parse = require('./parse.js');
const wellformed = require('./wellformed.js');

function orchestrate(str) {
  return wellformed(parse(str));
}

module.exports = orchestrate;
