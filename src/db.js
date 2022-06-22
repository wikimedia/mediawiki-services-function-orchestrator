'use strict';

const Bluebird = require( 'bluebird' );
const fetch = require( 'node-fetch' );
const normalize = require( '../function-schemata/javascript/src/normalize' );
const { containsError } = require( './utils.js' );
const { ZWrapper } = require( './ZWrapper' );
const { getError } = require( '../function-schemata/javascript/src/utils.js' );
const { EmptyFrame } = require( './frame' );

fetch.Promise = Bluebird;

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
		const dereferenced = {};

		// Resolve references to builtins directly within the orchestrator.
		for ( const ZID of unresolved ) {
			const builtin = resolveBuiltinReference( ZID );
			const previouslyDereferenced = this.referenceMap.get( ZID );
			let dereferencedZObject;
			if ( builtin !== null ) {
				dereferencedZObject = { Z2K1: { Z1K1: 'Z6', Z6K1: ZID }, Z2K2: builtin };
			} else if ( previouslyDereferenced !== undefined ) {
				dereferencedZObject = previouslyDereferenced.asJSON();
			}
			if ( dereferencedZObject !== undefined ) {
				unresolved.delete( ZID );
				// stringify / parse are used here to create a deep copy. Otherwise, we'd
				// end up with circular references in some of the results here.
				// Dereferenced objects are created in an empty scope because they are not supposed
				// to refer to any local variable.
				dereferenced[ ZID ] = ZWrapper.create(
					JSON.parse( JSON.stringify( dereferencedZObject ) ), new EmptyFrame() );
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
				const zobject = JSON.parse( result[ ZID ].wikilambda_fetch );
				// Dereferenced objects are created in an empty scope because they are not supposed
				// to refer to any local variable.
				const normalized =
					ZWrapper.create( await normalize( zobject,
						/* generically= */true, /* withVoid= */ true ), new EmptyFrame() );
				// TODO (T304971): We should include the entire Z22 in the result.
				// We should also generate Z22s when the call to the wiki fails.
				// Given that the wiki will return no results if any single ZID
				// fails, we should provisionally consider making separate calls
				// to the wiki for each ZID.
				if ( containsError( normalized ) ) {
					dereferenced[ ZID ] = getError( normalized );
				} else {
					dereferenced[ ZID ] = normalized.Z22K1;
				}
				this.referenceMap.set( ZID, dereferenced[ ZID ] );
			} ) );
		}
		return dereferenced;
	}

}

module.exports = { ReferenceResolver };
