'use strict';

const { isReference } = require('./utils.js');

async function mutate(zobject, keys, resolver) {
    if (keys.length <= 0) {
        return;
    }
    const key = keys.shift();
    let nextObject = zobject[ key ];
    if (isReference(nextObject)) {
        const refKey = nextObject.Z9K1;
        const dereferenced = await resolver.dereference([ refKey ]);
        nextObject = dereferenced[ refKey ].Z2K2;
        zobject[ key ] = nextObject;
    }
    await mutate(nextObject, keys, resolver);
}

module.exports = { mutate };
