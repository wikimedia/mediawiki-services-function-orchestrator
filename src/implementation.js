'use strict';

const builtins = require( './builtins.js' );
const { responseEnvelopeContainsError, traverseZList } = require( './utils.js' );
const { ZWrapper } = require( './ZWrapper' );
const { convertItemArrayToZList, makeMappedResultEnvelope } = require( '../function-schemata/javascript/src/utils.js' );
const { error, makeErrorInNormalForm } = require( '../function-schemata/javascript/src/error.js' );
const { makeVoid } = require( '../function-schemata/javascript/src/utils' );
const { Invariants } = require( './Invariants.js' );

/**
 * Error class for throwing a Z22/'Evaluation response' (envelope) that
 * contains an error (in Z22K2/metadata).
 */
class ZResponseError extends Error {
	constructor( message, envelope ) {
		super( message );
		this.name = 'ZResponseError';
		this.envelope = envelope;
	}
}

class Implementation {

	constructor( Z14, ZID ) {
		this.invariants_ = null;
		this.scope_ = null;
		this.lazyVariables_ = new Set();
		this.lazyReturn_ = false;
		this.doValidate_ = true;
		this.Z14_ = Z14;
		// Persistent ID for the implementation; null if there is none
		this.ZID_ = ZID;
	}

	hasLazyVariable( variableName ) {
		return this.lazyVariables_.has( variableName );
	}

	returnsLazy() {
		return this.lazyReturn_;
	}

	getZID() {
		return this.ZID_;
	}

	getZ14() {
		return this.Z14_;
	}

	async execute( zobject, argumentList ) {
		return ZWrapper.create( await this.executeInternal( zobject, argumentList ), this.scope_ );
	}

	setScope( scope ) {
		this.scope_ = scope;
	}

	setInvariants( invariants ) {
		this.invariants_ = invariants;
	}

	setDoValidate( doValidate ) {
		this.doValidate_ = doValidate;
	}

	/**
	 * Creates and returns a function implementation for the given Z14,
	 * as an instance of one of the subclasses Composition, Evaluated,
	 * or BuiltIn.  If an error occurs, an instance of subclass
	 * ImplementationError is returned.
	 *
	 * invariants and doValidate are used locally in this method.  To set them for use
	 * in other methods, use setInvariants and setDoValidate.
	 *
	 * @param {Object} Z14 the implementation
	 * @param {Invariants} invariants
	 * @param {boolean} doValidate
	 * @return {Implementation}
	 * @throws {ZResponseError} If the call to resolve() returns an error
	 */
	static async create( Z14, invariants, doValidate = true ) {
		if ( typeof Z14 === 'undefined' ) {
			return null;
		}

		// ZID captures the persistent ID when Z14 is a Z9 / Reference,
		// for Composition and Evaluated implementations.
		// TODO( T321998 ): If an ID key is added to Z14, this can be removed
		let ZID = null;

		// We do not call validatesAsReference here. If we did, we would first
		// need to call asJSON() on Z14. This is an expensive operation if Z14
		// is not a reference. Because we are only interested in literal
		// references here, it is safe just to check whether Z9K1 is undefined.
		if ( Z14.Z9K1 !== undefined ) {
			ZID = Z14.Z9K1;
		}

		const Z14Envelope = ( await ( Z14.resolve(
			invariants, /* ignoreList= */null, /* resolveInternals= */ false, doValidate
		) ) );
		if ( responseEnvelopeContainsError( Z14Envelope ) ) {
			throw new ZResponseError( 'Error returned from call to resolve', Z14Envelope );
		}
		const resolvedZ14 = Z14Envelope.Z22K1;

		if ( resolvedZ14.Z14K4 !== undefined ) {
			const BuiltInZID = resolvedZ14.Z14K4.Z6K1;
			const builtin = builtins.getFunction( BuiltInZID );
			const lazyVariables = builtins.getLazyVariables( BuiltInZID );
			const lazyReturn = builtins.getLazyReturn( BuiltInZID );
			// eslint-disable-next-line no-use-before-define
			return new BuiltIn( resolvedZ14, BuiltInZID, builtin,
				lazyVariables, lazyReturn );
		}
		if ( resolvedZ14.Z14K2 !== undefined ) {
			// eslint-disable-next-line no-use-before-define
			return new Composition( resolvedZ14, ZID );
		}

		if ( resolvedZ14.Z14K3 !== undefined ) {
			// eslint-disable-next-line no-use-before-define
			return new Evaluated( resolvedZ14, ZID );
		}

		throw new ZResponseError( 'Implementation did not specify Z14K[234]', Z14Envelope );
	}
}

