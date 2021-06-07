'use strict';

const traverse = require('json-schema-traverse');
const { createImplementation } = require('./implementation.js');
const { Z10ToArray } = require('../function-schemata/javascript/src/utils.js');
const { error, normalError } = require('../function-schemata/javascript/src/error.js');
const { SchemaFactory } = require('../function-schemata/javascript/src/schema.js');
const { makePair } = require('./utils');

const normalFactory = SchemaFactory.NORMAL();
const Z7Validator = normalFactory.create('Z7');

const validators = {};

/**
 * Returns a validator schema for the given ZID.
 *
 * @param {string} zid the type ZID.
 * @return {Schema} a fully-initialized Schema or null if unsupported.
 */
function getSchemaValidator(zid) {
    if (validators[zid]) {
        return validators[zid];
    } else {
        const validator = normalFactory.create(zid);
        validators[zid] = validator;
        return validator;
    }
}

function createValidatorZ7(Z8, Z1) {
    // since this is a validator, we always expect a SINGLE argument (the object itself).
    const argument = Z10ToArray(Z8.Z8K1)[0];

    return {
        Z1K1: {
            Z1K1: 'Z9',
            Z9K1: 'Z7'
        },
        Z7K1: Z8,
        [argument.Z17K2.Z6K1]: Z1
    };
}

/**
 * Validates the Z1/Object against its type validator and returns an array of Z5/Error.
 *
 * @param {Object} Z1 the Z1/Object
 * @param {Object} typeZObject the type ZObject
 * @param {ReferenceResolver} resolver used to resolve references
 * @return {Array} an array of Z5/Error
 */
async function runTypeValidator(Z1, typeZObject, resolver) {
    const validatorZid = typeZObject.Z2K2.Z4K3;

    try {
        const validatorZ8 = (
            await resolver.dereference([ validatorZid.Z9K1 ])
        )[ validatorZid.Z9K1 ].Z2K2;

        // validator builtin implementation id
        const implementationId = validatorZ8.Z8K4.Z10K1.Z14K4.Z6K1;
        const implementation = createImplementation(implementationId, 'FUNCTION', null, resolver);

        const validatorZ7 = createValidatorZ7(validatorZ8, Z1);
        const result = await implementation.execute(validatorZ7);

        return Z10ToArray(result);
    } catch (err) {
        return [
            normalError(
                [error.zid_not_found],
                [`Builtin validator "${validatorZid.Z9K1}" not found for "${typeZObject.Z2K1.Z9K1}"`]
            )
        ];
    }
}

/**
 * Validates a ZObject against the function call schema.
 *
 * @param {Object} Z1 object to be validated
 * @return {bool} whether Z1 can validate as function call
 */
function isFunctionCall(Z1) {
    return new Promise((resolve, reject) => {
        if (Z7Validator.validate(Z1)) {
            resolve(Z1);
        } else {
            reject(makePair(Z1, null));
        }
    });
}

const Z6Validator = normalFactory.create('Z6');
const Z9Validator = normalFactory.create('Z9');

/**
 * Determines whether arguments is a Z6 or Z9. These two types' Z1K1s are
 * strings instead of Z9s, so some checks below need to special-case their
 * logic.
 *
 * @param {Object} Z1 a ZObject
 * @return {bool} true if Z1 validates as either Z6 or Z7
 */
function isRefOrString(Z1) {
    return Z6Validator.validate(Z1) || Z9Validator.validate(Z1);
}

/**
 * Determines whether argument is a Z9.
 *
 * @param {Object} Z1 a ZObject
 * @return {bool} true if Z1 validates as Z9
 */
function isReference(Z1) {
    return Z9Validator.validate(Z1);
}

/**
 * Utility function that traverses the given ZObject to identify all of the types contained in it
 * and return their ZObjects. The ZObjects are fetched from the database.
 *
 * @param {Object} zobject the zobject in normal.
 * @param {ReferenceResolver} resolver used to resolve references
 * @return {Object} an object mapping the ZID to the ZObject of the type.
 */
async function getContainedTypeZObjects(zobject, resolver) {
    const containedTypes = new Set();

    traverse(zobject, { allKeys: true }, (Z1) =>
      containedTypes.add(isRefOrString(Z1) ? Z1.Z1K1 : Z1.Z1K1.Z9K1)
    );

    return resolver.dereference(containedTypes);
}

/**
 * Traverses the given zobject and validates each node checking its schema and running its type
 * validator.
 *
 * @param {Object} zobject the zobject in normal form.
 * @param {ReferenceResolver} resolver used to resolve references
 * @return {Array} an array of validation errors.
 */
async function validate(zobject, resolver) {
    const errors = [];
    const validatorPromises = [];
    const ZObjectTypes = await getContainedTypeZObjects(zobject, resolver);

    traverse(zobject, { allKeys: true }, (Z1) => {
        const typeZID = isRefOrString(Z1) ? Z1.Z1K1 : Z1.Z1K1.Z9K1;
        const schemaValidator = getSchemaValidator(typeZID);

        if (!schemaValidator.validate(Z1)) {
            errors.push(
                normalError(
                    [error.not_wellformed],
                    // TODO: improve this message, maybe look at schemaValidator.errors
                    ['Invalid schema for ' + typeZID]
                )
            );
        } else {
            validatorPromises.push(runTypeValidator(Z1, ZObjectTypes[typeZID], resolver));
        }
    });

    const validatorsErrors = await Promise.all(validatorPromises);
    validatorsErrors.forEach((typeErrors) => errors.push.apply(errors, typeErrors));

    return errors;
}

module.exports = { isFunctionCall, isRefOrString, isReference, validate, normalFactory };
