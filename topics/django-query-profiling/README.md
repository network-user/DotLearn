# Query Profiling: Query Counter and Silk

How to find and eliminate extra SQL queries in a Django application. You will learn to recognize the N+1 problem, count queries manually and in tests (`connection.queries`, `assertNumQueries`), capture profiles with django-silk, and read them to turn dozens of identical queries into one. For backend developers who already write ORM queries but see slow pages and want to know why.

## Concepts

1. **Why count queries: the N+1 problem** - where extra queries come from and why one loop over a queryset becomes N+1 database round-trips.
2. **Counting queries: connection.queries, assertNumQueries** - measuring query count in code and locking it in with tests.
3. **django-silk: profiler and SQL inspection** - setup, middleware, reading the query list and timings in the UI.
4. **Reading profiles and fixing N+1** - finding duplicate queries in a profile and removing them with `select_related` / `prefetch_related`.

## Prerequisites

- `python-orm`

## Estimated effort

About 3 hours.

## Runtime

No runtime required - examples are code and numbers; profiling tools are introduced along the way.
