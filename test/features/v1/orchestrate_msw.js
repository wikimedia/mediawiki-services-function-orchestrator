'use strict';

const assert = require('../../utils/assert.js');
const canonicalize = require('../../../function-schemata/javascript/src/canonicalize.js');
const utils = require('../../../src/utils.js');
const { rest } = require('msw');
const { setupServer } = require('msw/node');
const orchestrate = require('../../../src/orchestrate.js');
const { readJSON } = require('../../utils/read-json.js');

class Canned {

    constructor() {
        this.reset();
    }

    reset() {
        // TODO: Read this and data on wiki from central location, maybe
        // function-schemata.
        this.dict_ = {
            wiki: readJSON('test/features/v1/test_data/wikilambda_fetch.json'),
            evaluator: {}
        };
    }

    setWiki(key, value) {
        this.dict_.wiki[ key ] = value;
    }

    setEvaluator(key, value) {
        this.dict_.evaluator[ key ] = value;
    }

    getWiki(key) {
        return this.dict_.wiki[ key ];
    }

    getEvaluator(key) {
        return this.dict_.evaluator[ key ];
    }

}

describe('orchestrate', function () {
    const cannedResponses = new Canned();

    const restHandlers = [
        rest.get('http://thewiki', (req, res, ctx) => {
            const zids = req.url.searchParams.get('zids');
            const result = {};
            for (const ZID of zids.split('|')) {
                result[ ZID ] = {
                    wikilambda_fetch: JSON.stringify(cannedResponses.getWiki(ZID))
                };
            }
            return res(ctx.status(200), ctx.json(result));
        }),

        rest.post('http://theevaluator', (req, res, ctx) => {
            const ZID = req.body.Z7K1.Z8K5.Z9K1;
            return res(ctx.status(200), ctx.json(cannedResponses.getEvaluator(ZID)));
        })
    ];
    const mockServiceWorker = setupServer(...restHandlers);

    beforeEach(() => mockServiceWorker.listen());

    afterEach(() => {
        return mockServiceWorker.resetHandlers();
    });

    const test = function (name, zobject, output = null, error = null) {
        const input = {
            zobject: zobject,
            wikiUri: 'http://thewiki',
            evaluatorUri: 'http://theevaluator',
            doValidate: true
        };
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
        it('orchestrate msw: ' + name, (done) => {
            const inputEncoded = JSON.stringify(input);
            orchestrate(inputEncoded)
            .then((result) => {
                assert.deepEqual(
                    result,
                    utils.makePair(output, error, /* canonical= */ true),
                    name
                );
                done();
            }).catch((problem) => {
                assert.deepEqual(0, problem, 'nope');
                done();
            });
        });
    };

    test(
      'validation error: invalid argument key for function call',
      readJSON('./test/features/v1/test_data/invalid_call_argument_key.json'),
      null,
      readJSON('./test/features/v1/test_data/invalid_call_argument_key_expected.json')
    );

    test(
      'validation error: invalid argument type for function call',
      readJSON('./test/features/v1/test_data/invalid_call_argument_type.json'),
      null,
      readJSON('./test/features/v1/test_data/invalid_call_argument_type_expected.json')
    );

    test(
      'validation error: invalid duplicated argument key in function definition',
      readJSON('./test/features/v1/test_data/invalid_key_duplicated.json'),
      null,
      readJSON('./test/features/v1/test_data/invalid_key_duplicated_expected.json')
    );

    test(
      'validation error: invalid key for first argument in function definition',
      readJSON('./test/features/v1/test_data/invalid_key_first_name.json'),
      null,
      readJSON('./test/features/v1/test_data/invalid_key_first_name_expected.json')
    );

    test(
      'validation error: invalid key name for argument in function definition',
      readJSON('./test/features/v1/test_data/invalid_key_name.json'),
      null,
      readJSON('./test/features/v1/test_data/invalid_key_name_expected.json')
    );

    test(
      'validation error: invalid non-sequential key for argument in function definition',
      readJSON('./test/features/v1/test_data/invalid_key_nonsequential.json'),
      null,
      readJSON('./test/features/v1/test_data/invalid_key_nonsequential_expected.json')
    );

    {
        cannedResponses.setEvaluator('Z1000', utils.makePair({ Z1K1: 'Z6', Z6K1: '13' }, null));
        test(
          'evaluated function call',
          readJSON('./test/features/v1/test_data/evaluated.json'),
          { Z1K1: 'Z6', Z6K1: '13' },
          null
        );
    }
});
