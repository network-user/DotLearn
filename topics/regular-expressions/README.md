# Регулярные выражения

Тема для разработчика, который пишет регулярки методом тыка и хочет наконец читать их бегло. Семь концептов ведут от литералов и классов символов через квантификаторы, группы, якоря и lookaround к флагам и модулю `re` в Python с его типичными ловушками: жадный `.*`, `findall` с группами, забытая r-строка. Синтаксис даётся в универсальной нотации, все исполняемые примеры и упражнения работают на модуле `re` и русском материале: телефоны, даты, ФИО, индексы.

---

## English

# Regular Expressions in Python

A topic for developers who write regexes by trial and error and want to finally read them fluently. Seven concepts move from literals and character classes through quantifiers, groups, anchors, and lookaround to engine flags and Python's `re` module with its classic pitfalls: greedy `.*`, `findall` with groups, a forgotten raw string. Syntax is taught in universal notation; all runnable examples and exercises work against the `re` module and Cyrillic-context material: phone numbers, dates, full names, postal codes.

## Concepts

1. Literals and character classes
2. Quantifiers and greediness
3. Groups, captures, and alternation
4. Anchors and word boundaries
5. Lookahead and lookbehind
6. Flags: engine modes
7. The re module: functions and pitfalls

## Prerequisites

- `python-basics` - regexes are used through Python's `re` module and its functions (`match`, `search`, `findall`, `sub`), so basic familiarity with Python syntax and strings is required.

Generated via `lesson-forge`.
