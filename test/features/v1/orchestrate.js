'use strict';

const fs = require('fs');
const preq   = require('preq');
const assert = require('../../utils/assert.js');
const Server = require('../../utils/server.js');
const { canonicalError, error } = require('../../../function-schemata/javascript/src/error');

describe('orchestrate', function () {

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

    const testString = function (name, input, output) {
        it(name, function () {
            return preq.get(
                uri + encodeURIComponent(input)
            )
            .then(function (res) {
                assert.status(res, 200);
                assert.contentType(res, 'application/json');
                assert.deepEqual(res.body, output, name);
            });
        });
    };

    const test = function (name, input, output) {
      return testString(name, JSON.stringify(input), output);
    };

    test(
      'well-formed empty Z6 string',
      { Z1K1: 'Z6', Z6K1: '' },
      { Z1K1: 'Z6', Z6K1: '' }
    );

    test(
      'return string literal',
      { Z1K1: 'Z6', Z6K1: 'Hello' },
      { Z1K1: 'Z6', Z6K1: 'Hello' }
    );

    test(
      'return string literal with space',
      { Z1K1: 'Z6', Z6K1: 'Hello World!' },
      { Z1K1: 'Z6', Z6K1: 'Hello World!' }
    );

    test(
      'empty Z6 string',
      '',
      ''
    );

    test(
      'messy string',
      'This is a [basic] complicated test {string}!',
      'This is a [basic] complicated test {string}!'
    );
    // TODO: what about quotes in strings, tabulators and new lines?

    test(
      'empty list',
      [],
      []
    );

    test(
      'string singleton list',
      [ 'Test' ],
      [ 'Test' ]
    );

    test(
      'string multiple list',
      [ 'Test', 'Test2', 'Test3' ],
      [ 'Test', 'Test2', 'Test3' ]
    );

    test(
      'record singleton list',
      [ { Z1K1: 'Z60', Z2K1: 'Test' } ],
      [ { Z1K1: 'Z60', Z2K1: 'Test' } ]
    );

    test(
      'record multiple list with error',
      [ { Z1K1: 'Z6', Z2K1: 'Test' }, { Z1K1: 'Test2!', Z2K1: 'Test2?' } ],
      canonicalError(
        [error.not_wellformed, error.array_element_not_well_formed],
        [
          '1',
          canonicalError(
            [error.not_wellformed, error.z1k1_must_not_be_string_or_array],
            [{ Z1K1: 'Test2!', Z2K1: 'Test2?' }]
          )
        ]
      )
    );

    test(
      'record multiple list',
      [ { Z1K1: 'Z60', Z2K1: 'Test' }, { Z1K1: { Z1K1: 'Z7', Z7K1: 'Z10' }, Z2K1: 'Test2?' } ],
      [ { Z1K1: 'Z60', Z2K1: 'Test' }, { Z1K1: { Z1K1: 'Z7', Z7K1: 'Z10' }, Z2K1: 'Test2?' } ]
    );

    test(
      'invalid record singleton list',
      [ { Z2K1: 'Test' } ],
      canonicalError(
        [error.not_wellformed, error.array_element_not_well_formed],
        [
          '0',
          canonicalError([error.not_wellformed, error.missing_type], [{ Z2K1: 'Test' }])
        ]
      )
    );

    test(
      'empty record',
      {},
      canonicalError([error.not_wellformed, error.missing_type], [{}])
    );

    test(
      'singleton string record no Z1K1',
      { Z2K1: 'Test' },
      canonicalError([error.not_wellformed, error.missing_type], [{ Z2K1: 'Test' }])
    );

    test(
      'singleton string record invalid key',
      { 'Z1K ': 'Z1' },
      canonicalError([error.not_wellformed, error.missing_type], [{ 'Z1K ': 'Z1' }])
    );

    test(
      'string record with short key',
      { Z1K1: 'Z6', K1: 'Test' },
      { Z1K1: 'Z6', K1: 'Test' }
    );

    test(
      'string record with invalid key',
      { Z1K1: 'Z6', ZK1: 'Test' },
      canonicalError([error.not_wellformed, error.invalid_key], ['ZK1'])
    );

    test(
      'record with list and sub-record',
      { Z1K1: 'Z8', K2: [ 'Test', 'Second test' ], Z2K1: { Z1K1: 'Z60', K2: 'Test' } },
      { Z1K1: 'Z8', K2: [ 'Test', 'Second test' ], Z2K1: { Z1K1: 'Z60', K2: 'Test' } }
    );

    test(
      'record with list and invalid sub-record',
      { Z1K1: 'Z8', K2: [ 'Test', 'Second test' ], Z2K1: { K2: 'Test' } },
      canonicalError(
        [error.not_wellformed, error.not_wellformed_value],
        [
          'Z2K1',
          canonicalError([error.not_wellformed, error.missing_type], [{ K2: 'Test' }])
        ]
      )
    );

    test(
      'invalid zobject (int not string/list/record)',
      { Z1K1: 'Z2', Z2K1: 2 },
      canonicalError(
        [error.not_wellformed, error.not_wellformed_value],
        [
          'Z2K1',
          canonicalError(
            [
              error.not_wellformed,
              error.zobject_must_not_be_number_or_boolean_or_null
            ],
            [2]
          )
        ]
      )
    );

    test(
      'invalid zobject (float not string/list/record)',
      { Z1K1: 'Z2', Z2K1: 2.0 },
      canonicalError(
        [error.not_wellformed, error.not_wellformed_value],
        [
          'Z2K1',
          canonicalError(
            [
              error.not_wellformed,
              error.zobject_must_not_be_number_or_boolean_or_null
            ],
            [2.0]
          )
        ]
      )
    );

    test(
      'number in array',
      [ 2 ],
      canonicalError(
        [error.not_wellformed, error.array_element_not_well_formed],
        [
          '0',
          canonicalError(
            [
              error.not_wellformed,
              error.zobject_must_not_be_number_or_boolean_or_null
            ],
            [2]
          )
        ]
      )
    );

    // Parser

    testString('simple string parsed', '"test"', 'test');

    testString(
      'invalid JSON',
      '{ bad JSON! Tut, tut.',
      canonicalError(
        [error.syntax_error],
        [
          'Unexpected token b in JSON at position 2',
          '{ bad JSON! Tut, tut.'
        ]
      )
    );

    testString('empty string', '""', '');

    test('escapted empty string', '""', '""');

    testString(
      'well formed Z6 string',
      '{ "Z1K1": "Z6", "Z6K1": "" }',
      { Z1K1: 'Z6', Z6K1: '' }
    );

    testString(
      'just word',
      'Test',
      canonicalError(
        [error.syntax_error],
        [
          'Unexpected token T in JSON at position 0',
          'Test'
        ]
      )
    );

    // TODO: testString('empty', '', ...);

    testString(
      'messy string',
      '"This is a [basic] complicated test {string}!"',
      'This is a [basic] complicated test {string}!'
    );
    // TODO: what about quotes in strings, tabulators and new lines?

    testString('empty list', '[]', []);

    testString('string singleton list', '["Test"]', [ 'Test' ]);

    testString('multiple list', '["Test", [] , "3"]', [ 'Test', [], '3' ]);

    function readJSON(fileName) {
        return JSON.parse(fs.readFileSync(fileName, { encoding: 'utf8' }));
    }

    // Tests function calls.
    test(
        'function call for the true Z902 (if), the good if',
        readJSON('./test/features/v1/test_data/Z902_true.json'),
        readJSON('./test/features/v1/test_data/Z902_true_expected.json')
    );

    test(
        'function call for the false Z902 (if), the dissembler',
        readJSON('./test/features/v1/test_data/Z902_false.json'),
        readJSON('./test/features/v1/test_data/Z902_false_expected.json')
    );

    test(
        'function call for Z903 (value by key)',
        readJSON('./test/features/v1/test_data/Z903.json'),
        {
            Z1K1: 'Z6',
            Z6K1: 'funicle'
        }
    );

    test(
        'function call for Z905 (reify)',
        readJSON('./test/features/v1/test_data/Z905.json'),
        readJSON('./test/features/v1/test_data/Z905_expected.json')
    );

    test(
        'function call for Z908 (abstract)',
        readJSON('./test/features/v1/test_data/Z908.json'),
        readJSON('./test/features/v1/test_data/Z908_expected.json')
    );

    test(
        'function call for Z910 (cons)',
        readJSON('./test/features/v1/test_data/Z910.json'),
        readJSON('./test/features/v1/test_data/Z910_expected.json')
    );

    test(
        'function call for Z911 (head)',
        readJSON('./test/features/v1/test_data/Z911.json'),
        { Z1K1: 'Z6', Z6K1: 'arbitrary ZObject' }
    );

    test(
        'function call for Z912 (tail)',
        readJSON('./test/features/v1/test_data/Z912.json'),
        {
            Z1K1: { Z1K1: 'Z9', Z9K1: 'Z10' },
            Z10K1: { Z1K1: 'Z6', Z6K1: 'specific ZObject' },
            Z10K2: {
                Z1K1: { Z1K1: 'Z9', Z9K1: 'Z10' }
            }
        }
    );

    // TODO: Enable test using ./test/features/v1/test_data/Z913_Z13.json once
    // Z13 validates as a Z10.
    test(
        'function call for Z913 (empty) with an empty Z10',
        readJSON('./test/features/v1/test_data/Z913_empty_Z10.json'),
        { Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z6', Z6K1: 'Z41' } }
    );

    test(
        'function call for Z913 (empty) with a full Z10',
        readJSON('./test/features/v1/test_data/Z913_full_Z10.json'),
        { Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z6', Z6K1: 'Z42' } }
    );

    test(
        'function call for Z921 (first)',
        readJSON('./test/features/v1/test_data/Z921.json'),
        { Z1K1: { Z1K1: 'Z9', Z9K1: 'Z10' } }
    );

    test(
        'function call for Z922 (second)',
        readJSON('./test/features/v1/test_data/Z922.json'),
        { Z1K1: 'Z9', Z9K1: 'Z10' }
    );

    test(
        'function call for Z968 (string to characters)',
        readJSON('./test/features/v1/test_data/Z968.json'),
        readJSON('./test/features/v1/test_data/Z968_expected.json')
    );

    test(
        'function call for Z986 (characters to string)',
        readJSON('./test/features/v1/test_data/Z986.json'),
        { Z1K1: 'Z6', Z6K1: 'mus' }
    );

    test(
        'function call for Z988 (same), and the arguments are truly same',
        readJSON('./test/features/v1/test_data/Z988_same.json'),
        { Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z6', Z6K1: 'Z41' } }
    );

    test(
        'function call for Z988 (same), and lo, they are not same',
        readJSON('./test/features/v1/test_data/Z988_different.json'),
        { Z1K1: { Z1K1: 'Z9', Z9K1: 'Z40' }, Z40K1: { Z1K1: 'Z6', Z6K1: 'Z42' } }
    );

    test(
        'function call for Z999 (unquote)',
        readJSON('./test/features/v1/test_data/Z999.json'),
        { Z1K1: 'Z9', Z9K1: 'Z10' }
    );
});
