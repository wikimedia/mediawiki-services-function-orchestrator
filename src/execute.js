'use strict';

const utils = require('../function-schemata/javascript/src/utils');
const { canonicalError, error } = require('../function-schemata/javascript/src/error');
const { createImplementation } = require('./implementation.js');
const { isRefOrString, normalFactory } = require('./validation.js');

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

module.exports = { execute };
