'use strict';

const fetch = require( '../lib/fetch.js' );
const { error, makeErrorInNormalForm } = require( '../function-schemata/javascript/src/error.js' );
const normalize = require( '../function-schemata/javascript/src/normalize' );
const { makeWrappedResultEnvelope } = require( './utils.js' );
const { ZWrapper } = require( './ZWrapper' );
const { EmptyFrame } = require( './frame' );

class ReferenceResolver {

	constructor( wikiUri ) {
		this.wikiUri_ = wikiUri;
		this.referenceMap = new Map();
	}

	/**
	 * Gets the ZObjects of a list of ZIDs.
	 *
	 * @param {Array} ZIDs A list of ZIDs to fetch.
	 * @return {Object} An object mapping ZIDs to ZWrappers
	 */
	async dereference( ZIDs ) {
		// Importing here instead of at top-level to avoid circular reference.
		const { resolveBuiltinReference } = require( './builtins.js' );
		const unresolved = new Set( ZIDs );
		const dereferenced = new Map();

		// Resolve references to builtins directly within the orchestrator.
		for ( const ZID of unresolved ) {
			const builtin = resolveBuiltinReference( ZID );
			const previouslyDereferenced = this.referenceMap.get( ZID );
			let dereferencedZObject;
			if ( builtin !== null ) {
				dereferencedZObject = makeWrappedResultEnvelope( { Z2K1: { Z1K1: 'Z6', Z6K1: ZID }, Z2K2: builtin } );
			} else if ( previouslyDereferenced !== undefined ) {
				// stringify / parse are used here to create a deep copy. Otherwise, we'd
				// end up with circular references in some of the results here.
				// Dereferenced objects are created in an empty scope because they are not supposed
				// to refer to any local variable.
				dereferencedZObject = JSON.parse( JSON.stringify(
					previouslyDereferenced.asJSON() ) );
				dereferencedZObject = ZWrapper.create( dereferencedZObject, new EmptyFrame() );
			}
			if ( dereferencedZObject !== undefined ) {
				unresolved.delete( ZID );
				dereferenced.set( ZID, dereferencedZObject );
			}
		}

		// Otherwise, consult the wiki.
		if ( ( this.wikiUri_ !== null ) && ( unresolved.size > 0 ) ) {
			const url = new URL( this.wikiUri_ );
			url.searchParams.append( 'action', 'wikilambda_fetch' );
			url.searchParams.append( 'format', 'json' );
			url.searchParams.append( 'zids', [ ...unresolved ].join( '|' ) );

			const fetched = await fetch( url, { method: 'GET' } );
			const result = await fetched.json();

			await Promise.all( [ ...unresolved ].map( async ( ZID ) => {
				const fetchResult = result[ ZID ];
				if ( fetchResult === undefined ) {
					const Z5 = makeWrappedResultEnvelope(
						null,
						makeErrorInNormalForm(
							error.zid_not_found,
							[ ZID ]
						)
					);
					dereferenced.set( ZID, Z5 );
					this.referenceMap.set( ZID, Z5 );
					return;
				}
				const zobject = JSON.parse( fetchResult.wikilambda_fetch );
				// Dereferenced objects are created in an empty scope because they are not supposed
				// to refer to any local variable.
				const normalized =
					ZWrapper.create( normalize( zobject,
						/* generically= */true, /* withVoid= */ true ), new EmptyFrame() );
				dereferenced.set( ZID, normalized );
				this.referenceMap.set( ZID, normalized );
			} ) );
		}
		return dereferenced;
	}

}

module.exports = { ReferenceResolver };
