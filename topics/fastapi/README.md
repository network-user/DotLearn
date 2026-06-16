# FastAPI: маршруты, валидация, async

Практический разбор того, как устроен веб-фреймворк FastAPI: как объявляются маршруты и откуда фреймворк берёт параметры (path, query, body), как Pydantic-модели превращают входной JSON в проверенные объекты, чем `async def`-обработчик отличается от обычного и когда он действительно ускоряет сервис, и как возвращать корректные статусы ошибок и встраивать middleware. Тема для тех, кто знает Python и хочет уверенно писать HTTP API на FastAPI.

## Концепты

1. Маршруты: path, query, body
2. Pydantic-модели и валидация
3. async и конкурентность в FastAPI
4. Ошибки, статусы и middleware

## Prerequisites

Нет. Достаточно знания Python: функции, типовые аннотации, классы, базовое представление об HTTP.

Generated via `lesson-forge`.

## English

# FastAPI: routes, validation, async

A practical walkthrough of how the FastAPI web framework works: how routes are declared and where the framework gets parameters (path, query, body), how Pydantic models turn incoming JSON into validated objects, how an `async def` handler differs from a regular one and when it actually speeds up the service, and how to return correct error statuses and plug in middleware. For anyone who knows Python and wants to write HTTP APIs confidently with FastAPI.

## Concepts

1. Routes: path, query, body
2. Pydantic models and validation
3. async and concurrency in FastAPI
4. Errors, statuses, and middleware

## Prerequisites

None. Enough Python to read functions, type annotations, classes, and a basic picture of HTTP.

Generated via `lesson-forge`.
