'use strict';

const { isString } = require( '../function-schemata/javascript/src/utils' );

class ZWrapper {

	constructor() {
		this.names_ = new Map();
		this.scope_ = null;
	}

	static create( zobjectJSON ) {
		if ( isString( zobjectJSON ) || zobjectJSON instanceof ZWrapper ) {
			return zobjectJSON;
		}
		const result = new ZWrapper();
		for ( const key of Object.keys( zobjectJSON ) ) {
			const value = ZWrapper.create( zobjectJSON[ key ] );
			result.names_.set( key, value );
			Object.defineProperty( result, key, {
				get: function () {
					const result = this.names_.get( key );
					if ( result instanceof ZWrapper && result.getScope() === null ) {
						result.setScope( this.getScope() );
					}
					return result;
				},
				set: function ( newValue ) {
					this.names_.set( key, ZWrapper.create( newValue ) );
				}
			} );
		}
		return result;
	}

	asJSON() {
		const result = {};
		for ( const entry of this.names_.entries() ) {
			const key = entry[ 0 ];
			let value = entry[ 1 ];
			if ( value instanceof ZWrapper ) {
				value = value.asJSON();
			}
			result[ key ] = value;
		}
		return result;
	}

	keys() {
		return this.names_.keys();
	}

	getScope() {
		return this.scope_;
	}

	setScope( scope ) {
		this.scope_ = scope;
	}

}
module.exports = { ZWrapper };
