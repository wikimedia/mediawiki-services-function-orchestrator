'use strict';

const Bluebird = require( 'bluebird' );
const builtins = require( './builtins.js' );
const fetch = require( 'node-fetch' );
const { containsError, traverseZList } = require( './utils.js' );
const { mutate, resolveFunctionCallsAndReferences, ZWrapper } = require( './zobject.js' );
const { convertArrayToZList, makeResultEnvelopeWithVoid } = require( '../function-schemata/javascript/src/utils.js' );
const { error, normalError } = require( '../function-schemata/javascript/src/error.js' );
const { makeVoid } = require( '../function-schemata/javascript/src/utils' );

fetch.Promise = Bluebird;

class Implementation {

	constructor( Z14 ) {
		this.resolver_ = null;
		this.scope_ = null;
		this.evaluatorUri_ = null;
		this.lazyVariables_ = new Set();
		this.lazyReturn_ = false;
		this.doValidate_ = true;
		this.Z14_ = Z14;
	}

	hasLazyVariable( variableName ) {
		return this.lazyVariables_.has( variableName );
	}

	returnsLazy() {
		return this.lazyReturn_;
	}

	async execute( zobject, argumentList ) {
		return ZWrapper.create( await this.executeInternal( zobject, argumentList ) );
	}

	setScope( scope ) {
		this.scope_ = scope;
	}

	setResolver( resolver ) {
		this.resolver_ = resolver;
	}

	setDoValidate( doValidate ) {
		this.doValidate_ = doValidate;
	}

	setEvaluatorUri( evaluatorUri ) {
		this.evaluatorUri_ = evaluatorUri;
	}

	/**
	 * Retrieves a function implementation (or an in-memory JS function if a
	 * built-in). Function implementation may be a function, a serializer for
	 * ZObjects, or a deserializer for ZObject.
	 *
	 * @param {Object} Z14 the implementation
	 * @return {Implementation} the implementation
	 */
	static create( Z14 ) {
		if ( typeof Z14 === 'undefined' ) {
			return null;
		}

		if ( Z14.Z14K4 !== undefined ) {
			const ZID = Z14.Z14K4.Z6K1;
			const builtin = builtins.getFunction( ZID );
			const lazyVariables = builtins.getLazyVariables( ZID );
			const lazyReturn = builtins.getLazyReturn( ZID );
			// eslint-disable-next-line no-use-before-define
			return new BuiltIn( Z14, builtin, lazyVariables, lazyReturn );
		}
		if ( Z14.Z14K2 !== undefined ) {
			// eslint-disable-next-line no-use-before-define
			return new Composition( Z14 );
		}
		// eslint-disable-next-line no-use-before-define
		return new Evaluated( Z14 );
	}

}

class BuiltIn extends Implementation {

	constructor( Z14, functor, lazyVariables, lazyReturn ) {
		super( Z14 );
		for ( const variable of lazyVariables ) {
			this.lazyVariables_.add( variable );
		}
		this.lazyReturn_ = lazyReturn;
		this.functor_ = functor;
	}

	/**
	 * Calls this implementation's functor with the provided arguments.
	 *
	 * @param {Object} zobject
	 * @param {Array} argumentList
	 * @return {Object} the result of calling this.functor_ with provided arguments
	 */
	async executeInternal( zobject, argumentList ) {
		const keys = [];
		const nameToArgument = new Map();
		for ( const argumentDict of argumentList ) {
			keys.push( argumentDict.name );
			nameToArgument.set( argumentDict.name, argumentDict.argument );
		}
		keys.sort();
		const callArgs = [];
		for ( const key of keys ) {
			callArgs.push( nameToArgument.get( key ) );
		}
		callArgs.push( this.evaluatorUri_ );
		callArgs.push( this.resolver_ );
		callArgs.push( this.scope_ );
		return this.functor_( ...callArgs );
	}

	async execute( zobject, argumentList ) {
		return ZWrapper.create( await this.executeInternal( zobject, argumentList ) );
	}

}

