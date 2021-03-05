'use strict';

const utils = {};

utils.is_string = function (s) {
	return typeof s === 'string' || s instanceof String;
};

utils.is_array = function (a) {
	return Array.isArray(a);
};

utils.is_object = function (o) {
	return !utils.is_array(o) && typeof o === 'object' && o !== null;
};

utils.is_key = function (k) {
	return k.match(/^(Z[1-9]\d*)?K[1-9]\d*$/) !== null;
};

utils.is_zid = function (k) {
	return k.match(/^Z[1-9]\d*$/) !== null;
};

utils.is_reference = function (z) {
	return z.match(/^[A-Z][1-9]\d*$/) !== null;
};

utils.is_global_key = function (k) {
	return k.match(/^Z[1-9]\d*K[1-9]\d*$/) !== null;
};

utils.kid_from_global_key = function (k) {
	return k.match(/^Z[1-9]\d*(K[1-9]\d*)$/)[ 1 ];
};

utils.deep_equal = function (o1, o2) {
	return JSON.stringify(o1) === JSON.stringify(o2);
};

utils.deep_copy = function (o) {
	return JSON.parse(JSON.stringify(o));
};

// TODO: Make these static class methods or export all methods separately.

/**
 * Determines whether an already-validated Z10 is empty. Because the Z10 has
 * already been validated, it is sufficient to check for the presence of Z10K1.
 *
 * @param {Object} Z10 a Z10 List
 * @return {bool} whether Z10 is empty
 */
utils.isEmpty = function (Z10) {
    return Z10.Z10K1 === undefined;
};

/**
 * Turns a JS array into a Z10.
 *
 * @param {Object} Z10 a Z10 list
 * @return {Array} an array consisting of all Z10K1s in the Z10
 */
utils.Z10ToArray = function (Z10) {
    if (utils.isEmpty(Z10)) {
        return [];
    }
    return [Z10.Z10K1].concat(utils.Z10ToArray(Z10.Z10K2));
};

/**
 * Turns a Z10 into a JS array for ease of iteration.
 *
 * @param {Array} array an array of ZObjects
 * @return {Object} a Z10 List corresponding to the input array
 */
utils.arrayToZ10 = function (array) {
    const length = array.length;
    if (length <= 0) {
        return { Z1K1: { Z1K1: 'Z9', Z9K1: 'Z10' } };
    }
    return {
        Z1K1: {
            Z1K1: 'Z9',
            Z9K1: 'Z10'
        },
        Z10K1: array[0],
        Z10K2: utils.arrayToZ10(array.slice(1, length))
    };
};

module.exports = utils;
