'use strict';

const Bluebird = require('bluebird');
const builtins = require('./builtins.js');
const fetch = require('node-fetch');
const utils = require('../function-schemata/javascript/src/utils');
const { SchemaFactory } = require('../function-schemata/javascript/src/schema.js');
const { canonicalError, error } = require('../function-schemata/javascript/src/error');
const { makePair } = require('./utils.js');

fetch.Promise = Bluebird;

const normalFactory = SchemaFactory.NORMAL();

class Implementation {

    withReturnValidated(result, zobject) {
        // No need to validate result if it's an error.
        if (result.Z22K1 !== undefined) {
            const returnType = zobject.Z7K1.Z8K2.Z9K1;
            const returnValidator = normalFactory.create(returnType);
            if (!returnValidator.validate(result.Z22K1)) {
                return makePair(
                    null,
                    canonicalError(
                        [error.argument_type_error],
                        ['Could not validate return value as type ' + returnType]));
            }
        }
        return result;
    }

    getArgumentsDict(zobject) {
        const argumentDict = {};
        const functionCall = zobject.Z7K1;

        for (const Z17 of utils.Z10ToArray(functionCall.Z8K1)) {
            const argumentName = Z17.Z17K2.Z6K1;
            const argument = zobject[argumentName];

            argumentDict[ argumentName ] = argument;
        }

        return argumentDict;
    }
}

class BuiltIn extends Implementation {

    constructor(functor) {
        super();
        this.functor_ = functor;
    }

    /**
     * Calls this implementation's functor with the provided arguments.
     *
     * @param {Object} zobject
     * @return {Object} the result of calling this.functor_ with provided arguments
     */
    execute(zobject) {
        const argumentDictionary = this.getArgumentsDict(zobject);

        // TODO: This is a kludge, since argument names may not necessarily be
        // sorted. Find something akin to Python's **.
        const keys = Object.keys(argumentDictionary);
        keys.sort();
        const callArgs = [];
        for (const key of keys) {
            callArgs.push(argumentDictionary[key]);
        }
        const result = this.functor_.apply(null, callArgs);
        return new Promise((resolve, reject) => {
            resolve(this.withReturnValidated(result, zobject));
        });
    }

}

class Evaluated extends Implementation {

    constructor(evaluatorUri) {
        super();
        this.uri_ = evaluatorUri;
    }

    /**
     * Calls this implementation's functor with the provided arguments.
     *
     * @param {Object} zobject
     * @return {Object} the result of calling this.functor_ with provided arguments
     */
    execute(zobject) {
        return fetch(
            this.uri_,
            {
                method: 'POST',
                body: JSON.stringify(zobject),
                headers: { 'Content-Type': 'application/json' }
            })
            .then((result) => {
                return this.withReturnValidated(result.json(), zobject);
            })
            .catch((problem) => {
                // TODO: Create an error here.
                return this.withReturnValidated(problem, zobject);
            });
    }

}

const implementationTypes = new Map();
implementationTypes.set('FUNCTION', builtins.getFunction);

/**
 * Retrieves a function implementation (or an in-memory JS function if a
 * built-in). Function implementation may be a function, a serializer for
 * ZObjects, or a deserializer for ZObject.
 *
 * Currently does not retrieve contributor-provided function
 * implementations in native code; can only handle built-ins.
 *
 * @param {string} ZID the function to retrieve an implementation for
 * @param {string} implementationType the kind of function to retrieve
 * @param {string} evaluatorUri
 * @return {Function} the function or implementation
 */
function createImplementation(ZID, implementationType, evaluatorUri) {
    const getter = implementationTypes.get(implementationType);
    if (getter === undefined) {
        // TODO: Error.
        return null;
    }

    const builtin = getter(ZID);
    if (builtin !== null) {
        return new BuiltIn(builtin);
    }

    if (evaluatorUri !== null) {
        return new Evaluated(evaluatorUri);
    }

    return null;
}

module.exports = { createImplementation, makePair };
