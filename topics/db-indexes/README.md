# Индексы в БД и EXPLAIN

Запрос к таблице на миллион строк может выполниться за микросекунды, а может перебрать все строки до одной - разницу решает индекс. Топик объясняет, почему индекс ускоряет чтение и чем платит на записи, разбирает устройство B-tree (страницы, высота-логарифм, диапазоны и сортировка без сортировки), учит проектировать составные и покрывающие индексы по правилу leftmost prefix, показывает грабли, из-за которых индекс молча перестаёт работать (функция над колонкой, ведущий `%`, неявные приведения, низкая селективность, устаревшая статистика), и в финале ставит `EXPLAIN QUERY PLAN` вживую в песочнице sql.js: как отличить `SCAN` от `SEARCH`, что такое `USING COVERING INDEX` и как план ловит N+1 из темы python-orm. Для middle Python-разработчика, который пишет запросы через ORM или руками и хочет понимать, что происходит под капотом. Runtime - sql.js (диалект SQLite), всё исполняется прямо в браузере.

## Концепты

1. **Зачем нужны индексы** - full scan против точечного доступа, цена индекса на записи и месте, когда индекс не нужен.
2. **B-tree под капотом** - страницы и ветвление, высота как логарифм, точечный поиск и диапазоны, ORDER BY по индексу; почему B-tree, а не hash.
3. **Составные и покрывающие индексы** - порядок колонок и leftmost prefix, равенство слева плюс диапазон справа, index-only scan, лишний второй индекс.
4. **Когда индекс не работает** - функция над колонкой, `LIKE '%...'`, `OR` по разным колонкам, неявные приведения типов, низкая селективность, ANALYZE.
5. **EXPLAIN: читаем план запроса** - `EXPLAIN QUERY PLAN` в SQLite, `SCAN` против `SEARCH`, `USING INDEX` и `USING COVERING INDEX`, отличия от `EXPLAIN ANALYZE` в Postgres, связь с N+1.

## Предварительные требования

- `sql-fundamentals` - SELECT, WHERE, JOIN, GROUP BY, ORDER BY.

## Ориентировочное время

Около 3.5 часов.

## Runtime

`sql.js` (диалект SQLite) исполняется целиком в браузере, без установки.

---

## English

# Database Indexes and EXPLAIN

A query against a million-row table can finish in microseconds or scan every single row - the index makes the difference. This topic explains why an index speeds up reads and what it costs on writes, breaks down how a B-tree is built (pages, height as a logarithm, ranges and sorting for free), teaches you to design composite and covering indexes with the leftmost-prefix rule, walks through the traps that silently disable an index (a function over a column, a leading `%`, implicit casts, low selectivity, stale statistics), and finishes by running `EXPLAIN QUERY PLAN` live in the sql.js sandbox: how to tell `SCAN` from `SEARCH`, what `USING COVERING INDEX` means, and how a plan catches an N+1 from the python-orm topic. For a mid-level Python developer who writes queries through an ORM or by hand and wants to understand what happens under the hood. Runtime is sql.js (SQLite dialect), everything runs right in the browser.

## Concepts

1. **Why indexes matter** - full scan vs. point access, the cost of an index on writes and disk space, when an index isn't worth it.
2. **B-tree under the hood** - pages and branching, height as a logarithm, point lookups and ranges, ORDER BY for free; why B-tree and not hash.
3. **Composite and covering indexes** - column order and the leftmost-prefix rule, equality on the left plus a range on the right, index-only scans, a redundant second index.
4. **When an index stops working** - a function over a column, `LIKE '%...'`, `OR` across different columns, implicit type casts, low selectivity, ANALYZE.
5. **EXPLAIN: reading a query plan** - `EXPLAIN QUERY PLAN` in SQLite, `SCAN` vs. `SEARCH`, `USING INDEX` and `USING COVERING INDEX`, how it differs from Postgres's `EXPLAIN ANALYZE`, the connection to N+1.

## Prerequisites

- `sql-fundamentals` - SELECT, WHERE, JOIN, GROUP BY, ORDER BY.

Generated via `lesson-forge`.
