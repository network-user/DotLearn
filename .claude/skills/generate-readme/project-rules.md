# Правила проекта для агентов

При каждом запуске скилла **перегенерируй** файлы ниже из данных Scan. Не латай старые версии: fresh regeneration, как в project-documenter. Источник правды - код и манифесты, не предыдущий `AGENTS.md`.

## Разделение ролей (стандарт agents.md)

| Файл | Для кого | Содержание |
|------|----------|------------|
| `README.md` | человек-разработчик | DotCore internal doc: запуск, команды, стек, архитектура |
| `AGENTS.md` | все coding-агенты | build, test, lint, conventions, запреты, указатели |
| `.cursor/rules/dotcore-project.mdc` | Cursor | краткий контекст + ссылка на AGENTS.md |
| `CLAUDE.md` | Claude Code | тонкая обёртка → AGENTS.md |
| `docs/portfolio-draft.md` | DotBioSite | только если `audience=portfolio` |

README остаётся сухим техдоком. Операционные инструкции для агентов - в `AGENTS.md`, не дублируй длинные command-листы в README.

## Порядок записи (шаг 5 workflow)

1. `AGENTS.md` - канонический файл
2. `.cursor/rules/dotcore-project.mdc` - создай `.cursor/rules/` если нет
3. `CLAUDE.md` - обёртка
4. `docs/portfolio-draft.md` - если `audience=portfolio`

Codex, Jules, Aider, Copilot читают корневой `AGENTS.md` нативно - отдельный файл для Codex не нужен.

---

## Шаблон `AGENTS.md`

Перепиши целиком. Язык: **русский** (как README), техтермины и команды - как в репо. Целевой объём: **80-150 строк**, TOC-стиль, без marketing.

```markdown
# AGENTS.md

> Инструкции для AI coding agents. Человеческий обзор - в [README.md](README.md).
> Перегенерировано скиллом `generate-readme`. Источник правды - код репозитория.

## Профиль проекта

- **Тип:** {project_type}
- **Аудитория:** {audience}
- **Runtime:** {primary_runtime}
- **Монорепо:** {yes|no}

## Быстрый старт

```bash
{реальные install + dev команды, 2-4 строки}
```

{порт, URL, если есть}

## Сборка и проверки

| Действие | Команда |
|----------|---------|
| Установка | `{cmd}` |
| Dev | `{cmd}` |
| Тесты | `{cmd или «нет тестов в репо»}` |
| Lint / typecheck | `{cmd или —}` |
| Build | `{cmd или —}` |

Команды - только из `package.json` / `Makefile` / `pyproject.toml` / CI.

## Структура репозитория

{ASCII-дерево 2-3 уровня - то же что в README ## Архитектура, можно короче}

## Соглашения

- **Язык документации:** русский (если проект не EN-only).
- **Стиль кода:** {из eslint/ruff/pyproject/black, или «следуй существующим файлам»}
- **Именование:** {паттерны из репо}
- **Монорепо:** {filter-команды turbo/pnpm/npm workspaces, если есть}

## Переменные окружения

| Переменная | Назначение |
|------------|------------|
| `{NAME}` | {из .env.example / docker-compose / README, без значений} |

Не читай `.env`. Не коммить секреты.

## Что делать агенту

- Перед правками прочитай затронутые файлы и соседний код.
- После изменений запусти релевантные тесты/lint из таблицы выше.
- Обновляй `README.md` и `AGENTS.md` через скилл `generate-readme`, не вручную латай разметку.
- Минимальный diff - не рефактори несвязанный код.
- Числа, пути, версии - только из репозитория.

## Чего не делать

- Не выдумывать команды, зависимости, env, API endpoints.
- Не добавлять `<details>`, centered hero, emoji в README DotCore.
- Не менять `docs/cover.svg` без регенерации обложки.
- Не коммитить секреты, токены, `.env`.
- Не удалять маркеры `<!-- loc:start -->` / `<!-- loc:end -->` в README.

## Документация

- [README.md](README.md) - запуск, команды, стек, архитектура
- {ссылки на ARCHITECTURE.md, docs/, CONTRIBUTING - только если файлы существуют}

## DotCore

Проект следует стандарту DotCore: плоский технический README, SVG-обложка DotBioSite, LoC-бейдж. При запросе «обнови README» используй скилл `generate-readme`.
```

