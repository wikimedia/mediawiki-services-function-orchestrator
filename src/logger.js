'use strict';

const bunyan = require( 'bunyan' );

let _logger;

function getLogger() {
	if ( !_logger ) {
		setLogger( bunyan.createLogger( {
			name: 'function-orchestrator'
		} ) );
	}
	return _logger;
}

function setLogger( logger ) {
	_logger = logger;
}

module.exports = { getLogger, setLogger };
