# Python Storage Internals

A deep dive into CPython memory internals: how variables reference objects, how reference counting and garbage collection work, how dict and set hash tables are laid out, and which memory-layout optimizations (`__slots__`, over-allocation, interning) the interpreter applies. Details refer to CPython 3.11+ as a specific language implementation.

## Concepts

1. **Objects and references**: a variable is a label on an object, not a box; assignment, identity, mutability, and copying.
2. **Reference counting and GC**: immediate refcount cleanup, cycles, generations, and weak references.
3. **dict and set internals**: hash tables, collisions, load factor, compact dict, insertion order.
4. **Memory layout optimizations**: `__slots__`, small-object caches, list growth, and `collections`.

## Prerequisites

Comfort with Python classes and objects (`python-oop` topic).

## Estimated effort

About 3.5 hours.

## Runtime

`pyodide`: runs entirely in your browser. No setup.

Generated via `lesson-forge`.
