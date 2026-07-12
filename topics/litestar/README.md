# Litestar: маршруты, DTO и внедрение зависимостей

Тема для backend-разработчиков, которые уже знакомы с FastAPI и хотят разобраться в Litestar - ASGI-фреймворке со слоистой архитектурой, msgspec-сериализацией и системой DTO «из коробки». Мы честно сравниваем два фреймворка: где Litestar даёт другую модель организации кода (app → router → controller → handler), где DTO заменяют пару Pydantic-моделей вход/выход, а где разница - дело вкуса. После темы Вы сможете прочитать чужое Litestar-приложение, спроектировать маршруты на классах-контроллерах, отделить внутреннюю модель данных от внешнего представления через DTO и управлять зависимостями на разных слоях.

## Концепты

1. **Что такое Litestar и чем он отличается от FastAPI** - ASGI, слоистая архитектура (app/router/controller/handler), msgspec по умолчанию, DI и плагины «из коробки»; честное сравнение с FastAPI без рекламы.
2. **Маршрутизация: хендлеры, Router и Controller** - декораторы `@get`/`@post`/`@put`/`@delete`/`@patch`, типизированные path- и query-параметры, группировка через `Router` и классы-контроллеры, склейка путей по слоям.
3. **Модели, DTO и валидация** - `msgspec.Struct` как модель данных, парсинг тела через `data: Model`, DTO для фильтрации полей (include/exclude), разные представления для входа и выхода, ошибки валидации.
4. **Внедрение зависимостей через Provide** - `Provide()`, зависимости на уровнях app/router/controller/handler и их переопределение, sync и async, кэширование (`use_cache`), внедрение по имени параметра, вложенные зависимости.
5. **Жизненный цикл, guards и плагины** - middleware, guards для авторизации, хуки before/after request, lifespan и on_startup/on_shutdown, плагины (SQLAlchemy) и обработчики исключений.

## Prerequisites

`python-oop` - тема активно использует классы (контроллеры, `msgspec.Struct`, классы-исключения) и аннотации типов. Знакомство с FastAPI полезно как точка отсчёта, но не обязательно: все нужные понятия (ASGI, path/query, валидация) вводятся по ходу.

Generated via `lesson-forge`.

---

## English

# Litestar: Routing, DTOs, and Dependency Injection

A topic for backend developers who already know FastAPI and want to understand Litestar - an ASGI framework with a layered architecture, msgspec serialization, and a built-in DTO system. We honestly compare the two frameworks: where Litestar offers a different code organization model (app → router → controller → handler), where DTOs replace a pair of Pydantic input/output models, and where the difference is just a matter of taste. After this topic you'll be able to read someone else's Litestar app, design routes with controller classes, separate internal data models from external representations via DTOs, and manage dependencies across layers.

## Concepts

1. **What Litestar is and how it differs from FastAPI** - ASGI, layered architecture (app/router/controller/handler), msgspec by default, DI and plugins out of the box; an honest comparison with FastAPI, no marketing.
2. **Routing: handlers, Router, and Controller** - the `@get`/`@post`/`@put`/`@delete`/`@patch` decorators, typed path and query parameters, grouping via `Router` and controller classes, path composition across layers.
3. **Models, DTOs, and validation** - `msgspec.Struct` as a data model, parsing request bodies via `data: Model`, DTOs for field filtering (include/exclude), separate representations for input and output, validation errors.
4. **Dependency injection with Provide** - `Provide()`, dependencies at the app/router/controller/handler levels and overriding them, sync and async, caching (`use_cache`), injection by parameter name, nested dependencies.
5. **Lifecycle, guards, and plugins** - middleware, guards for authorization, before/after request hooks, lifespan and on_startup/on_shutdown, plugins (SQLAlchemy) and exception handlers.

## Prerequisites

`python-oop` - the topic makes heavy use of classes (controllers, `msgspec.Struct`, exception classes) and type annotations. Familiarity with FastAPI is helpful as a reference point but not required: all the necessary concepts (ASGI, path/query, validation) are introduced along the way.

Generated via `lesson-forge`.
