'use strict';

const { canonicalError, error } = require('../function-schemata/javascript/src/error');
const { Z10ToArray } = require('../function-schemata/javascript/src/utils');
const { createImplementation } = require('./implementation.js');
const { makePair } = require('./utils.js');
const { mutate } = require('./zobject.js');
const { isRefOrString, normalFactory } = require('./validation.js');

/**
 * Retrieve argument declarations and instantiations from a Z7.
 *
 * @param {Object} zobject
 * @param {ReferenceResolver} resolver
 * @return {Array} list of objects containing argument names
 */
async function getArgumentDicts(zobject, resolver) {
    const argumentDicts = [];
    await mutate(zobject, [ 'Z7K1', 'Z8K1' ], resolver);
    const Z8K1 = zobject.Z7K1.Z8K1;

    for (const Z17 of Z10ToArray(Z8K1)) {
        const argumentDict = {};
        await mutate(Z17, [ 'Z17K2', 'Z6K1' ], resolver);
        const argumentName = Z17.Z17K2.Z6K1;
        argumentDict.name = argumentName;
        // TODO: This is flaky to rely on; find a better way to determine type.
        const declaredType = Z17.Z17K1.Z9K1;
        argumentDict.declaredType = declaredType;
        await mutate(zobject, [argumentName], resolver);
        const argument = zobject[ argumentName ];
        argumentDict.argument = argument;
        argumentDicts.push(argumentDict);
    }

    return argumentDicts;
}

/**
 * Ensure that result of a function call comports with declared type.
 *
 * @param {Object} result
 * @param {Object} zobject
 * @param {ReferenceResolver} resolver
 * @return {Object} zobject if validation succeeds; error tuple otherwise
 */
