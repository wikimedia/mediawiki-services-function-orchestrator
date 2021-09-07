'use strict';

const { normalError, error } = require('../function-schemata/javascript/src/error');
const { Z10ToArray } = require('../function-schemata/javascript/src/utils');
const { Composition, Evaluated, Implementation } = require('./implementation.js');
const { containsError, containsValue, createSchema, isArgumentReference, isEvaluableFunctionCall, isFunctionCall, isRefOrString, makePair, Z41 } = require('./utils.js');
const { mutate } = require('./zobject.js');

let execute = null;

class ArgumentState {

    constructor() {
        this.state = null;
        this.argumentDict = null;
        this.error = null;
    }

    static UNEVALUATED(argumentDict) {
        const result = new ArgumentState();
        result.argumentDict = argumentDict;
        result.state = 'UNEVALUATED';
        return result;
    }

    static EVALUATED(argument) {
        const result = new ArgumentState();
        result.argumentDict = argument;
        result.state = 'EVALUATED';
        return result;
    }

    static ERROR(error) {
        const result = new ArgumentState();
        result.error = error;
        result.state = 'ERROR';
        return result;
    }

}

class BaseFrame {

    constructor(lastFrame = null) {
        this.lastFrame_ = lastFrame;
        this.names_ = new Map();
    }

}

class EmptyFrame extends BaseFrame {
    constructor() {
        super();
    }

    async retrieveArgument(argumentName) {
        return ArgumentState.ERROR(
            normalError(
                // TODO(T287919): Reconsider error type.
                [error.invalid_key],
                ['No argument called ' + argumentName + ' in scope.']));
    }
}

class Frame extends BaseFrame {

    constructor(lastFrame = null) {
        if (lastFrame === null) {
            lastFrame = new EmptyFrame();
        }
        super(lastFrame);
    }

    /**
     * Add new name and argument to this frame.
     *
     * @param {string} name
     * @param {Object} argumentDict
     */
    setArgument(name, argumentDict) {
        const argument = argumentDict.argument;
        if (isFunctionCall(argument) && argument.Z7K2 === undefined) {
            argumentDict.argument.Z7K2 = Z41();
        }
        this.names_.set(name, ArgumentState.UNEVALUATED(argumentDict));
    }

    async processArgument(argumentDict, evaluatorUri, resolver) {
        // TODO: If we could statically analyze type compatibility (i.e., "Z6
        // can be a Z1"), we could perform validation before executing the
        // function and exit early.
        let argument = argumentDict.argument;
        while (true) {
            if (isArgumentReference(argument)) {
                const argumentName = argument.Z18K1.Z6K1;
                // TODO(T289018): Add a test for same function nested in different
                // scopes to test circular references.
                const argumentState = await this.retrieveArgument(
                    argumentName, evaluatorUri, resolver);
                if (argumentState.state === 'ERROR') {
                    return argumentState;
                }
                argument = argumentState.argumentDict.argument;
                continue;
            }
            if (isEvaluableFunctionCall(argument)) {
                // TODO(T289018): What if a Z7 needs to refer to an argument
                // in the same frame? Does that even make sense to do?
                const evaluationResult = await execute(
                    argument, evaluatorUri, resolver, this.lastFrame_);
                if (containsError(evaluationResult)) {
                    return ArgumentState.ERROR(evaluationResult.Z22K2);
                }
                argument = evaluationResult.Z22K1;
                continue;
            }
            break;
        }

        let argumentType;
        if (isRefOrString(argument)) {
            argumentType = argument.Z1K1;
        } else {
            argumentType = argument.Z1K1.Z9K1;
        }

        const declarationSchema = createSchema(argumentDict.declaredType);
        const actualSchema = createSchema(argumentType);
        if (!declarationSchema.validate(argument)) {
            return ArgumentState.ERROR(
                normalError(
                    [error.argument_type_mismatch],
                    ['Could not validate argument ' + JSON.stringify(argument) + ' as declared type ' + argumentDict.declaredType]));
        }
        if (!actualSchema.validate(argument)) {
            return ArgumentState.ERROR(
                normalError(
                    [error.argument_type_mismatch],
                    ['Could not validate argument ' + JSON.stringify(argument) + ' as apparent type ' + argumentDict.argumentType]));
        }
        return ArgumentState.EVALUATED({ name: argumentDict.name, argument: argument });
    }

    /**
     * Ascend enclosing scopes to find instantiation of argument with provided name.
     *
     * @param {string} argumentName
     * @param {string} evaluatorUri
     * @param {ReferenceResolver} resolver
     * @param {boolean} lazily
     * @return {Object} argument instantiated with given name in lowest enclosing scope
     * along with enclosing scope
     */
    async retrieveArgument(argumentName, evaluatorUri, resolver, lazily = false) {
        let boundValue = this.names_.get(argumentName);

        // Name does not exist in this scope; look in the previous one
        // (or return null if no previous scope).
        if (boundValue === undefined) {
            return this.lastFrame_.retrieveArgument(argumentName, evaluatorUri, resolver, lazily);
        }

        // If bound value is in the ERROR or EVALUATED state, it has already
        // been evaluated and can be returned directly.
        if (boundValue.state === 'UNEVALUATED' && !lazily) {
            // If state is UNEVALUATED, evaluation is not lazy, and the argument
            // is a Z7 with Z7K2 === Z41, the value must be evaluted before
            // returning.
            // Otherwise, it is necessary to evaluate the argument.
            const argumentDict = boundValue.argumentDict;
            const evaluatedArgument = await this.processArgument(
                argumentDict, evaluatorUri, resolver);
            this.names_.set(argumentName, evaluatedArgument);
            boundValue = evaluatedArgument;
        }
        return boundValue;
    }

}

