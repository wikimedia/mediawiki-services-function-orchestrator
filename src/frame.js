'use strict';

const { ArgumentState } = require( './argumentState.js' );
const { error, normalError } = require( '../function-schemata/javascript/src/error.js' );

class BaseFrame {

	constructor( lastFrame = null ) {
		this.lastFrame_ = lastFrame;
		this.names_ = new Map();
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

	isEmpty() {
		return true;
	}

}

module.exports = { BaseFrame, EmptyFrame };
