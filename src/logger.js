'use strict';

const ServiceRunner = require( 'service-runner' );

/**
 * This is a wrapper for the logger provided by service runner.
 * It provides more user-friendly logging APIs and better error
 * signaling for when it is used incorrectly.
 *
 * This is the logger that other scripts in this project will interact with.
 * Usage:
 * const { getLogger } = require( '...logger.js' );
 * const logger = getLogger()
 * logger.log('warn', 'hello this is a message');
 * logger.warn('hello this is also a message');
 */
class LoggerWrapper {
	constructor( logger ) {
		this._logger = logger;
	}

	/**
	 * Logs a message on a given severity level.
	 * Acceptable levels: trace, debug, info, warn, error, and fatal.
	 *
	 * @param {string} level Severity level and components.
	 *     Level options: trace, debug, info, warn, error, and fatal.
	 *     E.g. trace or trace/request.
	 * @param {string} msg A string message for the log.
	 */
	log( level, msg ) {
		if ( !level || !msg ) {
			// The service runner implementation will just silently no-op
			// in this situation. We want to alert the caller here.
			throw new Error(
				`Incorrect usage of the logger. Both arguments need to be
				present. E.g. logger.log(level, msg). Alternatively you can
				use the logger.level() API.` );
		}
		this._logger.log( level, msg );
	}

	/**
	 * Logs a tracing message.
	 *
	 * @param {string} msg Trace message.
	 */
	trace( msg ) {
		this.log( 'trace', msg );
	}

	/**
	 * Logs a debug message.
	 *
	 * @param {string} msg Debug message.
	 */
	debug( msg ) {
		this.log( 'debug', msg );
	}

	/**
	 * Logs a info message.
	 *
	 * @param {string} msg Info message.
	 */
	info( msg ) {
		this.log( 'info', msg );
	}

	/**
	 * Logs a warning message.
	 *
	 * @param {string} msg Warning message.
	 */
	warn( msg ) {
		this.log( 'warn', msg );
	}

	/**
	 * Logs a error message.
	 *
	 * @param {string} msg Error message.
	 */
	error( msg ) {
		this.log( 'error', msg );
	}

	/**
	 * Logs a fatal message.
	 *
	 * @param {string} msg Fatal message.
	 */
	fatal( msg ) {
		this.log( 'fatal', msg );
	}

	/**
	 * Creates a child logger for a sub-component of your application.
	 * This directly wraps its core logger obj's implementation.
	 *
	 * @param {*} args arguments for the child wrapper.
	 * @return {LoggerWrapper} A new logger for the sub-component.
	 */
	child( args ) {
		return new LoggerWrapper( this._logger.child( args ) );
	}
}

// This is the universal logger we will use for this orchestrator
// project.
let _logger;

/**
 * Gets the universal logger for this app. It should have been
 * set during initialization, but if it somehow wasn't, a new
 * one will be created.
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
