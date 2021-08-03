'use strict';

const { ReferenceResolver } = require('./db.js');
const parse = require('./parse.js');
const orchestrate = require('./orchestrate.js');
const normalize = require('../function-schemata/javascript/src/normalize.js');

function parseNormalizedArray(zobject, refs = []) {
  const head = zobject.Z10K1;
  const tail = zobject.Z10K2;

  if (tail) {
    return parseNormalizedArray(tail, [...refs, head.Z9K1]);
  } else {
    return refs;
  }
}

async function getTestResults(data) {
  const {
    zfunction,
    zimplementations,
    ztesters,
    wikiUri,
    evaluatorUri,
    doValidate
  } = parse(data);

  const resolver = new ReferenceResolver(wikiUri);

  // Get ZFunction object
  const zFunction = zfunction.match(/^Z\d+$/) ? (await resolver.dereference([zfunction]))[zfunction] : await normalize(JSON.parse(zfunction));

  // Get ZImplementation objects
  // If list of implementations is provided, get those.
  // Otherwise, fetch all associated with ZFunction
  const implementations =
    zimplementations && JSON.parse(zimplementations).filter((item) => !!item).length ?
      await Promise.all(
        // Parse the list of implementations
        JSON.parse(zimplementations).map(
          (impl) => {
            // If it's an object, normalize it
            if (typeof impl === 'object') {
              return normalize(impl);
            // If it's a string, dereference it
            } else {
              return resolver.dereference([impl]).then((res) => res[impl]);
            }
          }
        )
      ) :
      // Get the list of ZImplementations, then dereference them
      await Promise.all(
        parseNormalizedArray(zFunction.Z2K2.Z8K4).map(
          (zImplementationId) => resolver.dereference([zImplementationId])
          .then((res) => res[ zImplementationId ])
        ));
  // Get ZTester objects
  // If list of testers is provided, get those.
  // Otherwise, fetch all associated with ZFunction
  const testers = ztesters && JSON.parse(ztesters).filter((item) => !!item).length ?
    await Promise.all(
      // Parse the list of testers
      JSON.parse(ztesters).map(
        (tester) => {
          // If it's an object, normalize it
          if (typeof tester === 'object') {
            return normalize(tester);
          // If it's a string, dereference it
          } else {
            return resolver.dereference([tester]).then((res) => res[tester]);
          }
        }
      )
    ) :
    // Get the list of ZTesters, then dereference them
    await Promise.all(
      parseNormalizedArray(zFunction.Z2K2.Z8K3).map(
        (zTesterId) => resolver.dereference([zTesterId])
        .then((res) => res[zTesterId])
      ));
  const validators = await resolver.dereference(
    testers.map((tester) => tester.Z2K2.Z20K2.Z9K1)
  );

  async function performTest(
    zFunction,
    zImplementation,
    zTester
  ) {
    const payload = {
      zFunctionId: zFunction.Z2K1.Z9K1,
      zImplementationId: zImplementation.Z2K1.Z9K1,
      zTesterId: zTester.Z2K1.Z9K1,
      validationResponse: null
    };

    const test = JSON.parse(JSON.stringify(zTester.Z2K2.Z20K1));
    const implementation = JSON.parse(JSON.stringify(zImplementation.Z2K2));
    const validator = JSON.parse(JSON.stringify(validators[
      zTester.Z2K2.Z20K2.Z9K1
    ].Z2K2));

    test.Z7K1 = zFunction.Z2K2;
    test.Z7K1.Z8K4 = [implementation];

    const testResponse = normalize(
      await orchestrate(
        JSON.stringify({
          zobject: test,
          evaluatorUri,
          wikiUri,
          doValidate
        })
      )
    );
    const testResult = testResponse.Z22K1;

    if (testResult === 'Z23' || testResult.Z9K1 === 'Z23') {
      payload.validationResponse = testResponse;
    } else {
      const validationArgument = validator.Z8K1.Z10K1;
      const validationPayload = {
        Z1K1: 'Z7',
        Z7K1: validator
      };
      validationPayload[validationArgument.Z17K2.Z6K1] = testResult[validationArgument.Z17K1.Z9K1 + 'K1'];

      const validationResponse = await orchestrate(JSON.stringify({
        zobject: validationPayload,
        evaluatorUri,
        wikiUri,
        doValidate
      }));

      payload.validationResponse = validationResponse;
    }

    return payload;
  }

  const tests = [];

  for (const implementation of implementations) {
    for (const tester of testers) {
      tests.push(performTest(zFunction, implementation, tester));
    }
  }

  return Promise.all(tests);
}

module.exports = getTestResults;
