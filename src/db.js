'use strict';

const Bluebird = require('bluebird');
const fetch = require('node-fetch');
const { normalizePromise } = require('./utils.js');

fetch.Promise = Bluebird;

class ReferenceResolver {

    constructor(wikiUri) {
        this.wikiUri_ = wikiUri;
    }

    /**
     * Gets the ZObjects of a list of ZIDs.
     *
     * @param {Array} ZIDs A list of ZIDs to fetch.
     * @return {Object} An object mapping ZIDs to ZObjects
     */
    async dereference(ZIDs) {
        // TODO: Why is the top-level resolveBuiltinReference undefined here?
        const { resolveBuiltinReference } = require('./builtins.js');
        const unresolved = new Set(ZIDs);
        const dereferenced = {};

        // Resolve references to builtins directly within the orchestrator.
        for (const ZID of unresolved) {
            const builtin = resolveBuiltinReference(ZID);
            if (builtin !== null) {
                unresolved.delete(ZID);
                dereferenced[ ZID ] = { Z2K2: builtin };
            }
        }

        // Otherwise, consult the wiki.
        if ((this.wikiUri_ !== null) && (unresolved.size > 0)) {
            const url = new URL(this.wikiUri_);
            url.searchParams.append('action', 'wikilambda_fetch');
            url.searchParams.append('format', 'json');
            url.searchParams.append('zids', [...unresolved].join('|'));

            const fetched = await fetch(url, { method: 'GET' });
            const result = await fetched.json();

            await Promise.all([ ...unresolved ].map(async (ZID) => {
                const zobject = JSON.parse(result[ ZID ].wikilambda_fetch);
                // TODO: Catch errors when this promise rejects.
                const normalized = await normalizePromise(zobject);
                dereferenced[ZID] = normalized;
            }));
        }

        return dereferenced;
    }

}

module.exports = { ReferenceResolver };
