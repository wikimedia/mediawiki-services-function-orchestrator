'use strict';

const { ReferenceResolver } = require( './db.js' );
const { generateError } = require( './utils' );
const orchestrate = require( './orchestrate.js' );
const { normalError, error } = require( '../function-schemata/javascript/src/error' );
const normalize = require( '../function-schemata/javascript/src/normalize.js' );
const { convertZListToItemArray, convertItemArrayToZList, makeFalse, wrapInQuote } = require( '../function-schemata/javascript/src/utils.js' );

async function resolveListOfReferences( listOfReferences, resolver ) {
	const ZIDs = convertZListToItemArray( listOfReferences ).map( ( Z9 ) => ( Z9.Z9K1 ) );
	const resolved = await resolver.dereference( ZIDs );
	const result = [];
	for ( const ZID of ZIDs ) {
		result.push( resolved[ ZID ].asJSON() );
	}
	return result;
}

function parse( str ) {
	try {
		const zobject = JSON.parse( str );
		return zobject;
	} catch ( err ) {
		const m = ( err.name === 'SyntaxError' ) ? err.message : err.name;
		return generateError( m );
	}
}

async function getTestResults( data, wikiUri, evaluatorUri ) {
	const {
		zfunction,
		zimplementations,
		ztesters,
		doValidate
	} = parse( data );

	const resolver = new ReferenceResolver( wikiUri );

	// Get ZFunction object
	const zFunction = zfunction.match( /^Z\d+$/ ) ?
		( await resolver.dereference( [ zfunction ] ) )[ zfunction ].asJSON() :
		( await normalize( JSON.parse( zfunction ),
			/* generically= */true, /* withVoid= */ true ) ).Z22K1;

	// Get ZImplementation objects
	// If list of implementations is provided, get those.
	// Otherwise, fetch all associated with ZFunction
	let implementations;
	if ( zimplementations && JSON.parse( zimplementations ).filter( ( item ) => !!item ).length ) {
		implementations = await Promise.all(
			// Parse the list of implementations
			JSON.parse( zimplementations ).map(
				async ( impl ) => {
					if ( typeof impl === 'object' ) {
						// If it's an object, normalize it
						return ( await normalize( impl,
							/* generically= */true, /* withVoid= */ true ) ).Z22K1;
					} else {
						// If it's a string, dereference it
						return resolver.dereference(
							[ impl ]
						).then( ( res ) => res[ impl ].asJSON() );
					}
				}
			)
		);
	} else {
		// Get the list of ZImplementations, then dereference them
		implementations = await resolveListOfReferences( zFunction.Z2K2.Z8K4, resolver );
	}

	// Get ZTester objects
	// If list of testers is provided, get those.
	// Otherwise, fetch all associated with ZFunction
	let testers;
	if ( ztesters && JSON.parse( ztesters ).filter( ( item ) => !!item ).length ) {
		testers = await Promise.all(
			// Parse the list of testers
			JSON.parse( ztesters ).map(
				async ( tester ) => {
					if ( typeof tester === 'object' ) {
						// If it's an object, normalize it
						return ( await normalize( tester,
							/* generically= */true, /* withVoid= */ true ) ).Z22K1;
						// If it's a string, dereference it
					} else {
						return resolver.dereference(
							[ tester ]
						).then( ( res ) => res[ tester ].asJSON() );
					}
				}
			)
		);
	} else {
		// Get the list of ZTesters, then dereference them
		testers = await resolveListOfReferences( zFunction.Z2K2.Z8K3, resolver );
	}

	async function performTest(
		zFunction,
		zImplementation,
		zTester
	) {
		const payload = {
			zFunctionId: zFunction.Z2K1.Z6K1,
			zImplementationId: zImplementation.Z2K1.Z6K1,
			zTesterId: zTester.Z2K1.Z6K1,
			validationResponse: null
		};

		const test = JSON.parse( JSON.stringify( zTester.Z2K2.Z20K2 ) );
		const implementation = JSON.parse( JSON.stringify( zImplementation.Z2K2 ) );
		const validator = JSON.parse( JSON.stringify( zTester.Z2K2.Z20K3 ) );

		test.Z7K1 = zFunction.Z2K2;
		test.Z7K1.Z8K4 = await convertItemArrayToZList( [ implementation ] );

		const testResponse = ( await normalize(
			await orchestrate( {
				zobject: test,
				evaluatorUri,
				wikiUri,
				doValidate
			} ), /* generically= */true, /* withVoid= */ true
		) ).Z22K1;
		const testResult = testResponse.Z22K1;

		if ( testResult === 'Z21' || testResult.Z9K1 === 'Z21' ) {
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

			if ( validationResponse.Z22K1.Z40K1 === makeFalse().Z40K1.Z9K1 ) {
				const actual = testResult;
				const expected = validator[ validatorFn + 'K2' ];
				const testFailedError = normalError(
					[ error.test_failed ],
					[ wrapInQuote( expected ), wrapInQuote( actual ) ]
				);
				validationResponse.Z22K2 = testFailedError;
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