/**
 * Retrieve argument declarations and instantiations from a Z7.
 *
 * @param {Object} zobject
 * @param {string} evaluatorUri
 * @param {ReferenceResolver} resolver
 * @param {Scope} scope
 * @return {Array} list of objects containing argument names
 */
async function getArgumentDicts(zobject, evaluatorUri, resolver, scope) {
    const argumentDicts = [];
    const Z8K1 = await mutate(zobject, [ 'Z7K1', 'Z8K1' ], evaluatorUri, resolver, scope);

    for (const Z17 of Z10ToArray(Z8K1)) {
        const argumentDict = {};
        const argumentName = await mutate(Z17, [ 'Z17K2', 'Z6K1' ], evaluatorUri, resolver, scope);
        argumentDict.name = argumentName;
        // TODO: This is flaky to rely on; find a better way to determine type.
        const declaredType = Z17.Z17K1.Z9K1;
        argumentDict.declaredType = declaredType;
        let key = argumentName;
        if (zobject[ key ] === undefined) {
            const localKeyRegex = /K[1-9]\d*$/;
            key = key.match(localKeyRegex)[0];
        }
        const argument = await mutate(zobject, [key], evaluatorUri, resolver, scope);
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
 * @param {string} evaluatorUri
 * @param {ReferenceResolver} resolver
 * @param {Scope} scope
 * @return {Object} zobject if validation succeeds; error tuple otherwise
 */
async function validateReturnType(result, zobject, evaluatorUri, resolver, scope) {
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
        const Z7K1 = await mutate(zobject, [ 'Z7K1' ], evaluatorUri, resolver, scope);
        const returnType = Z7K1.Z8K2;
        const returnValidator = createSchema(returnType.Z9K1);
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

/**
 * Accepts a function call, retrieves the appropriate implementation, and tries
 * to execute with supplied arguments.
 *
 * @param {Object} zobject object describing a function call
 * @param {string} evaluatorUri URI of native code evaluator service
 * @param {ReferenceResolver} resolver handles resolution of Z9s
 * @param {Scope} oldScope current variable bindings
 * @return {Object} result of executing function call
 */
execute = async function (zobject, evaluatorUri, resolver, oldScope = null) {
    const scope = new Frame(oldScope);

    // Retrieve argument declarations and instantiations.
    const argumentDicts = await getArgumentDicts(zobject, evaluatorUri, resolver, scope);
    // TODO: Check for Z22 results; these are error states.
    for (const argumentDict of argumentDicts) {
        scope.setArgument(argumentDict.name, argumentDict);
    }

    // Ensure Z8 (Z7K1) is dereferenced. Also ensure implementations are
    // dereferenced (Z8K4 and all elements thereof).
    const Z8K4 = await mutate(zobject, ['Z7K1', 'Z8K4'], evaluatorUri, resolver, scope);
    const implementations = [];
    if (Z8K4 !== undefined) {
        let root = Z8K4;
        while (root.Z10K1 !== undefined) {
            // TODO: Write test making sure that Z14s are resolved.
            const Z10K1 = await mutate(root, [ 'Z10K1' ], evaluatorUri, resolver, scope);
            implementations.push(Z10K1);
            root = root.Z10K2;
        }
    }

    // TODO: Throw an error if there are no implementations

    const implementationZObject = selectImplementation(implementations);
    const implementation = Implementation.create(implementationZObject);

    // Check corner case where evaluated function must be dereferenced.
    // TODO: Clone ZObject; add only one implementation and dereference only that.
    if (implementation instanceof Evaluated) {
        if (Z8K4 !== undefined) {
            let root = Z8K4;
            while (root.Z10K1 !== undefined) {
                if (root.Z10K1.Z14K3 !== undefined) {
                    await mutate(root, [ 'Z10K1', 'Z14K3', 'Z16K2', 'Z6K1' ], evaluatorUri, resolver, scope);
                }
                root = root.Z10K2;
            }
        }
    }

    const argumentInstantiations = [];
    if (!(implementation instanceof Composition)) {
        // Populate arguments from scope.
        // TODO: Check for errors in retrieve arguments and return early.
        const instantiationPromises = [];
        for (const argumentDict of argumentDicts) {
            instantiationPromises.push(
                scope.retrieveArgument(
                    argumentDict.name, evaluatorUri, resolver,
                    implementation.hasLazyVariable(argumentDict.name)
                ));
        }
        for (const instantiation of await Promise.all(instantiationPromises)) {
            if (instantiation.state === 'ERROR') {
                return makePair(null, instantiation.error);
            }
            argumentInstantiations.push(instantiation.argumentDict);
        }
    }

    // Equip the implementation for its journey and execute.
    implementation.setScope(scope);
    implementation.setResolver(resolver);
    implementation.setEvaluatorUri(evaluatorUri);
    let result = await implementation.execute(zobject, argumentInstantiations);

    // Execute result if implementation is lazily evaluated.
    if (implementation.returnsLazy()) {
        const goodResult = await mutate(result, [ 'Z22K1' ], evaluatorUri, resolver, scope);
        if (isFunctionCall(goodResult) || isArgumentReference(goodResult)) {
            result = await execute(goodResult, evaluatorUri, resolver, scope);
        }
    }

    return await validateReturnType(result, zobject, evaluatorUri, resolver, scope);
};

module.exports = { execute, getArgumentDicts };
