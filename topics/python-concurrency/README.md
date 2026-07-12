# Конкурентность в Python: GIL, потоки, примитивы синхронизации

Разбор того, как в Python устроена конкурентность и почему она работает не так, как ждёт большинство: чем поток отличается от процесса и где живут их данные, что на самом деле гарантирует GIL (и почему `x += 1` всё равно не атомарен), как рождаются гонки на общем состоянии и почему тесты их не ловят, какими примитивами (`Lock`, `RLock`, `Semaphore`, `Event`, `Condition`) состояние защищают и как при этом не поймать deadlock, как очереди и `ThreadPoolExecutor` убирают ручную синхронизацию, и чем кооперативная модель `asyncio` отличается от вытесняющих потоков. Тема для middle-разработчика, который знает Python и хочет уверенно отвечать на собеседовании и не бояться многопоточного кода.

## Концепты

1. Процессы и потоки: модель ОС
2. GIL: что он гарантирует, а что нет
3. threading и гонки
4. Примитивы синхронизации
5. Очереди и пулы потоков
6. asyncio против потоков

## Prerequisites

- `python-main-guard`: многопроцессность и запуск воркеров опираются на защиту точки входа `if __name__ == "__main__"`, к которой мы отсылаем в разговоре про выбор между потоками и процессами.
- `python-storage-internals`: GIL существует ради безопасного подсчёта ссылок (refcounting), поэтому модель памяти объектов из этой темы нужна, чтобы понять, зачем он вообще появился.

Generated via `lesson-forge`.

---

## English

# Python Concurrency: GIL, Threads, and Synchronization Primitives

A look at how concurrency actually works in Python, and why it behaves differently from what most people expect: how a thread differs from a process and where their data lives, what the GIL really guarantees (and why `x += 1` still isn't atomic), how race conditions emerge on shared state and why tests rarely catch them, which primitives (`Lock`, `RLock`, `Semaphore`, `Event`, `Condition`) protect that state and how to avoid deadlocks while using them, how queues and `ThreadPoolExecutor` remove the need for manual synchronization, and how the cooperative model of `asyncio` differs from preemptive threads. Built for a mid-level developer who knows Python and wants to answer interview questions with confidence and stop fearing multithreaded code.

## Concepts

1. Processes and threads: the OS model
2. The GIL: what it guarantees, and what it doesn't
3. threading and race conditions
4. Synchronization primitives
5. Queues and thread pools
6. asyncio vs threads

## Prerequisites

- `python-main-guard`: multiprocessing and worker startup rely on protecting the entry point with `if __name__ == "__main__"`, which we reference when discussing the choice between threads and processes.
- `python-storage-internals`: the GIL exists to keep reference counting safe, so the object memory model from that topic is needed to understand why it exists in the first place.

Generated via `lesson-forge`.
