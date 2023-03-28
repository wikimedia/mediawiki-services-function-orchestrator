'use strict';

const ServiceRunner = require( 'service-runner' );

const { LoggerWrapper } = require( '../function-schemata/javascript/src/LoggerWrapper.js' );

// This is the universal logger we will use for this orchestrator
// project.
let _logger;

/**
 * Gets the universal logger for this app. It should have been
 * set during initialization, but if it somehow wasn't, a new
 * one will be created.
 *
 * Usage:
 * const { getLogger } = require( '...logger.js' );
 * const logger = getLogger()
 * logger.log('warn', 'hello this is a message');
 * logger.warn('hello this is also a message');
 *
 * @return {LoggerWrapper} The universal logger for this orchestrator app.
 */
function getLogger() {
	if ( !_logger ) {
		setLogger( ServiceRunner.getLogger( {
			name: 'function-orchestrator'
		} ) );
	}
	return _logger;
}

/**
 * Sets the universal logger for this app. It wraps the service runner logger
 * in a new object with more logging APIs.
 *
 * @param {*} logger The Service Runner logger object.
 */
function setLogger( logger ) {
	_logger = new LoggerWrapper( logger );
}

module.exports = { getLogger, setLogger };
