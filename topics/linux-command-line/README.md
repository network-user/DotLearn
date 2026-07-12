# Командная строка Linux

Практический курс для тех, кто побаивается терминала. Разбирает команды, которые реально нужны каждый день: перемещение по файловой системе, копирование и удаление файлов, права доступа, пайпы и перенаправление, поиск через `grep` и `find`, управление процессами и переменные окружения. После курса чёрное окно перестаёт пугать: вы понимаете, где находитесь, что делает каждая команда и как из маленьких утилит собирать конвейеры.

## Концепты

1. **Файловая система и навигация**: дерево каталогов, `pwd`, `ls`, `cd`, абсолютные и относительные пути.
2. **Работа с файлами**: `mkdir`, `touch`, `cp`, `mv`, `rm`, `cat` и почему удаление необратимо.
3. **Права доступа**: чтение строки `ls -l`, триады rwx, `chmod` в символьной и восьмеричной записи.
4. **Пайпы и перенаправление**: потоки stdin/stdout/stderr, операторы `>`, `>>`, `2>`, `|` и конвейеры.
5. **Поиск**: `grep` ищет внутри файлов, `find` ищет сами файлы; ключи, шаблоны, подводные камни.
6. **Процессы**: PID, `ps`, `top`, сигналы, разница между `kill` и `kill -9`.
7. **Переменные окружения и PATH**: `export`, наследование окружения, как шелл находит команды.

## Предварительные требования

Нет. Достаточно любого компьютера с терминалом: Linux, macOS или WSL под Windows.

## Время прохождения

Около 1,5 часов.

## Среда выполнения

`none`: тема теоретическая, команды показаны в детерминированных сессиях терминала, вывод которых вы учитесь предсказывать.

---

## English

# Linux Command Line

A practical course for anyone intimidated by the terminal. It covers the commands you actually need every day: moving around the filesystem, copying and deleting files, permissions, pipes and redirection, searching with `grep` and `find`, managing processes, and environment variables. By the end, the black window stops being scary: you know where you are, what each command does, and how to chain small utilities into pipelines.

## Concepts

1. **Filesystem and navigation**: directory tree, `pwd`, `ls`, `cd`, absolute and relative paths.
2. **Working with files**: `mkdir`, `touch`, `cp`, `mv`, `rm`, `cat`, and why deletion is irreversible.
3. **Permissions**: reading `ls -l` output, rwx triads, `chmod` in symbolic and octal notation.
4. **Pipes and redirection**: stdin/stdout/stderr streams, the `>`, `>>`, `2>`, `|` operators, and pipelines.
5. **Search**: `grep` searches inside files, `find` searches for files themselves; flags, patterns, pitfalls.
6. **Processes**: PIDs, `ps`, `top`, signals, the difference between `kill` and `kill -9`.
7. **Environment variables and PATH**: `export`, environment inheritance, how the shell locates commands.

## Prerequisites

None. Any computer with a terminal is enough: Linux, macOS, or WSL on Windows.

Generated via `lesson-forge`.
