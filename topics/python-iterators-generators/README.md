# Итераторы, генераторы и comprehensions

Как `for` работает под капотом, чем итерируемое отличается от итератора, почему comprehension быстрее ручного цикла и где у него границы читаемости, как `yield` превращает функцию в машину состояний, чем генераторное выражение экономит память на больших данных, что даёт `itertools` и как генератор становится сопрограммой через `send`, `throw`, `close` и `yield from`. Теория-лонгрид с интерактивными визуализациями и упражнениями на pyodide для middle Python-разработчика.

---

## English

# Python Iterators, Generators, and Comprehensions

How `for` works under the hood, what separates an iterable from an iterator, why a comprehension beats a manual loop and where its readability limits are, how `yield` turns a function into a state machine, how a generator expression saves memory on large data, what `itertools` gives you, and how a generator becomes a coroutine through `send`, `throw`, `close`, and `yield from`. A theory-heavy read with interactive visualizations and pyodide exercises for a mid-level Python developer.

## Concepts

1. Iterator Protocol: __iter__ and __next__
2. Comprehensions: Lists, Dicts, Sets
3. Generators: yield and Laziness
4. Generator Expressions and Pipelines
5. itertools: Combining Iterators
6. send, throw, close, and yield from

## Prerequisites

`python-oop`: iterators and generators build directly on the classes and dunder methods introduced in the OOP course.

Generated via `lesson-forge`.
