# Типы баз данных

Обзорный курс по ландшафту баз данных: какие бывают модели данных, как они устроены внутри, какие проблемы решают и где у каждой свои подводные камни. От исторических иерархических и сетевых баз через реляционные к семейству NoSQL - документным, ключ-значение, колоночным и графовым - и до того, как осознанно выбирать модель под задачу (CAP, OLTP против OLAP, polyglot persistence).

Курс концептуальный: упор на понимание устройства и компромиссов, а не на синтаксис конкретной СУБД. Каждый урок несёт интерактивные визуализации модели данных.

## Концепты

1. **Модель данных** - что такое база, чем модели отличаются, по каким осям их сравнивать.
2. **Иерархическая и сетевая модели** - навигационные базы, дерево и граф записей, почему их вытеснили и где они живут сегодня.
3. **Реляционные базы** - таблицы и отношения, нормализация, ACID, транзакции.
4. **Документные базы** - JSON-документы, гибкая схема, агрегаты и денормализация.
5. **Ключ-значение** - простейшая модель доступа, кэш и сессии, цена простоты.
6. **Колоночные и wide-column** - построчное против поколоночного хранения, аналитика и масштаб.
7. **Графовые базы и выбор модели** - связи как первоклассный объект, CAP, OLTP/OLAP, polyglot persistence.

## Предварительные требования

Формально нет. Урок про реляционные базы будет понятнее, если вы уже прошли курс «Основы SQL» (`sql-fundamentals`), но это не обязательно.

## Время прохождения

Около 5,5 часов.

## Среда выполнения

`none` - тема теоретическая, без выполнения кода. Внутри уроков встроены интерактивные схемы и одна живая SQL-песочница для реляционной модели.

---

## English

# Database Types

A survey course on the database landscape: data models, how they work inside, what problems each solves, and where the tradeoffs bite. From historical hierarchical and network databases through relational to the NoSQL family - document, key-value, column, and graph - and how to choose a model for the job (CAP, OLTP vs OLAP, polyglot persistence).

The course is conceptual: focus on structure and tradeoffs, not syntax of a specific DBMS. Each lesson includes interactive data model visualizations.

### Concepts

1. **Data models** - what a database is, how models differ, axes for comparison.
2. **Hierarchical and network models** - navigational databases, trees and record graphs, why they were displaced and where they live today.
3. **Relational databases** - tables and relationships, normalization, ACID, transactions.
4. **Document databases** - JSON documents, flexible schema, aggregates and denormalization.
5. **Key-value stores** - the simplest access model, cache and sessions, the price of simplicity.
6. **Column and wide-column stores** - row vs column storage, analytics and scale.
7. **Graph databases and model choice** - relationships as first-class objects, CAP, OLTP/OLAP, polyglot persistence.

### Prerequisites

None formally. The relational lesson is easier if you have completed SQL Fundamentals (`sql-fundamentals`), but it is not required.

### Estimated time

About 5.5 hours.

### Runtime

`none` - theoretical topic, no code execution. Lessons include interactive diagrams and one live SQL sandbox for the relational model.
