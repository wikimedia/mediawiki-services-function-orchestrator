'use strict';

const preq   = require('preq');
const assert = require('../../utils/assert.js');
const Server = require('../../utils/server.js');
const { canonicalError, error } = require('../../../function-schemata/javascript/src/error');
const canonicalize = require('../../../function-schemata/javascript/src/canonicalize.js');
const utils = require('../../../src/utils.js');
const { readJSON } = require('../../utils/read-json.js');

describe('orchestration endpoint', function () {

    this.timeout(20000);

    let uri = null;
    const server = new Server();

    before(() => {
        return server.start()
        .then(() => {
            uri =  `${server.config.uri}wikifunctions.org/v1/evaluate/`;
        });
    });

    after(() => server.stop());

    const testFunctionCall = function (name, input, output = null, error = null) {
        if (output !== null) {
            try {
                output = canonicalize(output);
            } catch (err) { }
        }
        if (error !== null) {
            try {
                error = canonicalize(error);
            } catch (err) { }
        }
        it('orchestration endpoint: ' + name, function () {
            return preq.post({
                uri: uri,
                headers: {
                    'content-type': 'application/json'
                },
                body: typeof input === 'string' ? { zobject: input } : input
            })
            .then(function (res) {
                assert.status(res, 200);
                assert.contentType(res, 'application/json');
                assert.deepEqual(
                    res.body,
                    utils.makePair(output, error, /* canonical= */ true),
                    name
                );
            });
        });
    };

    const test = function (name, input, output = null, error = null) {
        return testFunctionCall(name, input, output, error);
    };

    const testString = function (name, input, output = null, error = null) {
        return testFunctionCall(name, input, output, error);
    };

    test(
      'well-formed empty Z6 string',
      { Z1K1: 'Z6', Z6K1: '' },
      null,
      readJSON('./test/features/v1/test_data/error-not-fn.json')
    );

    test(
      'return string literal',
      { Z1K1: 'Z6', Z6K1: 'Hello' },
      null,
      readJSON('./test/features/v1/test_data/error-not-fn.json')
    );

    test(
      'return string literal with space',
      { Z1K1: 'Z6', Z6K1: 'Hello World!' },
      null,
      readJSON('./test/features/v1/test_data/error-not-fn.json')
    );

    test(
      'empty Z6 string',
      '',
      null,
      readJSON('./test/features/v1/test_data/error-not-fn.json')
    );

    test(
      'messy string',
      'This is a [basic] complicated test {string}!',
      null,
      readJSON('./test/features/v1/test_data/error-not-fn.json')
    );
    // TODO: what about quotes in strings, tabulators and new lines?

    test(
        'empty list',
        [],
        null,
        readJSON('./test/features/v1/test_data/error-not-fn.json')
    );

    test(
        'string singleton list',
        [ 'Test' ],
        null,
        readJSON('./test/features/v1/test_data/error-not-fn.json')
    );

    test(
        'string multiple list',
        [ 'Test', 'Test2', 'Test3' ],
        null,
        readJSON('./test/features/v1/test_data/error-not-fn.json')
    );

    test(
        'record singleton list',
        [ { Z1K1: 'Z60', Z2K1: 'Test' } ],
        null,
        readJSON('./test/features/v1/test_data/error-not-fn.json')
    );

    // TODO: Don't rely on JSON.stringify's default behavior; test parsed version of error string.
    test(
        'record with list and invalid sub-record',
        { Z1K1: 'Z8', K2: [ 'Test', 'Second test' ], Z2K1: { K2: 'Test' } },
        null,
        canonicalError(
            [error.not_wellformed],
            ['{"Z1K1":"Z8","K2":["Test","Second test"],"Z2K1":{"K2":"Test"}}']
        )
    );

    // TODO: Don't rely on JSON.stringify's default behavior; test parsed version of error string.
    test(
        'invalid zobject (int not string/list/record)',
        { Z1K1: 'Z2', Z2K1: 2 },
        null,
        canonicalError(
            [error.not_wellformed],
            ['{"Z1K1":"Z2","Z2K1":2}']
        )
    );

    // TODO: Don't rely on JSON.stringify's default behavior; test parsed version of error string.
    test(
        'invalid zobject (float not string/list/record)',
        { Z1K1: 'Z2', Z2K1: 2.0 },
        null,
        canonicalError(
            [error.not_wellformed],
            ['{"Z1K1":"Z2","Z2K1":2}']
        )
    );

    // TODO: Don't rely on JSON.stringify's default behavior; test parsed version of error string.
    test(
        'number in array',
        [ 2 ],
        null,
        canonicalError(
            [error.not_wellformed],
            ['[2]']
        )
    );

    // Parser

    testString('simple string parsed', '"test"', null, readJSON('./test/features/v1/test_data/error-not-fn.json'));

    testString('empty string', '""', null, readJSON('./test/features/v1/test_data/error-not-fn.json'));

    test('escaped empty string', '""', null, readJSON('./test/features/v1/test_data/error-not-fn.json'));

    testString(
      'well formed Z6 string',
      '{ "Z1K1": "Z6", "Z6K1": "" }',
      null,
      readJSON('./test/features/v1/test_data/error-not-fn.json')
    );

    // TODO: testString('empty', '', ...);

    testString(
      'messy string',
      '"This is a [basic] complicated test {string}!"',
      null,
      readJSON('./test/features/v1/test_data/error-not-fn.json')
    );
    // TODO: what about quotes in strings, tabulators and new lines?

    testString('string empty list', '[]', null, readJSON('./test/features/v1/test_data/error-not-fn.json'));

    testString('string singleton list', '["Test"]', null, readJSON('./test/features/v1/test_data/error-not-fn.json'));

    // Tests function calls.
    testFunctionCall(
        'function call for Z802 with reference to Z902',
        { zobject: readJSON('./test/features/v1/test_data/Z802_false.json') },
        readJSON('./test/features/v1/test_data/Z902_false_expected.json')
    );

    testFunctionCall(
        'function call for the false Z902 (if), the dissembler',
        { zobject: readJSON('./test/features/v1/test_data/Z902_false.json') },
        readJSON('./test/features/v1/test_data/Z902_false_expected.json')
    );

    testFunctionCall(
        'function call for the true Z902 (if), the good if',
        { zobject: readJSON('./test/features/v1/test_data/Z902_true.json') },
        readJSON('./test/features/v1/test_data/Z902_true_expected.json')
    );

    testFunctionCall(
        'function call for Z803 with reference to Z903',
        { zobject: readJSON('./test/features/v1/test_data/Z903.json') },
        {
            Z1K1: 'Z6',
            Z6K1: 'funicle'
        }
    );

    testFunctionCall(
        'function call for Z903 (value by key)',
        { zobject: readJSON('./test/features/v1/test_data/Z903.json') },
        {
            Z1K1: 'Z6',
            Z6K1: 'funicle'
        }
    );

    testFunctionCall(
        'function call for Z805 with reference to Z905',
        { zobject: readJSON('./test/features/v1/test_data/Z805.json') },
        readJSON('./test/features/v1/test_data/Z905_expected.json')
    );

    testFunctionCall(
        'function call for Z905 (reify)',
        { zobject: readJSON('./test/features/v1/test_data/Z905.json') },
        readJSON('./test/features/v1/test_data/Z905_expected.json')
    );

    testFunctionCall(
        'function call for Z808 with reference to Z908',
        { zobject: readJSON('./test/features/v1/test_data/Z808.json') },
        readJSON('./test/features/v1/test_data/Z908_expected.json')
    );

    testFunctionCall(
        'function call for Z908 (abstract)',
        { zobject: readJSON('./test/features/v1/test_data/Z908.json') },
        readJSON('./test/features/v1/test_data/Z908_expected.json')
    );

    testFunctionCall(
        'function call for Z810 with reference to Z910',
        { zobject: readJSON('./test/features/v1/test_data/Z810.json') },
        readJSON('./test/features/v1/test_data/Z910_expected.json')
    );

    testFunctionCall(
        'function call for Z910 (cons)',
        { zobject: readJSON('./test/features/v1/test_data/Z910.json') },
        readJSON('./test/features/v1/test_data/Z910_expected.json')
    );

    testFunctionCall(
        'function call for Z811 with reference to Z911',
        { zobject: readJSON('./test/features/v1/test_data/Z811.json') },
        { Z1K1: 'Z6', Z6K1: 'arbitrary ZObject' }
    );

    testFunctionCall(
        'function call for Z911 (head)',
        { zobject: readJSON('./test/features/v1/test_data/Z911.json') },
        { Z1K1: 'Z6', Z6K1: 'arbitrary ZObject' }
    );

    testFunctionCall(
        'function call for Z911 (head) with empty Z10',
        { zobject: readJSON('./test/features/v1/test_data/Z911_empty.json') },
        null,
        { Z1K1: 'Z5', Z5K1: { Z1K1: 'Z506', Z506K1: 'An empty list has no head.' } }
    );

    testFunctionCall(
        'function call for Z812 with reference to Z912',
        { zobject: readJSON('./test/features/v1/test_data/Z812.json') },
        {
            Z1K1: { Z1K1: 'Z9', Z9K1: 'Z10' },
            Z10K1: { Z1K1: 'Z6', Z6K1: 'specific ZObject' },
            Z10K2: {
                Z1K1: { Z1K1: 'Z9', Z9K1: 'Z10' }
            }
        }
    );

    testFunctionCall(
        'function call for Z912 (tail)',
        { zobject: readJSON('./test/features/v1/test_data/Z912.json') },
        {
            Z1K1: { Z1K1: 'Z9', Z9K1: 'Z10' },
            Z10K1: { Z1K1: 'Z6', Z6K1: 'specific ZObject' },
            Z10K2: {
                Z1K1: { Z1K1: 'Z9', Z9K1: 'Z10' }
            }
        }
    );

    testFunctionCall(
        'function call for Z912 (tail) with empty Z10',
        { zobject: readJSON('./test/features/v1/test_data/Z912_empty.json') },
        null,
        { Z1K1: 'Z5', Z5K1: { Z1K1: 'Z506', Z506K1: 'An empty list has no tail.' } }
    );

    // TODO: Enable test using ./test/features/v1/test_data/Z913_Z13.json once
    // Z13 validates as a Z10.
    testFunctionCall(
        'function call for Z813 with reference to Z913',
        { zobject: readJSON('./test/features/v1/test_data/Z813_empty_Z10.json') },
        { Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z41' } }
    );

    testFunctionCall(
        'function call for Z913 (empty) with an empty Z10',
        { zobject: readJSON('./test/features/v1/test_data/Z913_empty_Z10.json') },
        { Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z41' } }
    );

    testFunctionCall(
        'function call for Z913 (empty) with a full Z10',
        { zobject: readJSON('./test/features/v1/test_data/Z913_full_Z10.json') },
        { Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z42' } }
    );

    testFunctionCall(
        'function call for Z821 with reference to Z921',
        { zobject: readJSON('./test/features/v1/test_data/Z821.json') },
        { Z1K1: { Z1K1: 'Z9', Z9K1: 'Z10' } }
    );

    testFunctionCall(
        'function call for Z921 (first)',
        { zobject: readJSON('./test/features/v1/test_data/Z921.json') },
        { Z1K1: { Z1K1: 'Z9', Z9K1: 'Z10' } }
    );

    testFunctionCall(
        'function call for Z822 with reference to Z922',
        { zobject: readJSON('./test/features/v1/test_data/Z822.json') },
        { Z1K1: 'Z9', Z9K1: 'Z10' }
    );

    testFunctionCall(
        'function call for Z922 (second)',
        { zobject: readJSON('./test/features/v1/test_data/Z922.json') },
        { Z1K1: 'Z9', Z9K1: 'Z10' }
    );

    testFunctionCall(
        'function call for Z868 with reference to Z968',
        { zobject: readJSON('./test/features/v1/test_data/Z868.json') },
        readJSON('./test/features/v1/test_data/Z968_expected.json')
    );

    testFunctionCall(
        'function call for Z968 (string to code points)',
        { zobject: readJSON('./test/features/v1/test_data/Z968.json') },
        readJSON('./test/features/v1/test_data/Z968_expected.json')
    );

    testFunctionCall(
        'function call for Z968 (string to code points) with combined Emoji',
        { zobject: readJSON('./test/features/v1/test_data/Z968_emoji.json') },
        readJSON('./test/features/v1/test_data/Z968_emoji_expected.json')
    );

    testFunctionCall(
        'function call for Z886 with reference to Z986',
        { zobject: readJSON('./test/features/v1/test_data/Z886.json') },
        { Z1K1: 'Z6', Z6K1: 'mus' }
    );

    testFunctionCall(
        'function call for Z986 (code points to string)',
        { zobject: readJSON('./test/features/v1/test_data/Z986.json') },
        { Z1K1: 'Z6', Z6K1: 'mus' }
    );

    testFunctionCall(
        'function call for Z986 (code points to string) with combining characters',
        { zobject: readJSON('./test/features/v1/test_data/Z986_emoji.json') },
        readJSON('./test/features/v1/test_data/Z986_emoji_expected.json')
    );

    testFunctionCall(
        'function call for Z888 with reference to Z988',
        { zobject: readJSON('./test/features/v1/test_data/Z888_same.json') },
        { Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z41' } }
    );

    testFunctionCall(
        'function call for Z988 (same), and the arguments are truly same',
        { zobject: readJSON('./test/features/v1/test_data/Z988_same.json') },
        { Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z41' } }
    );

    testFunctionCall(
        'function call for Z988 (same), and lo, they are not same',
        { zobject: readJSON('./test/features/v1/test_data/Z988_different.json') },
        { Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z42' } }
    );

    testFunctionCall(
        'function call for Z899 with reference to Z999',
        { zobject: readJSON('./test/features/v1/test_data/Z899.json') },
        { Z1K1: 'Z9', Z9K1: 'Z10' }
    );

    testFunctionCall(
        'function call for Z999 (unquote)',
        { zobject: readJSON('./test/features/v1/test_data/Z999.json') },
        { Z1K1: 'Z9', Z9K1: 'Z10' }
    );

    testFunctionCall(
      'non-normalized function call with array',
      { zobject: readJSON('./test/features/v1/test_data/Z988_different_non-normalized.json') },
      { Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z42' } }
    );

    testFunctionCall(
      'composition',
      { zobject: readJSON('./test/features/v1/test_data/composition.json') },
      { Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z42' } }
    );

    testFunctionCall(
      'composition consisting of an argument reference',
      { zobject: readJSON('./test/features/v1/test_data/composition_arg_only.json') },
      { Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z41' } }
    );

    testFunctionCall(
      'composition consisting of an argument reference again',
      { zobject: readJSON('./test/features/v1/test_data/composition_arg_only_false.json') },
      { Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z9', Z9K1: 'Z42' } }
    );

    /*
     * TODO: Enable when mocking works.
    */

    /*
     * TODO: Enable when running evaluator at localhost:6927 as local E2E test.
    testFunctionCall(
      'evaluated function call',
      {
          zobject: readJSON('./test/features/v1/test_data/evaluated.json'),
          evaluatorUri: 'http://localhost:6927/en.wikipedia.org/v1/evaluate',
          doValidate: false
      },
      { Z1K1: 'Z6', Z6K1: '13' }
    );
    */

});
