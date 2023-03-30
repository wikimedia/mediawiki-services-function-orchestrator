'use strict';

/**
 * Encapsulates objects which will not change over the course of a function execution.
 */
class Invariants {
	constructor( resolver, evaluators, orchestratorConfig, getRemainingTime ) {
		this.resolver_ = resolver;
		this.languageToEvaluatorIndex_ = new Map();
		this.orchestratorConfig_ = Object.freeze( orchestratorConfig );
		this.getRemainingTime_ = getRemainingTime;

		// We rely on the ordering of these evaluators, so we prohibit modifications
		// of the list.
		this.evaluators_ = Object.freeze( evaluators );
		for ( let i = 0; i < evaluators.length; ++i ) {
			const evaluator = this.evaluators_[ i ];
			for ( const programmingLanguage of evaluator.programmingLanguages ) {
				this.languageToEvaluatorIndex_.set( programmingLanguage, i );
			}
			// Evaluators need access to invariants for re-entrant calls.
			evaluator.setInvariants( this );
		}
		// Resolver wraps MediaWiki for the purpose of calling wikilambda-fetch.
		Object.defineProperty( this, 'resolver', {
			get: function () {
				return resolver;
			}
		} );
		Object.defineProperty( this, 'orchestratorConfig', {
			get: function () {
				return this.orchestratorConfig_;
			}
		} );
	}

	evaluatorFor( programmingLanguage ) {
		const evaluatorIndex = this.languageToEvaluatorIndex_.get( programmingLanguage );
		if ( evaluatorIndex === undefined ) {
			return null;
		}
		return this.evaluators_[ evaluatorIndex ];
	}

	getRemainingTime() {
		return this.getRemainingTime_();
	}
}

module.exports = { Invariants };
