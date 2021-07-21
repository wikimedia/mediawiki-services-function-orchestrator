'use strict';

const { isArgumentReference, isReference } = require('./utils.js');

async function mutate(zobject, keys, resolver, scope = null) {
    if (keys.length <= 0) {
        return zobject;
    }
    const key = keys.shift();
    let nextObject = zobject[ key ];
    if (isArgumentReference(nextObject) && !(isReference(nextObject)) && scope !== null) {
        const refKey = nextObject.Z18K1.Z6K1;
        const dereferenced = scope.retrieveArgument(refKey);
        nextObject = dereferenced;
    } else if (isReference(nextObject)) {
        const refKey = nextObject.Z9K1;
        const dereferenced = await resolver.dereference([ refKey ]);
        nextObject = dereferenced[ refKey ].Z2K2;
        zobject[ key ] = nextObject;
    }
    return await mutate(nextObject, keys, resolver);
}

module.exports = { mutate };