class BuiltIn extends Implementation {

	constructor( Z14, ZID, functor, lazyVariables, lazyReturn ) {
		super( Z14, ZID );
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
	executeInternal( zobject, argumentList ) {
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
		callArgs.push( this.invariants_ );
		return this.functor_( ...callArgs );
	}
}

class Evaluated extends Implementation {

	constructor( Z14, ZID ) {
		super( Z14, ZID );
	}

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
		await ( zobject.resolveKey(
			[ 'Z7K1', 'Z8K2' ], this.invariants_, /* ignoreList= */ null,
			/* resolveInternals= */ true, this.doValidate_ ) );
		const Z7K1Envelope = await ( zobject.Z7K1.resolve(
			this.invariants_, /* ignoreList= */ null,
			/* resolveInternals= */ true, this.doValidate_ ) );
		const Z7K1 = Z7K1Envelope.Z22K1;
		Z7.Z7K1 = Z7K1.asJSON();
		// TODO: Eliminate this back-and-forth ZWrapper conversion if possible.
		const Z8K4 = ZWrapper.create(
			convertItemArrayToZList( [ this.Z14_.asJSON() ] ), this.Z14_.scope_ );

		const implementation = this;

		// Implementation may need to be dereferenced.
		await traverseZList( Z8K4, async function ( tail ) {
			if ( tail.K1.Z14K3 !== undefined ) {
				await ( tail.resolveKey(
					[ 'K1', 'Z14K3', 'Z16K2' ], implementation.invariants_,
					/* ignoreList= */ null,
					/* resolveInternals= */ false, implementation.doValidate_ ) );
			}
		} );
		Z7.Z7K1.Z8K4 = Z8K4.asJSON();

		// Return type may be a function call and must be resolved to allow for serialization.
		const returnTypeEnvelope = await ( Z7K1.Z8K2.resolve(
			this.invariants_, /* ignoreList= */ null,
			/* resolveInternals= */ true, this.doValidate_ ) );
		if ( responseEnvelopeContainsError( returnTypeEnvelope ) ) {
			return returnTypeEnvelope;
		}
		Z7.Z7K1.Z8K2 = returnTypeEnvelope.Z22K1.asJSON();
		for ( const argumentDict of argumentList ) {
			Z7[ argumentDict.name ] = argumentDict.argument.asJSON();
		}

		// Get programming language from the Function Call's first Implementation.
		const programmingLanguage = Z7.Z7K1.Z8K4.K1.Z14K3.Z16K1.Z61K1.Z6K1;
		const fetchedResult = await this.invariants_.evaluatorFor(
			programmingLanguage ).evaluate( Z7 );
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
		return makeMappedResultEnvelope(
			null,
			makeErrorInNormalForm(
				error.error_in_evaluation,
				[ `Function evaluation failed with status ${statusCode}: ${errorText}` ] ) );
	}

}

class Composition extends Implementation {

	constructor( Z14, ZID ) {
		super( Z14, ZID );
		this.composition_ = Z14.Z14K2.asJSON();
	}

	async executeInternal() {
		return await ZWrapper.create( this.composition_, this.scope_ ).resolve(
			this.invariants_, /* ignoreList= */ null, /* resolveInternals= */ true,
			/* doValidate= */ this.doValidate_ );
	}

}

module.exports = { Composition, Evaluated, BuiltIn, Implementation, ZResponseError };
