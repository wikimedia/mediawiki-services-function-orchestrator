'use strict';

const { normalError, error } = require('../function-schemata/javascript/src/error');
const { makeResultEnvelope, Z10ToArray } = require('../function-schemata/javascript/src/utils');
const { Composition, Evaluated, Implementation } = require('./implementation.js');
const { containsError, containsValue, createSchema, isArgumentReference, isFunctionCall, isType } = require('./utils.js');
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
		this.names_.set(name, ArgumentState.UNEVALUATED(argumentDict));
	}

	async processArgument(argumentDict, evaluatorUri, resolver) {
		// TODO: If we could statically analyze type compatibility (i.e., "Z6
		// can be a Z1"), we could perform validation before executing the
		// function and exit early.
		const argument = await mutate(argumentDict, ['argument'], evaluatorUri, resolver, this.lastFrame_);
		await mutate(argument, ['Z1K1'], evaluatorUri, resolver, this.lastFrame_);
		const declarationSchema = createSchema({ Z1K1: argumentDict.declaredType });
		const actualSchema = createSchema(argument);
		if (!declarationSchema.validate(argument)) {
			return ArgumentState.ERROR(
				normalError(
					[error.argument_type_mismatch],
					['Could not validate argument ' + JSON.stringify(argument) + ' as declared type ' + JSON.stringify(argumentDict.declaredType)]));
		}
		if (!actualSchema.validate(argument)) {
			return ArgumentState.ERROR(
				normalError(
					[error.argument_type_mismatch],
					['Could not validate argument ' + JSON.stringify(argument) + ' as apparent type ' + JSON.toString(argument.Z1K1) ]));
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
			// is a Z7, the value must be evaluated before returning.
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
		const declaredType = await mutate(Z17, [ 'Z17K1' ], evaluatorUri, resolver, scope);
		argumentDict.declaredType = declaredType;
		let key = argumentName;
		if (zobject[ key ] === undefined) {
			const localKeyRegex = /K[1-9]\d*$/;
			key = key.match(localKeyRegex)[0];
		}

		const argument = zobject[ key ];
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
		return makeResultEnvelope(
			null,
			normalError(
				[error.not_wellformed_value],
				['Function evaluation returned an empty object.']));
	} else if (thebits === 2) {
		// Value returned; validate its return type..
		const Z7K1 = await mutate(zobject, [ 'Z7K1' ], evaluatorUri, resolver, scope);
		const returnType = await mutate(Z7K1, [ 'Z8K2' ], evaluatorUri, resolver, scope);
		let returnZID;
		if (isType(returnType)) {
			returnZID = returnType.Z4K1.Z9K1;
		} else {
			returnZID = returnType.Z9K1;
		}
		// TODO(T292252): Should be returnType, not returnZID.
		const returnValidator = createSchema(returnZID);
		if (returnZID !== 'Z10' && !returnValidator.validate(result.Z22K1)) {
			return makeResultEnvelope(
				null,
				normalError(
					[error.argument_type_mismatch],
					['Could not validate return value as type ' + returnZID]));
		}
	} else if (thebits === 3) {
		// Both value and error.
		return makeResultEnvelope(
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
				return makeResultEnvelope(null, instantiation.error);
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
	// TODO: Replace calls below with mutate.
	if (implementation.returnsLazy()) {
		const goodResult = await mutate(result, [ 'Z22K1' ], evaluatorUri, resolver, scope);
		if (isFunctionCall(goodResult) || isArgumentReference(goodResult)) {
			result = await execute(goodResult, evaluatorUri, resolver, scope);
		} else {
			result.Z22K1 = goodResult;
		}
	}

	return await validateReturnType(result, zobject, evaluatorUri, resolver, scope);
};

module.exports = { execute, getArgumentDicts };
