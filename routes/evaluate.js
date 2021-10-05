'use strict';

const sUtil = require('../lib/util');

const orchestrate = require('../src/orchestrate.js');
const getTestResults = require('../src/performTest.js');

/**
 * The main router object
 */
const router = sUtil.router();

/** ROUTE DECLARATIONS GO HERE **/
router.post('/', async function (req, res) {
	const input = await orchestrate(req.body);
	res.json(input);
});

router.get('/test/:data', async function (req, res) {
	const result = await getTestResults(req.params.data);
	res.json(result);
});

router.get('/', function (req, res) {
	res.sendStatus(200);
});

module.exports = function (appObj) {

	// the returned object mounts the routes on
	// /{domain}/vX/mount/path
	return {
		path: '/evaluate',
		api_version: 1,  // must be a number!
		router: router
	};

};
