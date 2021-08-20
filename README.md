# WikiFunctions function-orchestrator
The orchestrator manages the execution of `Z7`s (Function Calls). It is the point
of interoperation between MediaWiki and the function evaluator, which executes
native code in various programming languages. Among other things, this separation
of concerns allows the orchestrator to make calls to MediaWiki relatively safely
while not extending the same permissions to the function evaluator.

Eventually, the orchestrator will also be responsible for deciding which
implementation to run for a function (if there are multiple implementations) and
caching the deterministic results of dereferencing and function execution.

See also the [service-template-node](https://www.mediawiki.org/wiki/ServiceTemplateNode))
documentation for information on how the orchestrator works as a service.

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

<a href='argument-resolution'></a>
## Argument Resolution
The orchestrator is also responsible for managing the execution of function
compositions. As such, it implements many features of functional programming
languages. One such features is lazy evaluation: when the
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
