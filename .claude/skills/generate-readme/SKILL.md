---
name: generate-readme
description: >-
  Создаёт или обновляет README.md в стандарте DotCore (русский internal doc, SVG-обложка
  DotBioSite, flat-бейджи, LoC через code-counter, ASCII-архитектура) и перегенерирует
  правила проекта для агентов: AGENTS.md, .cursor/rules/dotcore-project.mdc, CLAUDE.md.
  Факты только из репозитория. Классификация типа проекта, аудит 1-10. Cursor, Claude Code,
  Codex. Use when creating or updating README, AGENTS.md, or project documentation.
triggers:
  - generate readme
  - generate-readme
  - создай readme
  - создать readme
  - обнови readme
  - перепиши readme
  - readme.md
  - project documentation
  - документация проекта
files:
  - README.md
  - AGENTS.md
  - CLAUDE.md
  - docs/**
  - .cursor/rules/**
---

# Generate README + Project Rules

Единый скилл DotCore: **README для человека** + **правила для агентов** в каждом репозитории, где он запущен.

Главное правило: **читай репозиторий, не выдумывай**. Источник правды - `package.json`, `Makefile`, `pyproject.toml`, `docker-compose.yml`, CI, код. Старый README / AGENTS.md / CLAUDE.md - не авторитет; при расхождении верь коду.

## Когда применять

- Создать или обновить `README.md`
- Перегенерировать `AGENTS.md`, `.cursor/rules/dotcore-project.mdc`, `CLAUDE.md`
- Привести документацию к стандарту DotCore после рефакторинга
- Запросы: «обнови README», «сгенерируй документацию», «настрой правила проекта»

При обновлении - **перегенерируй**, не латай: убери centered hero, `<details>`, битые `<img>`, устаревшие команды.

## Язык и тон

- **Русский**, если проект не целиком на английском. Пакеты и техтермины - как в коде.
- Тон сухой, как internal doc. Не marketing, не landing page, не storytelling.
- README и AGENTS.md - один язык; CLAUDE.md и `.mdc` - кратко на том же языке.

## Workflow (7 шагов)

### 1. Scan

Собери факты (как readme-crafter / project-documenter - только из репо):

| Категория | Где смотреть |
|-----------|--------------|
| Runtime | `engines`, `.nvmrc`, `pyproject.toml`, `go.mod`, `Cargo.toml` |
| Команды | `scripts`, `Makefile`, `pyproject` scripts, `composer.json` |
| Зависимости | `dependencies`, `devDependencies`, `requirements` |
| Окружение | `docker-compose.yml`, `Dockerfile`, `.env.example` (имена, не значения) |
| Тесты / lint | CI `.github/workflows/`, `pytest.ini`, `eslint.config` |
| Структура | `apps/`, `packages/`, `src/`, `topics/` - считай модули по факту |
| Строки кода | `code-counter` (см. ниже) |
| Обложка | `docs/preview.png`, `docs/cover.svg` |
| Существующие правила | `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, `CONTRIBUTING.md` |
| Remote | `git remote -v` → github/gitlab или local |

Спорное - проверь по коду. Запиши черновик классификации (шаг 2).

### 2. Classify

Определи профиль по [project-classify.md](project-classify.md): `project_type`, `audience`, `distribution`, `cover_mode`.

### 3. Cover mode

SVG-обложка DotBioSite - агент пишет текстом. Детали: [logo-cover.md](logo-cover.md).

| cover_mode | Действие |
|------------|----------|
| `file` | `docs/cover.svg` + `<img width="720">` в README |
| `inline` | inline `<svg>` после badges |
| `preview` | `<img src="docs/preview.png">`, SVG не трогать |

### 4. Write README

Структура (порядок строгий):

```
# {brand}
[3 flat badges]     Runtime · Platform · Category
[cover]
[LoC badge]         <!-- loc:start --> … <!-- loc:end -->
{intro}             до 3 предложений

## Что внутри       ОПЦ. - см. project-classify.md
## Запуск
## Команды          таблица из scripts
## Стек             for-the-badge <img> только
## Тесты / …        если есть в репо
## Архитектура      ПОСЛЕДНЯЯ: абзац + ASCII-дерево + 3-6 инвариантов
```

- **intro** - что это + одно ключевое решение. Без tagline-абзаца и маркетинговых буллетов.
- **Что внутри** - факты и числа, `**ключ**: значение`, без emoji. Не для library/cli без UX.
- **Архитектура** - ASCII, не mermaid если дерева хватает. После неё секций нет.

Бейджи и LoC: [stack-badges.md](stack-badges.md). Эталон: [reference.md](reference.md).

### 5. Write project rules

Перегенерируй файлы по [project-rules.md](project-rules.md):

1. `AGENTS.md` - канон для всех агентов (Codex, Cursor, Claude, Copilot)
2. `.cursor/rules/dotcore-project.mdc` - Cursor rule, `alwaysApply: true`
3. `CLAUDE.md` - обёртка → AGENTS.md
4. `docs/portfolio-draft.md` - только если `audience=portfolio`

Fresh regeneration: не копируй устаревшие блоки. Уникальные инструкции из старого CLAUDE.md/AGENTS.md - слей в AGENTS.md.

### 6. Validate

Self-check (ниже) + аудит [audit.md](audit.md). Минимум **8/10**. Исправь замечания до отчёта.

### 7. LoC finalize

В конце сессии:

```bash
pip install code-counter-ntwusr   # один раз, Python 3.12+ и git
code-counter .
```

Обнови `{N}` в LoC-бейдже между `<!-- loc:start -->` и `<!-- loc:end -->`. Число без запятых.

## Счётчик строк кода

LoC - **под cover**, перед intro. Только `<img>`, не `![]()`.

```markdown
<!-- loc:start --><img src="https://img.shields.io/badge/lines_of_code-{N}-lightgrey?style=flat" alt="{N} lines of code" /><!-- loc:end -->
```

Если `code-counter` недоступен - посчитай по git и укажи метод. Не выдумывай.

## Чего не делать

- marketing, `<details>`, centered hero, emoji, длинное тире, LLM-маркеры
- mermaid вместо ASCII-дерева где хватает дерева
- for-the-badge в header; plain-text в `## Стек`
- выдуманные команды, пути, env, версии, LoC
- `<img>` на несуществующий файл; `docs/readme-hero.svg`
- дублировать README в AGENTS.md; секреты в любых файлах
- «Generated with AI» / «Powered by» трейлеры

## Human voice

- Одно точное предложение лучше трёх с водой
- Буллеты: `**ключ**: значение`
- Числа сверяй с репо
- README - для разработчика; AGENTS.md - для агента (build/test/conventions)

## Чего не включать в README

- Contributing / License - только если уже значимы в репо
- Roadmap, бенчмарки, star-hunting
- Длинные operational-инструкции для агентов (они в AGENTS.md)
- Бейджи технологий без deps

## Self-check

**README**

- [ ] Русский (или EN-only); тон internal doc
- [ ] Cover по режиму; SVG tagline на русском; нет битых img
- [ ] Header flat ×3; LoC под cover в маркерах
- [ ] Команды из scripts; стек из deps; архитектура последняя
- [ ] `## Что внутри` уместна и с числами

**Project rules**

- [ ] `AGENTS.md` перегенерирован, команды проверены
- [ ] `.cursor/rules/dotcore-project.mdc` существует
- [ ] `CLAUDE.md` → AGENTS.md, без дубля
- [ ] `docs/portfolio-draft.md` только для portfolio

**Аудит**

- [ ] Оценка ≥ 8/10 по [audit.md](audit.md)

## Файлы скилла

| Файл | Назначение |
|------|------------|
| [SKILL.md](SKILL.md) | Workflow (этот файл) |
| [project-classify.md](project-classify.md) | Тип, аудитория, cover mode |
| [project-rules.md](project-rules.md) | AGENTS.md, .mdc, CLAUDE.md, portfolio |
| [logo-cover.md](logo-cover.md) | SVG DotBioSite |
| [stack-badges.md](stack-badges.md) | Shields, LoC |
| [audit.md](audit.md) | Оценка 1-10 |
| [reference.md](reference.md) | Пример README (DotLearn) |
| [PROMPT.md](PROMPT.md) | Standalone без skills |
| [codex-prompt.md](codex-prompt.md) | Промпт `/generate-readme` для Codex |
| [README.md](README.md) | Установка Cursor / Claude / Codex / проект |
