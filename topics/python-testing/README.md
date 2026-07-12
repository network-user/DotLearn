# Тестирование в Python: unittest, pytest, фикстуры, моки

Практический разбор того, как тестируют код на Python: зачем вообще нужны автотесты и из чего складывается хороший тест (схема Arrange-Act-Assert, пирамида тестирования), как устроен встроенный `unittest` с его `TestCase`, assert-методами и хуками `setUp`/`tearDown`, чем `pytest` удобнее (обычный `assert` с интроспекцией, параметризация, маркеры), как фикстуры подготавливают и убирают окружение через `scope` и `yield`, и как моки изолируют unit-тест от сети, базы и времени. Тема для тех, кто знает Python и классы и хочет уверенно писать тесты, которым можно доверять.

## Концепты

1. Зачем тесты и из чего они состоят
2. unittest: TestCase, assert-методы, setUp/tearDown
3. pytest: assert, параметризация, маркеры
4. Фикстуры pytest: scope, conftest, yield
5. Моки и изоляция: Mock, patch, monkeypatch

## Prerequisites

- `python-oop` - тесты в `unittest` пишутся как классы-наследники `TestCase`, а моки заменяют объекты, поэтому базовое понимание классов и методов обязательно.

Generated via `lesson-forge`.

---

## English

# Python Testing: unittest, pytest, Fixtures, and Mocking

A practical walkthrough of testing Python code: why automated tests matter and what makes a good one (the Arrange-Act-Assert pattern, the testing pyramid), how the built-in `unittest` module works with `TestCase`, its assert methods, and the `setUp`/`tearDown` hooks, why `pytest` feels lighter (plain `assert` with introspection, parametrization, markers), how fixtures set up and tear down state via `scope` and `yield`, and how mocks isolate a unit test from the network, the database, and time. Built for anyone who knows Python and classes and wants to write tests they can actually trust.

## Concepts

1. Why tests exist and what they're made of
2. unittest: TestCase, assert methods, setUp/tearDown
3. pytest: assert, parametrization, markers
4. pytest fixtures: scope, conftest, yield
5. Mocking and isolation: Mock, patch, monkeypatch

## Prerequisites

- `python-oop` - tests in `unittest` are written as `TestCase` subclasses, and mocks replace objects, so a working knowledge of classes and methods is required.

Generated via `lesson-forge`.
