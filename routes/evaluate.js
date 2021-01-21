'use strict';

const sUtil = require('../lib/util');

const orchestrate = require('../src/orchestrate.js');

/**
 * The main router object
 */
const router = sUtil.router();

/** ROUTE DECLARATIONS GO HERE **/
router.get('/:data', function (req, res) {
  const input = orchestrate(req.params.data);
  res.json(input);
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
