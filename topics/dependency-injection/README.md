# Dependency Injection and Abstractions

For developers who already know Python OOP and want code that is easy to change and test. You will learn how to describe contracts with `abc.ABC` and `typing.Protocol`, how to pass dependencies in from outside instead of creating them inside (inversion of control), how the same idea is built into FastAPI's `Depends`, and why DI turns testing from a pain into a pleasure by swapping dependencies.

## Concepts

1. **Abstractions: ABC and Protocol**: describe the shape of a dependency as a contract without implementation.
2. **The DI pattern and inversion of control** means passing dependencies in from outside instead of creating them inside.
3. **`Depends` in FastAPI** - the framework assembles the dependency graph for you.
4. **Testing through dependency substitution**. Replace real dependencies with test doubles.

## Prerequisites

`python-oop`.

## Estimated effort

About 3 hours.

## Runtime

`pyodide` (runs entirely in your browser). No setup.
