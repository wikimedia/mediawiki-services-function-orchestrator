'use strict';

const fs = require('fs');
const sUtil = require('../lib/util');
const yaml = require('js-yaml');

/**
 * The main router object
 */
const router = sUtil.router();

/**
 * GET /spec/:ZID
 * Retrieves the JSON schema corresponding to a ZObject type given by ZID.
 */
router.get('/spec/:ZID(Z\\d+)', function (req, res) {
    const specFile = `${__dirname}/../function-schemata/data/NORMAL/${req.params.ZID}.yaml`;
    if (!fs.existsSync(specFile)) {
        res.status(404).end(`No specification exists for ${req.params.ZID}.`);
        return;
    }
    const contents = fs.readFileSync(specFile, { encoding: 'utf8' });
    const regex = /(Z\d+)#/g;
    // TODO: Find a cleaner way to do this, perhaps by changing the IDs in
    // function-schemata.
    const withReferences = contents.replace(regex, '/spec/$1#');
    res.json(yaml.safeLoad(withReferences));
});

module.exports = (appObj) => {

    return {
        path: '/',
        skip_domain: true,
        router
    };

};
