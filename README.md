# WikiFunctions function-orchestrator
The orchestrator manages the execution of `Z7`s (Function Calls). It is the point
of interoperation between [MediaWiki](https://wikitech.wikimedia.org/wiki/MediaWiki_at_WMF) and the function evaluator, which executes
native code in various programming languages. Among other things, this separation
of concerns allows the orchestrator to make calls to MediaWiki relatively safely
while not extending the same permissions to the function evaluator.

Eventually, the orchestrator will also be responsible for deciding which
implementation to run for a function (if there are multiple implementations) and
caching the deterministic results of dereferencing and function execution.

See also the [service-template-node](https://www.mediawiki.org/wiki/ServiceTemplateNode)
documentation for information on how the orchestrator works as a service.

## Local installation
You should use one of the [Docker images](https://docker-registry.wikimedia.org/wikimedia/mediawiki-services-function-orchestrator/tags/)
for local use, and you do not need to download the raw code unless you want to
modify the orchestrator. If you're going to attempt that, remember to clone the
repository with the `--recurse-submodules` flag:

```
git clone --recurse-submodules ssh://gerrit.wikimedia.org:29418/mediawiki/services/function-orchestrator
```

If you've already cloned the repository but forgot that flag, you can adjust
your local check-out with:

```
git submodule update --init
```

<a href='testing'></a>
## Testing patches

Before submitting, please run the integration tests. Please install Mediawiki core
and the WikiLambda extension.

- Point the extension to a local orchestrator by over-riding the `$wgWikiLambdaOrchestratorLocation` config value by editing your `LocalSettings.php` file to add something like:

```
$wgWikiLambdaOrchestratorLocation =  "http://mediawiki-function-orchestrator-1:6254/";
```

- From the MediaWiki root directory, run the command `docker-compose exec mediawiki php tests/phpunit/phpunit.php extensions/WikiLambda/tests/phpunit/integration/API/ApiFunctionCallTest.php`
- If your code hasn't made any breaking changes, all tests should pass.

<a href='the-code'></a>
## The Code
The orchestrator's code is complicated. To a certain extent, this is
unavoidable because the orchestrator kind of implements a functional programming
language. Programming languages rely on self-similar, recursive structures,
necessitating that most functionality be available at any point during
function execution. Most parts of the code need to be able to resolve
`Z9`s (References) and [`Z18`s (Argument References)](#argument-resolution) and
to [execute `Z7`s](#execute-function). Because of this, a lot of mutable state is
passed around throughout the code base. Dear reader, if you have solved similar
problems--e.g., if you implemented programming languages before--and know the
better way, have at it :).

### Some Idiosyncrasies
The orchestrator relies heavily on the `ZWrapper` type. This type represents
the union of a [ZObject](#idiosyncrasy-zobject) and its [scope](#idiosyncrasy-scope).
This object must be specially treated, as will be discussed in the section on
[best practices](#idiosyncratic-practices).

<a href='idiosyncrasy-zobject'></a>
#### Wrapped ZObject
The ZWrapper does wrap a ZObject, but the situation is a bit more complex than
that term implies. Because a ZObject contains other ZObjects which can potentially
be resolved (`Z9`, `Z7`, and `Z18`s), a ZWrapper holds information about a
ZObject in multiple phases of resolution.

A ZWrapper is constructed from the bare JSON representation of a normal-form ZObject and a
scope. This construction is recursive. In the base case, where the original value
is a string, `ZWrapper.create` returns the string unchanged.

In the recursive case, the ZWrapper maintains an internal `Map` from the original object's
keys to the result of calling `ZWrapper.create` on its values.

In addition to this `Map` (called `original_`), the ZWrapper maintains two other
`Map`s: `resolved_` and `resolvedEphemeral_`, corresponding to two different
resolution strategies: persistent and ephemeral. These strategies affect the
JSON object that `ZWrapper.asJSON` and `ZWrapper.asJSONEphemeral` will return to the called or other parts of
the code base. `ZWrapper.asJSON` is the "normal" means of getting the JSON
version of a `ZWrapper`; `ZWrapper.asJSONEphemeral` is for special cases.

Usually, objects are resolved persistently. This means that, whether `asJSON`
or `asJSONEphemeral` is called, the result of resolution will be represented
in the resulting JSON. However, when the `Z1K1` (type) of a ZObject
is resolved for the purposes of validation, it is resolved ephemerally. This means
that, when the `ZWrapper` is converted back to JSON, the original value (i.e.,
the `Z9`, `Z7`, or `Z18` that was resolved) will be returned instead of the 
resolved value (unless `asJSONEphemeral` is used, which is only part of the
type validation workflow).

<a href='idiosyncrasy-scope'></a>
#### Scope
Scope is a concern of the orchestrator's role as a functional programming language:
when a `Z7/Function call` is executed, its `Z7K1` `Z8/Function`'s argument
declarations are consulted in order to populate the scope with unbound names.
The values supplied as arguments to the `Z7` are then bound to those names. When
working with `ZWrappers`, one must be careful to keep scope information around
if one wants to produce new `ZWrappers`.

<a href='idiosyncratic-practices'></a>
#### Best Practices
`ZWrapper` is written to be as compatible as possible with utilities from
`function-schemata`, but there are limitations.

A `ZWrapper` redefines the setters and getters for every key in the original
JSON object to consult (or write to) its internal `Map`s. This allows code to
work correctly even when it uses dot or bracket syntax (`ZObject.Z1K1` or
`ZObject[ 'Z1K1' ]`). However, no getters or setters can be defined for keys that
were not originally present, so `ZWrapper`s will not play nicely with code that
tries to do that.

Most functions in `function-schemata` are written in a way that accommodates
`ZWrapper`s. However, JSON schema validators notably do not work with `ZWrapper`s.
This means, if you want to validate a `ZWrapper` or use code that calls the
validators (e.g. `findIdentity`), you must first convert the `ZWrapper` to JSON
using `asJSON()`.

## Microservice Architecture
From the perspective of the orchestrator, there are three other services/entities
in the universe: MediaWiki, which resolves `Z9`s (References); the caller (which
will often also be MediaWiki); and the function evaluator, which runs native
code. Currently, the caller provides the URIs for MediaWiki and the function
evaluator as a parameter when initially requesting function orchestration (this
will change).

## Testing
This repository doesn't really have unit tests. This is a consequence of the
[code's complexity](#the-code): it is of limited usefulness to know that a
given function exhibits a given behavior in isolation from other functions,
because it is rare for any piece of code in this repository to run without
consulting most other pieces of code. As a result, most tests exercise the full
system, focusing on particular execution paths.

### Test Output Regeneration
Sometimes a change to the orchestrator will make lots of inconsequential changes
to the output (e.g., a function call is now expanded when it wasn't before). It
can be tedious to update all affected tests. You can re-generate the expected
test outputs by adding the `--regenerate-output` argument to the test runner
command, e.g.

`mocha test/features/v1/mswOrchestrateTest.js --regenerate-output --timeout 20000`

<a href='argument-resolution'></a>
## Argument Resolution
The orchestrator is also responsible for managing the execution of function
compositions. As such, it implements many features of functional programming
languages. One such feature is lazy evaluation: when the
[`execute` function](#execute-function) is called with a `Z7`, it opens a new
namespace (currently referred to in code as a `Frame`) and stores all of the
`Z7`'s argument instantiations in that namespace. It does not attempt to analyze
or evaluate these instantiations at that time. `Z18`s (Argument References) in
nested namespaces will then be able to refer to that argument.

Once a function needs access to an argument instantiation, the instantiation will
finally be resolved, which may involve subsequent calls to `execute`. Some functions
(for example, the consequent and alternative of `Z802`, the `If` function) mark
specific arguments as lazy, meaning they will not be evaluated even when
the function is called.

<a href='execute-function'></a>
## The Execute Function
The `execute` function accepts a `Z7` and produces a `Z22` as a result. The
`Z22` will contain either the result of successful execution or an error.

`execute` consults a `Z7`'s `Z8`'s implementations and selects one, then runs it
as appropriate. Builtin implementations, at present, run directly within the
orchestrator (this will change); evaluated implementations gather all relevant
state, then are executed in the function evaluator; and compositions occasion nested
calls to `execute`. A composition is a `Z7`, and its arguments may also be `Z7`s,
so a composition of any complexity occasions a lot of mutually recursive calls
between `execute` and the [argument namespace](#argument-resolution).
