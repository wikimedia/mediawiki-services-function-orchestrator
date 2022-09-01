// Wrapper around node-fetch that sets a custom user-agent header and sets
// Bluebird as the Promise implementation.
// See https://github.com/node-fetch/node-fetch/issues/591#issuecomment-904170999
'use strict';

// eslint-disable-next-line node/no-restricted-require
const fetch = require( 'node-fetch' );
const Bluebird = require( 'bluebird' );
const version = require( '../package.json' ).version;

fetch.Promise = Bluebird;

module.exports = ( url, args = {} ) => {
	args.headers = args.headers || {};
	args.headers[ 'user-agent' ] = 'wikifunctions-function-orchestrator/' + version;
	return fetch( url, args );
};
