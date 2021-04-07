'use strict';

const utils = require('../function-schemata/javascript/src/utils');
const { canonicalError, error } = require('../function-schemata/javascript/src/error');
const { createImplementation } = require('./implementation.js');
const { SchemaFactory } = require('../function-schemata/javascript/src/schema.js');

const normalFactory = SchemaFactory.NORMAL();
const Z7Validator = normalFactory.create('Z7');

/**
 * Validates a ZObject against the function call schema.
 *
 * @param {Object} Z1 object to be validated
 * @return {bool} whether Z1 can validate as function call
 */
function isFunctionCall(Z1) {
    return Z7Validator.validate(Z1);
}

const Z6Validator = normalFactory.create('Z6');
const Z9Validator = normalFactory.create('Z9');

/**
 * Determines whether arguments is a Z6 or Z9. These two types' Z1K1s are
 * strings instead of Z9s, so some checks below need to special-case their
 * logic.
 *
 * @param {Object} Z1 a ZObject
 * @return {bool} true if Z1 validates as either Z6 or Z7
 */
function isRefOrString(Z1) {
    return Z6Validator.validate(Z1) || Z9Validator.validate(Z1);
}

/**
 * Accepts a function call, retrieves the appropriate implementation, and tries
 * to execute with supplied arguments.
 *
 * @param {Object} zobject object describing a function call
 * @return {Object} result of executing function call
 */
function execute(zobject) {
    // Retrieve the built-in function by its ZID.
    const ZID = zobject.Z7K1.Z8K5.Z9K1;
    const implementation = createImplementation(ZID, 'FUNCTION');
    if (implementation === null) {
        return canonicalError(
            [error.not_wellformed],
            ['Could not execute non-builtin function ' + ZID]);
    }

    // Validate supplied arguments, parse values, and populate call args.
    const argumentDict = {};
    const functionCall = zobject.Z7K1;
    for (const Z17 of utils.Z10ToArray(functionCall.Z8K1)) {

        // Validates that a value is supplied for the argument.
        // TODO: Also ensure that no additional args were supplied. This can
        // probably be done in the schemata with $data.
        const argumentName = Z17.Z17K2.Z6K1;
        const argument = zobject[argumentName];
        if (argument === undefined) {
            return canonicalError(
                [ error.argument_value_error ],
                [ 'No value for supplied for declared argument ' + argumentName ]);
        }

        // Validates that supplied argument is of correct type, has expected
        // keys and data, and can be deserialized as the advertised type.
        const declaredType = Z17.Z17K1.Z9K1;
        const declarationSchema = normalFactory.create(declaredType);
        let argumentType;

        // TODO: This is a hack to allow Boolean references through. Remove
        // this once Z41/Z42 references can validate as Z40.
        let doSkip = false;
        if (isRefOrString(argument)) {
            argumentType = argument.Z1K1;
        } else {
            argumentType = argument.Z1K1.Z9K1;
            if (argument.Z1K1.Z9K1 === 'Z40') {
                doSkip = true;
            }
        }

        const actualSchema = normalFactory.create(argumentType);
        if (!doSkip && !declarationSchema.validate(argument)) {
            return canonicalError(
                [error.argument_type_error],
                ['Could not validate argument as type ' + Z17.Z17K1.Z9K1]);
        }
        if (!doSkip && !actualSchema.validate(argument)) {
            return canonicalError(
                [error.argument_type_error],
                ['Could not validate argument as type ' + argumentType]);
        }

        // Adds deserialized argument value to the function call.
        argumentDict[ argumentName ] = argument;
    }

    // Validates return type and ability to serialize it.
    const returnType = functionCall.Z8K2.Z9K1;
    const returnValidator = normalFactory.create(returnType);
    const result = implementation.execute(argumentDict);
    if (!returnValidator.validate(result)) {
        return canonicalError(
            [error.argument_type_error],
            ['Could not validate return value as type ' + returnType]);
    }
    return result;
}

module.exports = { isFunctionCall, execute };