async function validateReturnType(result, zobject, resolver) {
    // No need to validate result if it's an error.
    if (result.Z22K1 !== undefined) {
        await mutate(zobject, [ 'Z7K1' ], resolver);
        const returnType = zobject.Z7K1.Z8K2;
        // TODO: Why is the top-level normalFactory not recognized?
        const { normalFactory } = require('./validation.js');
        const returnValidator = normalFactory.create(returnType.Z9K1);
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

class Frame {

    constructor() {
        this.names_ = new Map();
    }

    /**
     * Add new name and argument to this frame.
     *
     * @param {string} name
     * @param {Object} value
     */
    setArgument(name, value) {
        this.names_.set(name, value);
    }

    /**
     * Retrieve argument with provided name from this frame.
     *
     * @param {string} name
     * @return {Object} argument instantiated with given name
     */
    getArgument(name) {
        return this.names_.get(name);
    }

    /**
     * Clone this object and return the clone.
     *
     * @return {Scope} copy of this
     */
    clone() {
        const result = new Frame();
        result.names_ = new Map(this.frames_);
        return result;
    }

}

class Scope {

    constructor() {
        this.frames_ = [];
    }

    /**
     * Create new Frame and add it to scope.
     *
     * @return {Frame} newly generated frame
     */
    addFrame() {
        const newFrame = new Frame();
        this.frames_.push(newFrame);
        return newFrame;
    }

    /**
     * Clone this object and return the clone.
     *
     * @return {Scope} copy of this
     */
    clone() {
        const result = new Scope();
        for (const frame of this.frames_) {
            result.frames_.push(frame.clone());
        }
        return result;
    }

    /**
     * Ascend enclosing scopes to find instantiation of argument with provided name.
     *
     * @param {string} argumentName
     * @return {Object} argument instantiated with given name in lowest enclosing scope
     */
    retrieveArgument(argumentName) {
        for (let i = this.frames_.length - 1; i >= 0; --i) {
            const frame = this.frames_[i];
            const result = frame.getArgument(argumentName);
            if (result !== undefined) {
                return result;
            }
        }
        return null;
    }

}

let execute = null;

async function processArgument(argumentDict, evaluatorUri, resolver, scope) {
    const Z7Schema = normalFactory.create('Z7');
    const Z18Schema = normalFactory.create('Z18');

    // TODO: If we could statically analyze type compatibility (i.e., "Z6
    // can be a Z1"), we could perform validation before executing the
    // function and exit early.
    let argument = argumentDict.argument;
    if (Z7Schema.validate(argument)) {
        const evaluationResult = await execute(argument, evaluatorUri, resolver, scope);

        const errorKey = evaluationResult.Z22K2.Z1K1.Z9K1 ?
            evaluationResult.Z22K2.Z1K1.Z9K1 :
            evaluationResult.Z22K2.Z9K1;

        if (errorKey !== 'Z23') {
            return evaluationResult;
        }
        argument = evaluationResult.Z22K1;
    } else if (Z18Schema.validate(argument)) {
        // TODO: reject with error if could not retrieve argument ( argument === null ).
        argument = scope.retrieveArgument(argument.Z18K1.Z6K1);
    }

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

    const declarationSchema = normalFactory.create(argumentDict.declaredType);
    const actualSchema = normalFactory.create(argumentType);
    if (!doSkip && !declarationSchema.validate(argument)) {
        return makePair(null, canonicalError(
                [error.argument_type_error],
                ['Could not validate argument as type ' + argumentDict.declaredType]));
    }
    if (!doSkip && !actualSchema.validate(argument)) {
        return makePair(null, canonicalError(
                [error.argument_type_error],
                ['Could not validate argument as type ' + argumentType]));
    }
    return { name: argumentDict.name, argument: argument };
}

/**
 * Accepts a function call, retrieves the appropriate implementation, and tries
 * to execute with supplied arguments.
 *
 * @param {Object} zobject object describing a function call
 * @param {string} evaluatorUri
 * @param {ReferenceResolver} resolver
 * @param {Scope} scope
 * @return {Object} result of executing function call
 */
execute = async function (zobject, evaluatorUri, resolver, scope = null) {

    // Ensure Z8 is fully populated.
    await mutate(zobject, [ 'Z7K1', 'Z8K4' ], resolver);

    let implementations = [];
    if (zobject.Z7K1.Z8K4 !== undefined) {
        implementations = Z10ToArray(zobject.Z7K1.Z8K4);
    }

    // Retrieve argument declarations and instantiations.
    const argumentDicts = await getArgumentDicts(zobject, resolver);

    // Validate arguments; make recursive function calls if necessary.
    const argumentPromises = [];
    for (const argumentDict of argumentDicts) {
        argumentPromises.push(processArgument(argumentDict, evaluatorUri, resolver, scope));
    }
    const values = await Promise.all(argumentPromises);

    // Populate new frame with newly-declared arguments.
    if (scope === null) {
        scope = new Scope();
    }
    scope = scope.clone();
    const frame = scope.addFrame();
    // TODO: Check for Z22 results; these are error states.
    for (const value of values) {
        frame.setArgument(value.name, value.argument);
    }

    // TODO: Implement heuristics to decide which implement to use. Implicitly,
    // current heuristic is to use a builtin if available; otherwise, use a
    // composition if available; otherwise, use the first available native
    // code implementation.
    const builtin = implementations.find((impl) => Boolean(impl.Z14K4));
    const composition = implementations.find((impl) => Boolean(impl.Z14K2));

    let ZID;
    if (builtin !== undefined) {
        // If builtin, retrieve the function by its ZID.
        ZID = builtin.Z14K4.Z6K1;
    } else if (composition !== undefined) {
        // If composition, run the composed Z7.
        return execute(composition.Z14K2, evaluatorUri, resolver, scope);
    } else {
        // Otherwise, retrieve the function by Z8K5 reference.
        ZID = zobject.Z7K1.Z8K5.Z9K1;
        // Ensure that required references are resolved before sending to evaluator.
        await mutate(zobject, [ 'Z7K1', 'Z8K4', 'Z10K1', 'Z14K3', 'Z16K2', 'Z6K1' ], resolver);
    }

    const implementation = createImplementation(ZID, 'FUNCTION', evaluatorUri, resolver);
    if (implementation === null) {
        return makePair(
            null,
            canonicalError(
                [error.not_wellformed],
                ['Could not execute non-builtin function ' + ZID]));
    }

    // Populate arguments.
    const argumentInstantiations = [];
    for (const argumentDict of argumentDicts) {
        const name = argumentDict.name;
        const argument = scope.retrieveArgument(argumentDict.name);
        argumentInstantiations.push({ name: name, argument: argument  });
    }
    const result = await implementation.execute(zobject, argumentInstantiations);

    return validateReturnType(result, zobject, resolver);
};

module.exports = { execute };
