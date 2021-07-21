'use strict';

const Bluebird = require('bluebird');
const builtins = require('./builtins.js');
const fetch = require('node-fetch');

fetch.Promise = Bluebird;

class BuiltIn {

    constructor(functor, resolver, scope) {
        this.functor_ = functor;
        this.resolver_ = resolver;
        this.scope_ = scope;
    }

    /**
     * Calls this implementation's functor with the provided arguments.
     *
     * @param {Object} zobject
     * @param {Array} argumentList
     * @return {Object} the result of calling this.functor_ with provided arguments
     */
    async execute(zobject, argumentList) {
        // TODO: This is a kludge, since argument names may not necessarily be
        // sorted. Find something akin to Python's **.
        const keys = [];
        const nameToArgument = new Map();
        for (const argumentDict of argumentList) {
            keys.push(argumentDict.name);
            nameToArgument.set(argumentDict.name, argumentDict.argument);
        }
        keys.sort();
        const callArgs = [];
        for (const key of keys) {
            callArgs.push(nameToArgument.get(key));
        }
        callArgs.push(this.resolver_);
        callArgs.push(this.scope_);
        return this.functor_(...callArgs);
    }

}

class Evaluated {

    constructor(evaluatorUri) {
        this.uri_ = evaluatorUri;
    }

    /**
     * Calls this implementation's functor with the provided arguments.
     *
     * @param {Object} zobject
     * @param {Array} argumentList
     * @return {Object} the result of calling this.functor_ with provided arguments
     */
    async execute(zobject, argumentList) {
        const Z7 = { ...zobject };
        for (const argumentDict of argumentList) {
            Z7[ argumentDict.name ] = argumentDict.argument;
        }
        return fetch(
            this.uri_,
            {
                method: 'POST',
                body: JSON.stringify(Z7),
                headers: { 'Content-Type': 'application/json' }
            })
            .then((result) => {
                return result.json();
            })
            .catch((problem) => {
                // TODO: Create an error here.
                return problem;
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
 * @param {ReferenceResolver} referenceResolver
 * @return {Function} the function or implementation
 */
function createImplementation(ZID, implementationType, evaluatorUri, referenceResolver = null) {
    const getter = implementationTypes.get(implementationType);
    if (getter === undefined) {
        // TODO: Error.
        return null;
    }

    const builtin = getter(ZID);
    if (builtin !== null) {
        return new BuiltIn(builtin, referenceResolver);
    }

    if (evaluatorUri !== null) {
        return new Evaluated(evaluatorUri);
    }

    return null;
}

module.exports = { createImplementation };
