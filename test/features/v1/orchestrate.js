'use strict';

const preq   = require('preq');
const assert = require('../../utils/assert.js');
const Server = require('../../utils/server.js');

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
      {
        Z1K1: 'Z5',
        Z5K1: {
          Z1K1: 'Z402',
          Z402K1: {
            Z1K1: 'Z422',
            Z422K1: '1',
            Z422K2: {
              Z1K1: 'Z5',
              Z5K1: {
                Z1K1: 'Z402',
                Z402K1: {
                  Z1K1: 'Z424',
                  Z424K1: {
                    Z1K1: 'Test2!',
                    Z2K1: 'Test2?'
                  }
                }
              }
            }
          }
        }
      }
    );
    // TODO: rewrite that using error syntax

    test(
      'record multiple list',
      [ { Z1K1: 'Z60', Z2K1: 'Test' }, { Z1K1: { Z1K1: 'Z7', Z7K1: 'Z10' }, Z2K1: 'Test2?' } ],
      [ { Z1K1: 'Z60', Z2K1: 'Test' }, { Z1K1: { Z1K1: 'Z7', Z7K1: 'Z10' }, Z2K1: 'Test2?' } ]
    );

    test(
      'invalid record singleton list',
      [ { Z2K1: 'Test' } ],
      {
        Z1K1: 'Z5',
        Z5K1: {
          Z1K1: 'Z402',
          Z402K1: {
            Z1K1: 'Z422',
            Z422K1: '0',
            Z422K2: {
              Z1K1: 'Z5',
              Z5K1: {
                Z1K1: 'Z402',
                Z402K1: {
                  Z1K1: 'Z423',
                  Z423K1: {
                    Z2K1: 'Test'
                  }
                }
              }
            }
          }
        }
      }
    );

    test(
      'empty record',
      {},
      {
        Z1K1: 'Z5',
        Z5K1: {
          Z1K1: 'Z402',
          Z402K1: {
            Z1K1: 'Z423',
            Z423K1: {}
          }
        }
      }
    );

    test(
      'singleton string record no Z1K1',
      { Z2K1: 'Test' },
      {
        Z1K1: 'Z5',
        Z5K1: {
          Z1K1: 'Z402',
          Z402K1: {
            Z1K1: 'Z423',
            Z423K1: {
              Z2K1: 'Test'
            }
          }
        }
      }
    );

    test(
      'singleton string record invalid key',
      { 'Z1K ': 'Z1' },
      {
        Z1K1: 'Z5',
        Z5K1: {
          Z1K1: 'Z402',
          Z402K1: {
            Z1K1: 'Z423',
            Z423K1: {
              'Z1K ': 'Z1'
            }
          }
        }
      }
    );

    test(
      'string record with short key',
      { Z1K1: 'Z6', K1: 'Test' },
      { Z1K1: 'Z6', K1: 'Test' }
    );

    test(
      'string record with invalid key',
      { Z1K1: 'Z6', ZK1: 'Test' },
      {
        Z1K1: 'Z5',
        Z5K1: {
          Z1K1: 'Z402',
          Z402K1: {
            Z1K1: 'Z435',
            Z435K1: 'ZK1'
          }
        }
      }
    );

    test(
      'record with list and sub-record',
      { Z1K1: 'Z8', K2: [ 'Test', 'Second test' ], Z2K1: { Z1K1: 'Z60', K2: 'Test' } },
      { Z1K1: 'Z8', K2: [ 'Test', 'Second test' ], Z2K1: { Z1K1: 'Z60', K2: 'Test' } }
    );

    test(
      'record with list and invalid sub-record',
      { Z1K1: 'Z8', K2: [ 'Test', 'Second test' ], Z2K1: { K2: 'Test' } },
      {
        Z1K1: 'Z5',
        Z5K1: {
          Z1K1: 'Z402',
          Z402K1: {
            Z1K1: 'Z426',
            Z426K1: 'Z2K1',
            Z426K2: {
              Z1K1: 'Z5',
              Z5K1: {
                Z1K1: 'Z402',
                Z402K1: {
                  Z1K1: 'Z423',
                  Z423K1: {
                    K2: 'Test'
                  }
                }
              }
            }
          }
        }
      }
    );

    test(
      'invalid zobject (int not string/list/record)',
      { Z1K1: 'Z2', Z2K1: 2 },
      {
        Z1K1: 'Z5',
        Z5K1: {
          Z1K1: 'Z402',
          Z402K1: {
            Z1K1: 'Z426',
            Z426K1: 'Z2K1',
            Z426K2: {
              Z1K1: 'Z5',
              Z5K1: {
                Z1K1: 'Z402',
                Z402K1: {
                  Z1K1: 'Z421',
                  Z421K1: 2
                }
              }
            }
          }
        }
      }
    );

    test(
      'invalid zobject (float not string/list/record)',
      { Z1K1: 'Z2', Z2K1: 2.0 },
      {
        Z1K1: 'Z5',
        Z5K1: {
          Z1K1: 'Z402',
          Z402K1: {
            Z1K1: 'Z426',
            Z426K1: 'Z2K1',
            Z426K2: {
              Z1K1: 'Z5',
              Z5K1: {
                Z1K1: 'Z402',
                Z402K1: {
                  Z1K1: 'Z421',
                  Z421K1: 2.0
                }
              }
            }
          }
        }
      }
    );

    test(
      'number in array',
      [ 2 ],
      {
        Z1K1: 'Z5',
        Z5K1: {
          Z1K1: 'Z402',
          Z402K1: {
            Z1K1: 'Z422',
            Z422K1: '0',
            Z422K2: {
              Z1K1: 'Z5',
              Z5K1: {
                Z1K1: 'Z402',
                Z402K1: {
                  Z1K1: 'Z421',
                  Z421K1: 2
                }
              }
            }
          }
        }
      }
    );

    // Parser

    testString('simple string parsed', '"test"', 'test');

    testString(
      'invalid JSON',
      '{ bad JSON! Tut, tut.',
      {
        Z1K1: 'Z5',
        Z5K1: {
          Z1K1: 'Z401',
          Z401K1: 'Unexpected token b in JSON at position 2',
          Z401K2: '{ bad JSON! Tut, tut.'
        }
      }
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
      {
        Z1K1: 'Z5',
        Z5K1: {
          Z1K1: 'Z401',
          Z401K1: 'Unexpected token T in JSON at position 0',
          Z401K2: 'Test'
        }
      }
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
});
