# if __name__ == "__main__" in Python

A tour of one of the most recognizable lines in Python for beginners: what a module is and why it has a `__name__` variable, how `if __name__ == "__main__"` separates launch code from import code, and why without this guard `multiprocessing`, tests, and module reuse break. For anyone who has written simple scripts and wants to understand how imports work.

## Concepts

- Modules and the `__name__` variable — what Python puts in `__name__` on launch vs import.
- Why `if __name__ == "__main__"` is needed — the idiom that separates the entry point from importable code.
- Import side effects and multiprocessing — why unguarded top-level code bites back.

## Prerequisites

None.

## Estimated effort

About 2 hours.

## Runtime

`pyodide` — runs entirely in your browser. No setup.
