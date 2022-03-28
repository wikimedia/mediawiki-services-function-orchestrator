'use strict';

const { ArgumentState } = require( './argumentState.js' );
const { error, normalError } = require( '../function-schemata/javascript/src/error.js' );

class BaseFrame {

	constructor( lastFrame = null ) {
		this.lastFrame_ = lastFrame;
		this.names_ = new Map();
	}

	mergedCopy( otherFrame ) {
		if ( this.isEmpty() ) {
			return otherFrame.copy();
		}
		const lastFrame = this.lastFrame_.mergedCopy( otherFrame );
		const myCopy = this.copy( lastFrame );
		myCopy.lastFrame_ = lastFrame;
		return myCopy;
	}

	isEmpty() {
		return false;
	}

}

class EmptyFrame extends BaseFrame {
	constructor() {
		super();
	}

	async retrieveArgument( argumentName ) {
		return ArgumentState.ERROR(
			normalError(
				// TODO (T287919): Reconsider error type.
				[ error.invalid_key ],
				[ 'No argument called ' + argumentName + ' in scope.' ] ) );
	}

	copy() {
		return new EmptyFrame();
	}

	isEmpty() {
		return true;
	}

}

module.exports = { BaseFrame, EmptyFrame };
