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

module.exports = utils;
