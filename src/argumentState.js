'use strict';

class ArgumentState {

	constructor() {
		this.state = null;
		this.argumentDict = null;
		this.error = null;
	}

	static UNEVALUATED( argumentDict ) {
		const result = new ArgumentState();
		result.argumentDict = argumentDict;
		result.state = 'UNEVALUATED';
		return result;
	}

	static EVALUATED( argumentDict ) {
		const result = new ArgumentState();
		result.argumentDict = argumentDict;
		result.state = 'EVALUATED';
		return result;
	}

	static ERROR( error ) {
		const result = new ArgumentState();
		result.error = error;
		result.state = 'ERROR';
		return result;
	}

}

module.exports = { ArgumentState };
