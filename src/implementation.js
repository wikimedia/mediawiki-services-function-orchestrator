'use strict';

const Bluebird = require( 'bluebird' );
const builtins = require( './builtins.js' );
const fetch = require( 'node-fetch' );
const { containsError } = require( './utils.js' );
const { mutate } = require( './zobject.js' );

fetch.Promise = Bluebird;

class Implementation {

	constructor() {
		this.resolver_ = null;
		this.scope_ = null;
		this.evaluatorUri_ = null;
		this.lazyVariables_ = new Set();
		this.lazyReturn_ = false;
	}

	hasLazyVariable( variableName ) {
		return this.lazyVariables_.has( variableName );
	}

	returnsLazy() {
		return this.lazyReturn_;
	}

	setScope( scope ) {
		this.scope_ = scope;
	}

	setResolver( resolver ) {
		this.resolver_ = resolver;
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
			return new BuiltIn( builtin, lazyVariables, lazyReturn );
		}
		if ( Z14.Z14K2 !== undefined ) {
			// eslint-disable-next-line no-use-before-define
			return new Composition( Z14.Z14K2 );
		}
		// eslint-disable-next-line no-use-before-define
		return new Evaluated();
	}

}

class BuiltIn extends Implementation {

	constructor( functor, lazyVariables, lazyReturn ) {
		super();
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
	async execute( zobject, argumentList ) {
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

}

class Evaluated extends Implementation {

	/**
	 * Calls this implementation's functor with the provided arguments.
	 *
	 * @param {Object} zobject
	 * @param {Array} argumentList
	 * @return {Object} the result of calling this.functor_ with provided arguments
	 */
	async execute( zobject, argumentList ) {
		// Arguments should already be fully resolved, but any other attributes
		// of the Z7 which are Z9s/Z18s must be resolved before dispatching
		// to the function evaluator.
		const Z7 = {};
		Z7.Z1K1 = zobject.Z1K1;
		Z7.Z7K1 = ( await mutate( zobject, [ 'Z7K1' ], this.evaluatorUri_, this.resolver_, this.scope_ ) ).Z22K1;
		// Return type may be a function call and must be resolved to allow for serialization.
		const returnTypeEnvelope = await mutate( zobject, [ 'Z7K1', 'Z8K2' ], this.evaluatorUri_, this.resolver_, this.scope_, true );
		if ( containsError( returnTypeEnvelope ) ) {
			return returnTypeEnvelope;
		}
		Z7.Z7K1.Z8K2 = returnTypeEnvelope.Z22K1;
		for ( const argumentDict of argumentList ) {
			Z7[ argumentDict.name ] = argumentDict.argument;
		}
		return fetch(
			this.evaluatorUri_,
			{
				method: 'POST',
				body: JSON.stringify( Z7 ),
				headers: { 'Content-Type': 'application/json' }
			} )
			.then( ( result ) => {
				return result.json();
			} )
			.catch( ( problem ) => {
				// TODO(T296683): Create an error here.
				return problem;
			} );
	}

}

class Composition extends Implementation {

	constructor( composition ) {
		super();
		this.composition_ = { ...composition };
	}

	async execute() {
		return await mutate(
			{ dummyKey: this.composition_ }, [ 'dummyKey' ],
			this.evaluatorUri_, this.resolver_, this.scope_ );
	}

}

module.exports = { Composition, Evaluated, Implementation };
