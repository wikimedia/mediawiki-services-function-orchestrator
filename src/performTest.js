'use strict';

const { ReferenceResolver } = require( './db.js' );
const parse = require( './parse.js' );
const orchestrate = require( './orchestrate.js' );
const normalize = require( '../function-schemata/javascript/src/normalize.js' );

function parseNormalizedArray( zobject, refs = [] ) {
	const head = zobject.Z10K1;
	const tail = zobject.Z10K2;

	if ( tail ) {
		return parseNormalizedArray( tail, [ ...refs, head.Z9K1 ] );
	} else {
		return refs;
	}
}

async function getTestResults( data ) {
	const {
		zfunction,
		zimplementations,
		ztesters,
		wikiUri,
		evaluatorUri,
		doValidate
	} = parse( data );

	const resolver = new ReferenceResolver( wikiUri );

	// Get ZFunction object
	const zFunction = zfunction.match( /^Z\d+$/ ) ? ( await resolver.dereference( [ zfunction ] ) )[ zfunction ] : ( await normalize( JSON.parse( zfunction ) ) ).Z22K1;

	// Get ZImplementation objects
	// If list of implementations is provided, get those.
	// Otherwise, fetch all associated with ZFunction
	const implementations = zimplementations &&
		JSON.parse( zimplementations ).filter( ( item ) => !!item ).length ?
		await Promise.all(
			// Parse the list of implementations
			JSON.parse( zimplementations ).map(
				( impl ) => {
					// If it's an object, normalize it
					if ( typeof impl === 'object' ) {
						return normalize( impl ).Z22K1;
						// If it's a string, dereference it
					} else {
						return resolver.dereference( [ impl ] ).then( ( res ) => res[ impl ] );
					}
				}
			)
		) :
	// Get the list of ZImplementations, then dereference them
		await Promise.all(
			parseNormalizedArray( zFunction.Z2K2.Z8K4 ).map(
				( zImplementationId ) => resolver.dereference( [ zImplementationId ] )
					.then( ( res ) => res[ zImplementationId ] )
			) );
	// Get ZTester objects
	// If list of testers is provided, get those.
	// Otherwise, fetch all associated with ZFunction
	const testers = ztesters && JSON.parse( ztesters ).filter( ( item ) => !!item ).length ?
		await Promise.all(
			// Parse the list of testers
			JSON.parse( ztesters ).map(
				( tester ) => {
					// If it's an object, normalize it
					if ( typeof tester === 'object' ) {
						return normalize( tester ).Z22K1;
						// If it's a string, dereference it
					} else {
						return resolver.dereference( [ tester ] ).then( ( res ) => res[ tester ] );
					}
				}
			)
		) :
	// Get the list of ZTesters, then dereference them
		await Promise.all(
			parseNormalizedArray( zFunction.Z2K2.Z8K3 ).map(
				( zTesterId ) => resolver.dereference( [ zTesterId ] )
					.then( ( res ) => res[ zTesterId ] )
			) );

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

		const test = JSON.parse( JSON.stringify( zTester.Z2K2.Z20K2 ) );
		const implementation = JSON.parse( JSON.stringify( zImplementation.Z2K2 ) );
		const validator = JSON.parse( JSON.stringify( zTester.Z2K2.Z20K3 ) );

		test.Z7K1 = zFunction.Z2K2;
		test.Z7K1.Z8K4 = [ implementation ];

		const testResponse = normalize(
			await orchestrate( {
				zobject: test,
				evaluatorUri,
				wikiUri,
				doValidate
			} )
		).Z22K1;
		const testResult = testResponse.Z22K1;

		if ( testResult === 'Z23' || testResult.Z9K1 === 'Z23' ) {
			payload.validationResponse = testResponse;
		} else {
			const validatorFn = validator.Z7K1.Z9K1;
			validator[ validatorFn + 'K1' ] = testResult;

			const start = Date.now();

			const validationResponse = await orchestrate( {
				zobject: validator,
				evaluatorUri,
				wikiUri,
				doValidate
			} );

			const end = Date.now();

			payload.duration = end - start;

			if ( validationResponse.Z22K1.Z40K1 === 'Z42' ) {
				const actual = testResult;
				const expected = validator[ validatorFn + 'K2' ];

				validationResponse.Z22K2 = {
					Z1K1: {
						Z1K1: 'Z9',
						Z9K1: 'Z5'
					},
					Z5K2: {
						Z1K1: {
							Z1K1: 'Z9',
							Z9K1: 'Z10'
						},
						Z10K1: expected,
						Z10K2: {
							Z1K1: {
								Z1K1: 'Z9',
								Z9K1: 'Z10'
							},
							Z10K1: actual
						}
					}
				};
			}

			payload.validationResponse = validationResponse;
		}

		return payload;
	}

	const tests = [];

	for ( const implementation of implementations ) {
		for ( const tester of testers ) {
			tests.push( performTest( zFunction, implementation, tester ) );
		}
	}

	return Promise.all( tests );
}

module.exports = getTestResults;
