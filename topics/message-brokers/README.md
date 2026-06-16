# Брокеры сообщений: RabbitMQ и Kafka

Тема для backend-разработчиков и архитекторов, которые хотят понять, что такое брокер сообщений, чем отличаются две доминирующие модели — RabbitMQ и Kafka — и какие гарантии доставки каждая из них реально даёт. Без привязки к языку: фокус на ментальных моделях (очередь против лога, push против pull, at-least-once против exactly-once), а не на деталях клиентских API. После темы можно осознанно выбрать брокер под задачу и спроектировать consumer'ов, которые не теряют и не дублируют данные.

## Концепты

1. **Зачем нужен брокер** — синхронный вызов против асинхронного сообщения, развязка сервисов, сглаживание пиков, буфер между быстрым producer и медленным consumer.
2. **RabbitMQ: exchange, queue, binding, ack** — модель «умного брокера»: exchange маршрутизирует, queue хранит, binding связывает; ручное подтверждение и возврат сообщения.
3. **Kafka: log, partitions, offset, consumer groups** — распределённый append-only лог, партиционирование по ключу, offset как позиция чтения, масштабирование через consumer groups.
4. **Гарантии доставки и идемпотентность** — at-most-once, at-least-once, exactly-once; почему дубли неизбежны и как идемпотентный consumer делает повторы безопасными.

## Prerequisites

Нет. Достаточно базового понимания, что сервис — это программа, которая общается с другими программами по сети.

Generated via `lesson-forge`.

## English

# Message Brokers: RabbitMQ and Kafka

A topic for backend developers and architects who want to understand what a message broker is, how the two dominant models - RabbitMQ and Kafka - differ, and what delivery guarantees each one actually provides. Language-agnostic: the focus is on mental models (queue versus log, push versus pull, at-least-once versus exactly-once), not client API details. After this topic you can choose a broker for a task deliberately and design consumers that neither lose nor duplicate data.

## Concepts

1. **Why a message broker** - synchronous call versus asynchronous message, service decoupling, peak smoothing, buffer between a fast producer and a slow consumer.
2. **RabbitMQ: exchange, queue, binding, ack** - the smart broker model: exchange routes, queue stores, binding connects; manual acknowledgment and message return.
3. **Kafka: log, partitions, offset, consumer groups** - distributed append-only log, partitioning by key, offset as read position, scaling through consumer groups.
4. **Delivery guarantees and idempotency** - at-most-once, at-least-once, exactly-once; why duplicates are inevitable and how an idempotent consumer makes retries safe.

## Prerequisites

None. Basic understanding that a service is a program that talks to other programs over the network is enough.

Generated via `lesson-forge`.
