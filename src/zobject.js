'use strict';

const { isArgumentReference, isReference } = require('./utils.js');

// TODO: Return an ArgumentState reporting errors if any form of dereferencing fails,
// otherwise successful ArgumentState.
async function mutate(zobject, keys, evaluatorUri, resolver, scope = null) {
    if (keys.length <= 0) {
        return zobject;
    }
    const key = keys.shift();
    let nextObject = zobject[ key ];
    if (isArgumentReference(nextObject) && !(isReference(nextObject)) && scope !== null) {
        const refKey = nextObject.Z18K1.Z6K1;
        const dereferenced = await scope.retrieveArgument(refKey, evaluatorUri, resolver);
        // TODO: Check for dereferenced.state==='ERROR'.
        nextObject = dereferenced.argumentDict.argument;
    } else if (isReference(nextObject)) {
        const refKey = nextObject.Z9K1;
        const dereferenced = await resolver.dereference([ refKey ]);
        nextObject = dereferenced[ refKey ].Z2K2;
        zobject[ key ] = nextObject;
    }
    return await mutate(nextObject, keys, evaluatorUri, resolver, scope);
}

module.exports = { mutate };
