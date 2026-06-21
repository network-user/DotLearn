---
name: sync-project-rules
description: >-
  Перегенерирует правила проекта для AI-агентов из фактов репозитория: AGENTS.md (канон),
  .cursor/rules/dotcore-project.mdc, CLAUDE.md, GEMINI.md. Без README, обложки, бейджей, LoC
  и аудита - лёгкая часть стандарта DotCore, держит команды/структуру/conventions в AGENTS.md
  в синхроне с кодом. Use when нужно обновить AGENTS.md или правила агентов после изменения
  команд, скриптов, модулей, зависимостей или структуры, но без полной регенерации README.
  Вызывается напрямую и как шаг 5 скилла generate-readme.
---

# Sync Project Rules

Лёгкий скилл DotCore: перегенерирует **правила для агентов** (`AGENTS.md` + нативные rule-файлы), не трогая README, обложку, бейджи, LoC и аудит. Для частого случая «изменились команды или структура, надо обновить `AGENTS.md`» - без тяжёлого `generate-readme`.

Главное правило: **читай репозиторий, не выдумывай**. Источник правды - `package.json`, `Makefile`, `pyproject.toml`, `docker-compose.yml`, CI, код. Старый `AGENTS.md` - не авторитет; при расхождении верь коду.

Связь с `generate-readme`: этот скилл владеет шаблонами правил. `generate-readme` вызывает его на шаге 5 (правила), а сам отвечает за README, обложку, бейджи, LoC, лицензию и аудит. README этот скилл **не трогает**.

## Когда применять

- Изменились команды/скрипты, модули, зависимости, runtime или структура - обновить `AGENTS.md`
- Перегенерировать `.cursor/rules/dotcore-project.mdc`, `CLAUDE.md`, `GEMINI.md`
- Запросы: «обнови AGENTS.md», «синхронизируй правила проекта», «обнови правила агентов»
- Как шаг правил внутри `generate-readme`

Нужен полный README (обложка, бейджи, пересчёт LoC, аудит) - это `generate-readme`, не этот скилл. Здесь README остаётся как есть.

## Язык и тон

- **Русский**, если проект не целиком на английском. Пакеты и техтермины - как в коде.
- Тон сухой, internal doc. `AGENTS.md` и README - один язык; `.mdc`/`CLAUDE.md`/`GEMINI.md` - кратко на том же языке.

## Workflow

### 1. Scan (только rules-relevant)

| Категория            | Где смотреть                                                            |
| -------------------- | ----------------------------------------------------------------------- |
| Runtime              | `engines`, `.nvmrc`, `pyproject.toml`, `go.mod`, `Cargo.toml`           |
| Команды              | `scripts`, `Makefile`, `pyproject` scripts, CI `.github/workflows/`     |
| Зависимости          | `dependencies`, `devDependencies`, `requirements`                       |
| Окружение            | `docker-compose.yml`, `Dockerfile`, `.env.example` (имена, не значения) |
| Тесты / lint         | CI, `pytest.ini`, `eslint.config`, `vitest.config`                      |
| Структура            | `apps/`, `packages/`, `src/` - модули по факту                          |
| Существующие правила | `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, `GEMINI.md`                 |

Спорное - проверь по коду. README **не читаем как авторитет** и не правим.

### 2. Determine launching agent

Определи, из какого агента запущен скилл, и **обязательно** создай/обнови его нативный rule-файл (таблица в [templates.md](templates.md)); если папки нет - создай. `AGENTS.md` пишется всегда, независимо от агента.

### 3. Regenerate AGENTS.md

Перепиши каркас по шаблону из [templates.md](templates.md): профиль, быстрый старт, таблица команд, структура, соглашения, env, «что делать / чего не делать», правило README-sync. **Слияние обязательно** - см. ниже.

### 4. Regenerate rule files

`.cursor/rules/dotcore-project.mdc` (`alwaysApply: true`), `CLAUDE.md` (обёртка → AGENTS.md), `GEMINI.md` - по [templates.md](templates.md). Только те, что нужны (агент запуска + уже существующие в репо).

### 5. Embed README-sync rule

В `AGENTS.md`, `CLAUDE.md`, `.mdc` встрой правило: при **глобальных** изменениях (команды, модули, зависимости, архитектура, runtime) агент обновляет README через `generate-readme`. Определения глобального/не-глобального - в [templates.md](templates.md).

## Слияние, не затирание (критично)

Богатый проект-специфичный `AGENTS.md` (кастомные секции: backend, i18n, security, доменные правила) **не затирай**. Перегенерируй каркас (профиль, команды, структура, conventions, запреты) и **сохрани уникальные секции** проекта. Fresh regeneration каркаса ≠ потеря проектного контента. Уникальные правила из старого `CLAUDE.md`/`.cursorrules` - слей в `AGENTS.md`. Подробности и таблица миграции - в [templates.md](templates.md).

## Self-check

- [ ] `AGENTS.md` обновлён; команды сверены с `package.json`/`Makefile`/CI (не выдуманы)
- [ ] Проект-специфичные секции старого `AGENTS.md` сохранены (слияние, не затирание)
- [ ] Rule-файл агента запуска создан; папка создана, если её не было
- [ ] `AGENTS.md`/`CLAUDE.md`/`.mdc` содержат правило README-sync
- [ ] `.cursor/rules/dotcore-project.mdc` существует с `alwaysApply: true` (если Cursor в репо)
- [ ] `CLAUDE.md` ссылается на `AGENTS.md`, не дублирует его
- [ ] README **не тронут**; обложка, бейджи, LoC, лицензия не менялись
- [ ] Числа, пути, версии - только из репозитория

## Файлы скилла

| Файл                               | Назначение                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| [SKILL.md](SKILL.md)               | Workflow (этот файл)                                                                |
| [templates.md](templates.md)       | Шаблоны AGENTS.md, .mdc, CLAUDE.md, GEMINI.md; агент запуска; README-sync; миграция |
| [README.md](README.md)             | Описание для людей, установка, триггеры                                             |
| [PROMPT.md](PROMPT.md)             | Standalone для чатов без skills                                                     |
| [codex-prompt.md](codex-prompt.md) | Промпт `/sync-project-rules` для Codex                                              |
