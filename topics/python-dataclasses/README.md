# Dataclasses и модели данных

Продолжение темы про dataclass из курса ООП, но вглубь: что именно генерирует декоратор `@dataclass`, как работают `frozen`, `slots` и наследование полей, чем `NamedTuple` и `TypedDict` отличаются от dataclass, где проходит граница между `attrs`, `pydantic` и стандартной библиотекой, и как выбирать форму данных между слоями приложения. Для middle-разработчика, который уже писал классы и хочет понимать механику и грабли на уровне собеседования. Живые примеры и упражнения на pyodide используют только стандартную библиотеку (`dataclasses`, `typing`, `copy`).

---

## English

# Dataclasses and Data Models

A follow-up to the dataclass intro from the OOP course, but deeper: what the `@dataclass` decorator actually generates, how `frozen`, `slots`, and field inheritance work, how `NamedTuple` and `TypedDict` differ from a dataclass, where the line falls between `attrs`, `pydantic`, and the standard library, and how to pick a data shape across application layers. Aimed at a mid-level developer who has already written classes and wants to understand the mechanics and gotchas well enough for an interview. Live examples and exercises in pyodide use only the standard library (`dataclasses`, `typing`, `copy`).

## Concepts

1. How @dataclass works
2. frozen, slots, and inheritance
3. NamedTuple and TypedDict
4. attrs and pydantic
5. Data modeling patterns

## Prerequisites

`python-oop` - the topic continues the dataclass introduction from the OOP course and assumes comfort with classes, methods, and type hints.

Generated via `lesson-forge`.
