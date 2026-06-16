# Context Managers in Python

How the `with` statement guarantees resource cleanup and why it is more reliable than manual `try/finally`: the `__enter__`/`__exit__` protocol, tools from `contextlib` (`@contextmanager`, `suppress`, `ExitStack`), and real patterns - files, locks, transactions. For developers who already know Python classes and want code that does not leave open files or held locks behind.

## Concepts

1. **The `with` statement: why it exists**
2. **The `__enter__`/`__exit__` protocol**
3. **`contextlib`: `contextmanager`, `suppress`, `ExitStack`**
4. **Real patterns: resources, locks, transactions**

## Prerequisites

- `python-oop`

## Estimated effort

About 3 hours.

## Runtime

`pyodide` - runs entirely in your browser. No setup.
