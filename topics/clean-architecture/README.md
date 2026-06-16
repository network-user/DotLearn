# Clean and Onion Architecture

For developers who already know how to write classes but want to learn how to split code into layers so business logic does not depend on the framework or database. We cover why layers exist at all, how the dependency rule from Clean Architecture works, how onion and hexagonal architecture differ from classic three-tier apps, and how to apply all of this in a real Python project.

## Concepts

1. **Why layers: coupling and testability** — why mixed "everything in one pile" code is hard to change and how separation by responsibility level restores control.
2. **The dependency rule (Clean Architecture)** — one sentence from which all of Clean Architecture follows: every arrow points inward, toward business rules.
3. **Onion and hexagonal architecture** — three names for one idea and the differences in emphasis that easily confuse people in interviews.
4. **Applying it in Python** — how to lay out layers in packages, wire everything at the composition root, and avoid drowning in abstractions for their own sake.

## Prerequisites

`python-oop`.

## Estimated effort

About 3 hours.

## Runtime

None — examples use diagrams and code fragments.
