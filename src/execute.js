'use strict';

const { normalError, error } = require('../function-schemata/javascript/src/error');
const { Z10ToArray } = require('../function-schemata/javascript/src/utils');
const { Evaluated, Implementation } = require('./implementation.js');
const { containsError, containsValue, isArgumentReference, isFunctionCall, isRefOrString, makePair, normalFactory } = require('./utils.js');
const { mutate } = require('./zobject.js');

/**
 * Retrieve argument declarations and instantiations from a Z7.
 *
 * @param {Object} zobject
 * @param {ReferenceResolver} resolver
 * @param {Scope} scope
 * @return {Array} list of objects containing argument names
 */
async function getArgumentDicts(zobject, resolver, scope) {
    const argumentDicts = [];
    const Z8K1 = await mutate(zobject, [ 'Z7K1', 'Z8K1' ], resolver, scope);

    for (const Z17 of Z10ToArray(Z8K1)) {
        const argumentDict = {};
        const argumentName = await mutate(Z17, [ 'Z17K2', 'Z6K1' ], resolver, scope);
        argumentDict.name = argumentName;
        // TODO: This is flaky to rely on; find a better way to determine type.
        const declaredType = Z17.Z17K1.Z9K1;
        argumentDict.declaredType = declaredType;
        const argument = await mutate(zobject, [argumentName], resolver, scope);
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
 * @param {Scope} scope
 * @return {Object} zobject if validation succeeds; error tuple otherwise
 */
async function validateReturnType(result, zobject, resolver, scope) {
    // eslint-disable-next-line no-bitwise
    const thebits = (containsValue(result) << 1) | containsError(result);

    if (thebits === 0) {
        // Neither value nor error.
        return makePair(
            null,
            normalError(
                [error.not_wellformed_value],
                ['Function evaluation returned an empty object.']));
    } else if (thebits === 2) {
        // Value returned; validate its return type..
        await mutate(zobject, [ 'Z7K1' ], resolver);
        const returnType = zobject.Z7K1.Z8K2;
        const returnValidator = normalFactory.create(returnType.Z9K1);
        if (!returnValidator.validate(result.Z22K1)) {
            return makePair(
                null,
                normalError(
                    [error.argument_type_mismatch],
                    ['Could not validate return value as type ' + returnType]));
        }
    } else if (thebits === 3) {
        // Both value and error.
        return makePair(
            null,
            normalError(
                [error.not_wellformed_value],
                ['Function evaluation returned both a value and an error.']));
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
        result.names_ = new Map(this.names_);
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

function selectImplementation(implementations) {
    // TODO: Implement heuristics to decide which implement to use. Implicitly,
    // current heuristic is to use a builtin if available; otherwise, choose a
    // random implementation and return that.
    const builtin = implementations.find((impl) => Boolean(impl.Z14K4));
    if (builtin !== undefined) {
        return builtin;
    }
    return implementations[ Math.floor(Math.random() * implementations.length) ];
}

async function processArgument(argumentDict, evaluatorUri, resolver, scope) {
    // TODO: If we could statically analyze type compatibility (i.e., "Z6
    // can be a Z1"), we could perform validation before executing the
    // function and exit early.
    let argument = argumentDict.argument;
    if (isArgumentReference(argument)) {
        const argumentName = argument.Z18K1.Z6K1;
        argument = scope.retrieveArgument(argumentName);
        if (argument === null) {
            return makePair(
                null,
                normalError(
                    // TODO(T287919): Reconsider error type.
                    [error.invalid_key],
                    ['No argument called ' + argumentName + ' in scope.'])
            );
        }
    } else if (isFunctionCall(argument)) {
        const evaluationResult = await execute(argument, evaluatorUri, resolver, scope);
        if (containsError(evaluationResult)) {
            return evaluationResult;
        }
        argument = evaluationResult.Z22K1;
    }

    let argumentType;
    if (isRefOrString(argument)) {
        argumentType = argument.Z1K1;
    } else {
        argumentType = argument.Z1K1.Z9K1;
    }

    const declarationSchema = normalFactory.create(argumentDict.declaredType);
    const actualSchema = normalFactory.create(argumentType);
    if (!declarationSchema.validate(argument)) {
        return makePair(null, normalError(
                [error.argument_type_mismatch],
                ['Could not validate argument ' + JSON.stringify(argument) + ' as declared type ' + argumentDict.declaredType]));
    }
    if (!actualSchema.validate(argument)) {
        return makePair(null, normalError(
                [error.argument_type_mismatch],
                ['Could not validate argument ' + JSON.stringify(argument) + ' as apparent type ' + argumentDict.argumentType]));
    }
    return { name: argumentDict.name, argument: argument };
}

/**
 * Accepts a function call, retrieves the appropriate implementation, and tries
 * to execute with supplied arguments.
 *
 * @param {Object} zobject object describing a function call
 * @param {string} evaluatorUri URI of native code evaluator service
 * @param {ReferenceResolver} resolver handles resolution of Z9s
 * @param {Scope} scope current variable bindings
 * @param {boolean} doRecurse whether to execute embedded function calls;
 * disable for builtin validation
 * @return {Object} result of executing function call
 */
execute = async function (zobject, evaluatorUri, resolver, scope = null, doRecurse = true) {
    if (isArgumentReference(zobject)) {
        return makePair(scope.retrieveArgument(zobject.Z18K1.Z6K1), null);
    }

    // Ensure Z8 (Z7K1) is dereferenced. Also ensure implementations are
    // dereferenced (Z8K4 and all elements thereof).
    const Z8K4 = await mutate(zobject, ['Z7K1', 'Z8K4'], resolver, scope);
    const implementations = [];
    if (Z8K4 !== undefined) {
        let root = Z8K4;
        while (root.Z10K1 !== undefined) {
            // TODO: Write test making sure that Z14s are resolved.
            const Z10K1 = await mutate(root, [ 'Z10K1' ], resolver, scope);
            implementations.push(Z10K1);
            root = root.Z10K2;
        }
    }

    const implementationZObject = selectImplementation(implementations);
    const implementation = Implementation.create(implementationZObject);

    // Retrieve argument declarations and instantiations.
    const argumentDicts = await getArgumentDicts(zobject, resolver, scope);

    // Validate arguments; make recursive function calls if necessary.
    const values = [];
    const argumentPromises = [];
    for (const argumentDict of argumentDicts) {
        if (implementation.hasLazyVariable(argumentDict.name) || !doRecurse) {
            values.push({ name: argumentDict.name, argument: argumentDict.argument });
        } else {
            argumentPromises.push(processArgument(argumentDict, evaluatorUri, resolver, scope));
        }
    }
    for (const argumentDict of await Promise.all(argumentPromises)) {
        // TODO: Better error handling here--check containsError once all errors
        // are truly Z5s.
        if (argumentDict.Z22K2 !== undefined) {
            return argumentDict;
        }
        values.push(argumentDict);
    }

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

    // Check corner case where evaluated function must be dereferenced.
    // TODO: Clone ZObject; add only one implementation and dereference only that.
    if (implementation instanceof Evaluated) {
        if (Z8K4 !== undefined) {
            let root = Z8K4;
            while (root.Z10K1 !== undefined) {
                if (root.Z10K1.Z14K3 !== undefined) {
                    await mutate(root, [ 'Z10K1', 'Z14K3', 'Z16K2', 'Z6K1' ], resolver, scope);
                }
                root = root.Z10K2;
            }
        }
    }

    // Populate arguments from scope.
    const argumentInstantiations = [];
    for (const argumentDict of argumentDicts) {
        const name = argumentDict.name;
        const argument = scope.retrieveArgument(argumentDict.name);
        argumentInstantiations.push({ name: name, argument: argument  });
    }

    // Equip the implementation for its journey and execute.
    implementation.setScope(scope);
    implementation.setResolver(resolver);
    implementation.setEvaluatorUri(evaluatorUri);
    let result = await implementation.execute(zobject, argumentInstantiations);

    // Execute result if implementation is lazily evaluated.
    if (implementation.returnsLazy()) {
        const goodResult = await mutate(result, [ 'Z22K1' ], resolver, scope);
        if (isFunctionCall(goodResult) || isArgumentReference(goodResult)) {
            result = await execute(goodResult, evaluatorUri, resolver, scope);
        }
    }

    return await validateReturnType(result, zobject, resolver, scope);
};

module.exports = { execute };
