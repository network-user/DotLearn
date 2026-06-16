# MRO in Python

A deep dive into how Python chooses which method to call under inheritance: method resolution order (MRO), the C3 linearization algorithm, cooperative `super()` chains, and diamond inheritance with mixins.

## Concepts

1. **What MRO is** - how Python flattens the ancestor graph into a flat list.
2. **C3 linearization** - the algorithm that builds MRO and how to derive it by hand.
3. **`super()`** - cooperative multiple inheritance and argument passing.
4. **Diamond and mixins** - predictable composition without double calls.

## Prerequisites

- `python-oop`

## Estimated effort

About 3 hours.

## Runtime

`pyodide` - runs entirely in your browser. No setup.
