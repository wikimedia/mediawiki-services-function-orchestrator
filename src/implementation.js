'use strict';

const builtins = require('./builtins.js');

class Implementation {
    constructor(functor) {
        this.functor_ = functor;
    }
}

class BuiltIn extends Implementation {

    /**
     * Calls this implementation's functor with the provided arguments.
     *
     * @param {Object} argumentDictionary object mapping argument names to values
     * @return {Object} the result of calling this.functor_ with provided arguments
     */
    execute(argumentDictionary) {
        // TODO: This is a kludge, since argument names may not necessarily be
        // sorted. Find something akin to Python's **.
        const keys = Object.keys(argumentDictionary);
        keys.sort();
        const callArgs = [];
        for (const key of keys) {
            callArgs.push(argumentDictionary[key]);
        }
        return this.functor_.apply(null, callArgs);
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
 * @return {Function} the function or implementation
 */
function createImplementation(ZID, implementationType) {
    const getter = implementationTypes.get(implementationType);
    if (getter === undefined) {
        // TODO: Error.
        return null;
    }

    const builtin = getter(ZID);
    if (builtin !== null) {
        return new BuiltIn(builtin);
    }
    // TODO: Error.
    // TODO: In future, this will be a DB call to look for a contributor-
    // defined function implementation.
    return null;
}

module.exports = { createImplementation };