class Evaluated extends Implementation {

	/**
	 * Calls this implementation's functor with the provided arguments.
	 *
	 * @param {Object} zobject
	 * @param {Array} argumentList
	 * @return {Object} the result of calling this.functor_ with provided arguments
	 */
	async executeInternal( zobject, argumentList ) {
		// Arguments should already be fully resolved, but any other attributes
		// of the Z7 which are Z9s/Z18s must be resolved before dispatching
		// to the function evaluator.
		const Z7 = {};
		Z7.Z1K1 = zobject.Z1K1.asJSON();
		Z7.Z7K1 = (
			await mutate( zobject, [ 'Z7K1' ], this.evaluatorUri_, this.resolver_, this.scope_,
			/* ignoreList= */ null, /* resolveInternals= */ true, this.doValidate_ )
		).Z22K1.asJSON();
		const Z8K4 = ZWrapper.create( await convertArrayToZList( [ this.Z14_.asJSON() ] ) );

		const implementation = this;

		// Implementation may need to be dereferenced.
		await traverseZList( Z8K4, async function ( tail ) {
			if ( tail.K1.Z14K3 !== undefined ) {
				await mutate(
					tail, [ 'K1', 'Z14K3', 'Z16K2', 'Z6K1' ], implementation.evaluatorUri_,
					implementation.resolver_, implementation.scope_, /* ignoreList= */ null,
					/* resolveInternals= */ false, implementation.doValidate_ );
			}
		} );
		Z7.Z7K1.Z8K4 = Z8K4.asJSON();

		// Return type may be a function call and must be resolved to allow for serialization.
		const returnTypeEnvelope = await mutate( zobject, [ 'Z7K1', 'Z8K2' ], this.evaluatorUri_, this.resolver_,
			this.scope_, /* ignoreList= */ null, /* resolveInternals= */ true, this.doValidate_ );
		if ( containsError( returnTypeEnvelope ) ) {
			return returnTypeEnvelope;
		}
		Z7.Z7K1.Z8K2 = returnTypeEnvelope.Z22K1.asJSON();
		for ( const argumentDict of argumentList ) {
			Z7[ argumentDict.name ] = argumentDict.argument.asJSON();
		}
		const fetchedResult = await fetch(
			this.evaluatorUri_, {
				method: 'POST',
				body: JSON.stringify( Z7 ),
				headers: { 'Content-Type': 'application/json' }
			}
		);
		if ( fetchedResult.ok ) {
			// Assume the evaluator is returning Z22s.
			const resultEnvelope = await fetchedResult.json();
			// Transitional code: replace Z23 with Z24 (void)
			// TODO (T285433): After function-schemata updates for this ticket,
			// remove transitional code
			if ( resultEnvelope.Z22K1 === 'Z23' || resultEnvelope.Z22K1.Z9K1 === 'Z23' ) {
				resultEnvelope.Z22K1 = makeVoid();
			}
			if ( resultEnvelope.Z22K2 === 'Z23' || resultEnvelope.Z22K2.Z9K1 === 'Z23' ) {
				resultEnvelope.Z22K2 = makeVoid();
			}
			return resultEnvelope;
		}
		const statusCode = fetchedResult.status;
		const errorText = await fetchedResult.text();
		return makeResultEnvelopeWithVoid(
			null,
			normalError(
				[ error.error_in_evaluation ],
				[ `Function evaluation failed with status ${statusCode}: ${errorText}` ] ) );
	}

}

class Composition extends Implementation {

	constructor( Z14 ) {
		super( Z14 );
		this.composition_ = ZWrapper.create( Z14.Z14K2.asJSON() );
	}

	async executeInternal() {
		return await resolveFunctionCallsAndReferences(
			this.composition_, this.evaluatorUri_, this.resolver_, this.scope_,
			/* originalObject= */ null, /* key= */ null, /* ignoreList= */ null,
			/* resolveInternals= */ true, /* doValidate= */ this.doValidate_ );
	}

}

module.exports = { Composition, Evaluated, Implementation };