Удали пустые секции (например «Переменные окружения» если нет `.env.example`).

---

## Шаблон `.cursor/rules/dotcore-project.mdc`

Имя файла фиксировано: `dotcore-project.mdc`. При конфликте с другими rules - **обнови этот файл**, не создавай дубликат.

```markdown
---
description: DotCore контекст проекта - сборка, тесты, соглашения. Читай AGENTS.md для деталей.
globs:
  - "**/*"
alwaysApply: true
---

# DotCore Project Context

Канонические инструкции: [AGENTS.md](../../AGENTS.md) в корне репозитория.

## Кратко

- **Тип:** {project_type}
- **Установка:** `{install_cmd}`
- **Dev:** `{dev_cmd}`
- **Тесты:** `{test_cmd или нет}`

## Правила

- Источник правды - код, не устаревший README.
- README в стандарте DotCore: без marketing, без `<details>`, без centered hero.
- Обложка: {docs/cover.svg для GitHub | inline SVG для IDE}.
- LoC-бейдж между `<!-- loc:start -->` и `<!-- loc:end -->`.
- Минимальный scope изменений.

## README

Человеческая документация: [README.md](../../README.md). Не дублируй её целиком в чат - ссылайся на секции.

Перегенерация: скилл `generate-readme` (обновляет README + AGENTS.md + этот rule).
```

Путь `../../AGENTS.md` корректен для `.cursor/rules/dotcore-project.mdc`.

---

## Шаблон `CLAUDE.md`

Тонкая обёртка (15-25 строк). **AGENTS.md - единый источник правды.**

```markdown
# Claude Code

Прочитай [AGENTS.md](AGENTS.md) перед любой задачей в этом репозитории.

## Приоритет контекста

1. Явный запрос пользователя
2. [AGENTS.md](AGENTS.md)
3. [README.md](README.md)
4. Код в затронутых файлах

## Триггеры

- «Обнови README» / «сгенерируй README» → скилл `generate-readme`
- Правки документации → стандарт DotCore (см. AGENTS.md)

Не дублируй содержимое AGENTS.md здесь - обновляй AGENTS.md через скилл.
```

Если в репо уже был развёрнутый `CLAUDE.md` с уникальными инструкциями - **слей**: сохрани проект-специфичные секции, которые не входят в шаблон, и добавь ссылку на AGENTS.md как канон.

---

## Шаблон `docs/portfolio-draft.md`

Только при `audience=portfolio`. Не вставляй в README.

```markdown
# Черновик для DotBioSite

> Служебный файл. Не для читателей репозитория. Копировать в `src/content/projects/{slug}.json`.

**Слоган:** {одна строка}
**Описание:** {2-3 предложения, сухо, факты}
**Факты:** {3-4 факта через ·}
**Стек:** {основные технологии через ·}

## Соответствие JSON

| Поле здесь | Ключ DotBioSite |
|------------|-----------------|
| Слоган | `tagline.ru` |
| Описание | `description.ru` |
| Факты | `highlights` |
| Стек | `stack` |
```

---

## Миграция и слияние

| Ситуация | Действие |
|----------|----------|
| Есть `.cursorrules` (legacy) | Перенеси уникальные правила в `AGENTS.md`, не копируй в README |
| Есть `CLAUDE.md` с контентом | Слей уникальное в AGENTS.md или оставь секцию «Дополнительно» в CLAUDE.md |
| Есть `AGENTS.md` устаревший | Перегенерируй целиком из Scan |
| Нет `.cursor/` | Создай `.cursor/rules/dotcore-project.mdc` |
| Monorepo с пакетами | Один AGENTS.md в корне; вложенные AGENTS.md - только если уже есть в subpackages (не создавай без запроса) |

## Чеклист project rules

- [ ] `AGENTS.md` переписан целиком, команды проверены по манифестам.
- [ ] `.cursor/rules/dotcore-project.mdc` существует, `alwaysApply: true`.
- [ ] `CLAUDE.md` ссылается на AGENTS.md, не дублирует его.
- [ ] Нет секретов и значений из `.env`.
- [ ] `docs/portfolio-draft.md` создан только для portfolio-аудитории.
- [ ] Пути в mdc-файле ведут на реальные `AGENTS.md` и `README.md`.
