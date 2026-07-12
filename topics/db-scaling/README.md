# Масштабирование БД: репликация, шардирование, партиционирование

Тема для middle-разработчика, который упёрся в потолок одного сервера БД и хочет разобраться, что делать дальше. Три стратегии часто путают, хотя решают они разные задачи: репликация копирует одни и те же данные на несколько узлов ради отказоустойчивости и чтения, партиционирование режет таблицу на куски внутри одного узла ради управляемости, шардирование раскидывает данные по разным узлам ради записи и объёма. Фокус на механике и граблях: лаг репликации и read-your-writes, выбор ключа шардирования и горячие ключи, консистентное хеширование против `hash % N`, cross-shard запросы и боль решардинга. Разбор уровня собеседования, без привязки к конкретной СУБД. После темы вы сможете выбрать стратегию под сценарий и объяснить, почему она подходит.

## Концепты

1. **Вертикальное и горизонтальное масштабирование**: потолок scale-up, разделение путей чтения и записи, когда одного сервера хватает надолго, карта темы.
2. **Репликация: лидер и реплики**: синхронная, асинхронная и полусинхронная репликация, лаг и его последствия, read-your-writes и monotonic reads, failover и split-brain, multi-leader.
3. **Партиционирование внутри одного узла**: range, list и hash партиции, partition pruning, партиции против индексов, кейс «время плюс TTL».
4. **Шардирование**: выбор ключа, hash против range, горячие ключи, cross-shard запросы и транзакции, решардинг, routing через приложение, прокси или координатор.
5. **Консистентное хеширование**: беда `hash % N`, кольцо, виртуальные узлы, где применяется (кеши, Cassandra, DynamoDB).
6. **Выбор стратегии по сценариям**: read-heavy, write-heavy, мультитенантный SaaS, чеклист вопросов перед масштабированием, CQRS и реплики на чтение.

## Prerequisites

Тема [database-types](../database-types): нужно понимать реляционную и NoSQL-модели, первичный и внешний ключи, разницу OLTP и OLAP. Полезны, но не обязательны, темы [hashing](../hashing) и [message-brokers](../message-brokers).

Generated via `lesson-forge`.

---

## English

# Database Scaling: Replication, Sharding, and Partitioning

A topic for mid-level developers who hit the ceiling of a single database server and want to understand what comes next. Three strategies get confused constantly, even though they solve different problems: replication copies the same data to several nodes for fault tolerance and reads, partitioning cuts a table into chunks inside one node for manageability, sharding spreads data across different nodes for writes and volume. The focus is on mechanics and pitfalls: replication lag and read-your-writes, choosing a shard key and hot keys, consistent hashing versus `hash % N`, cross-shard queries and the pain of resharding. Interview-level coverage, not tied to a specific database engine. After this topic you'll be able to pick a strategy for a given scenario and explain why it fits.

## Concepts

1. **Vertical and horizontal scaling**: the ceiling of scale-up, splitting read and write paths, when one server is enough for a long time, a map of the topic.
2. **Replication: leader and replicas**: synchronous, asynchronous, and semi-synchronous replication, lag and its consequences, read-your-writes and monotonic reads, failover and split-brain, multi-leader.
3. **Partitioning within a single node**: range, list, and hash partitions, partition pruning, partitions versus indexes, the "time plus TTL" case.
4. **Sharding**: choosing a key, hash versus range, hot keys, cross-shard queries and transactions, resharding, routing through the application, a proxy, or a coordinator.
5. **Consistent hashing**: the trouble with `hash % N`, the ring, virtual nodes, where it's used (caches, Cassandra, DynamoDB).
6. **Choosing a strategy by scenario**: read-heavy, write-heavy, multi-tenant SaaS, a checklist of questions before scaling, CQRS and read replicas.

## Prerequisites

The [database-types](../database-types) topic: you need to understand the relational and NoSQL models, primary and foreign keys, and the difference between OLTP and OLAP. The [hashing](../hashing) and [message-brokers](../message-brokers) topics are helpful but not required.

Generated via `lesson-forge`.
