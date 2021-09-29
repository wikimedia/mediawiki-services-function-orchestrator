'use strict';

const { isArgumentReference, isFunctionCall, isGenericType, isReference, isType } = require('./utils.js');
const { isUserDefined } = require('../function-schemata/javascript/src/utils');

// TODO: Return an ArgumentState reporting errors if any form of dereferencing fails,
// otherwise successful ArgumentState.
// TODO: Collapse functionality shared with src/execute.js:Frame::processArgument
// into a single function.
async function mutate(zobject, keys, evaluatorUri, resolver, scope = null) {
    const { execute } = require('./execute.js');
    if (keys.length <= 0) {
        return zobject;
    }
    const key = keys.shift();
    let nextObject = zobject[ key ];
    while (true) {
        if (isArgumentReference(nextObject) && !(isReference(nextObject)) && scope !== null) {
            const refKey = nextObject.Z18K1.Z6K1;
            const dereferenced = await scope.retrieveArgument(refKey, evaluatorUri, resolver);
            // TODO: Check for dereferenced.state==='ERROR'.
            nextObject = dereferenced.argumentDict.argument;
            continue;
        }
        // TODO: isUserDefined call here is only an optimization/testing
        // expedient; it would be better to pre-populate the cache with builtin
        // types.
        if (isReference(nextObject) && isUserDefined(nextObject.Z9K1)) {
            const refKey = nextObject.Z9K1;
            const dereferenced = await resolver.dereference([ refKey ]);
            nextObject = dereferenced[ refKey ].Z2K2;
            zobject[ key ] = nextObject;
            continue;
        }
        if (isFunctionCall(nextObject)) {
            // TODO: Do we need to make the local keys global?
            const Z22 = await execute(nextObject, evaluatorUri, resolver, scope);
            /*
             * TODO:
             * if (containsError(Z22)) {
             *   return ArgumentState.ERROR(Z22.Z22K2);
             * }
             */
            nextObject = Z22.Z22K1;
            zobject[ key ] = nextObject;
            continue;
        }
        if (isGenericType(nextObject)) {
            // TODO: Do we need to make the local keys global?
            const Z4 = await mutate(nextObject, [ 'Z1K1' ], evaluatorUri, resolver, scope);
            if (!isType(Z4)) {
                // TODO(T287919): Is this an argument type mismatch?
                /*
                 * TODO:
                 * return ArgumentState.ERROR(
                 *   normalError(
                 *     [error.argument_type_mismatch],
                 *     ['Generic type function did not return a Z4: ' + JSON.stringify(argument)]));
                 */
            }
            nextObject.Z1K1 = Z4;
            continue;
        }
        break;
    }
    return await mutate(nextObject, keys, evaluatorUri, resolver, scope);
}

module.exports = { mutate };
