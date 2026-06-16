# ORM and Raw SQL in Python (SQLAlchemy)

How Python talks to a database: from low-level DB-API (`sqlite3`) with parameterization and transactions to SQLAlchemy 2.x ORM in modern style — declarative models with `Mapped`, queries via `select()`, `relationship()` links, and fixing the N+1 problem.

## Concepts

1. **Raw SQL in Python** — connections, cursors, parameterized queries, transactions.
2. **ORM mental model** — what maps to what, SQLAlchemy 2.x models, identity map and unit of work.
3. **Queries and relationships** — `select()`, joins, `relationship()`, lazy vs eager loading.
4. **N+1 and Session pitfalls** — spotting query floods, `selectinload`/`joinedload`, `DetachedInstanceError`, when raw SQL wins.

## Prerequisites

SQL Fundamentals (`SELECT`, `JOIN`, filtering).

## Estimated effort

About 3.5 hours.

## Runtime

`pyodide` — Python runs entirely in your browser. No setup.

Generated via `lesson-forge`.
