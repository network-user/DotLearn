# Фоновые задачи с Celery

Тема для backend-разработчиков на Python, которые упёрлись в медленные HTTP-ответы и хотят вынести тяжёлую работу (отправку писем, обработку файлов, обращения к внешним API) за пределы request-цикла. Разбираем, зачем нужна очередь фоновых задач, из чего состоит Celery (broker, worker, result backend), как пережить падения через повторы и идемпотентность и как собирать задачи в цепочки и группы, не наступая на типичные грабли.

## Концепты

1. Зачем очереди фоновых задач
2. Архитектура Celery: broker, worker, backend
3. Повторы, ошибки и идемпотентность задач
4. Паттерны (chains, groups) и подводные камни

## Prerequisites

Нет.

Generated via `lesson-forge`.

---

## English

# Background tasks with Celery

A topic for Python backend developers who hit slow HTTP responses and want to move heavy work (sending email, processing files, calling external APIs) out of the request cycle. We cover why background task queues exist, how Celery is built (broker, worker, result backend), how to survive failures with retries and idempotency, and how to compose tasks into chains and groups without stepping on common pitfalls.

## Concepts

1. Why background task queues
2. Celery architecture: broker, worker, backend
3. Retries, errors, and task idempotency
4. Patterns (chains, groups) and pitfalls

## Prerequisites

None.

Generated via `lesson-forge`.
