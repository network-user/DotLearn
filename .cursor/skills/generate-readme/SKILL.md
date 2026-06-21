---
name: generate-readme
description: >-
  Создаёт или обновляет README.md в стандарте DotCore (русский internal doc, SVG-обложка
  DotBioSite, flat-бейджи, LoC через code-counter, ASCII-архитектура) и перегенерирует
  правила проекта для агентов: AGENTS.md, .cursor/rules/dotcore-project.mdc, CLAUDE.md.
  Факты только из репозитория. Классификация типа проекта, аудит 1-10. Cursor, Claude Code,
  Codex. Use when creating or updating README, AGENTS.md, or project documentation.
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

| Категория            | Где смотреть                                                            |
| -------------------- | ----------------------------------------------------------------------- |
| Runtime              | `engines`, `.nvmrc`, `pyproject.toml`, `go.mod`, `Cargo.toml`           |
| Команды              | `scripts`, `Makefile`, `pyproject` scripts, `composer.json`             |
| Зависимости          | `dependencies`, `devDependencies`, `requirements`                       |
| Окружение            | `docker-compose.yml`, `Dockerfile`, `.env.example` (имена, не значения) |
| Тесты / lint         | CI `.github/workflows/`, `pytest.ini`, `eslint.config`                  |
| Структура            | `apps/`, `packages/`, `src/`, `topics/` - считай модули по факту        |
| Строки кода          | `code-counter` (см. ниже)                                               |
| Обложка              | `docs/preview.png`, `docs/cover.svg`                                    |
| Существующие правила | `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, `CONTRIBUTING.md`           |
| Remote               | `git remote -v` → github/gitlab или local                               |

Спорное - проверь по коду. Запиши черновик классификации (шаг 2).

### 2. Classify

Определи профиль по [project-classify.md](project-classify.md): `project_type`, `audience`, `distribution`, `cover_mode`.

### 3. Cover mode

SVG-обложка DotBioSite - агент пишет текстом. Детали: [logo-cover.md](logo-cover.md).

**Дефолт - GitHub-first: `file`.** README в первую очередь смотрят на github.com, а GitHub **вырезает inline `<svg>`** из markdown - обложки не будет. Поэтому пиши SVG в `docs/cover.svg` и ставь `<img src="docs/cover.svg" width="720">`. `inline` - только для IDE-only репозитория по явному запросу.

| cover_mode      | Действие                                                                          |
| --------------- | --------------------------------------------------------------------------------- |
| `file` (дефолт) | `docs/cover.svg` + `<img width="720">` в README - рендерится и на GitHub, и в IDE |
| `inline`        | inline `<svg>` после badges - **только IDE**, на GitHub не виден                  |
| `preview`       | `<img src="docs/preview.png">`, SVG не трогать                                    |

### 4. Write README

Структура (порядок строгий):

```
# {brand}
[4 flat badges]     Runtime · Platform · Category · LoC
                    LoC = 4-й бейдж В ТОЙ ЖЕ строке header, в маркерах <!-- loc:start -->…<!-- loc:end -->
[cover]
{intro}             до 3 предложений

## Что внутри       ОПЦ. - см. project-classify.md
## Запуск
## Команды          таблица из scripts
## Стек             for-the-badge <img> только
## Тесты / …        если есть в репо
## Архитектура      последняя содержательная: абзац + ASCII-дерево + 3-6 инвариантов
## Лицензия         футер: строгий All Rights Reserved (см. license.md)
```

- **intro** - что это + одно ключевое решение. Без tagline-абзаца и маркетинговых буллетов.
- **Что внутри** - факты и числа, `**ключ**: значение`, без emoji. Не для library/cli без UX.
- **Архитектура** - ASCII, не mermaid если дерева хватает. После неё - только футер `## Лицензия`.
- **Лицензия** - всегда присутствует; по умолчанию строгий All Rights Reserved + файл `LICENSE`. См. [license.md](license.md).

Бейджи и LoC: [stack-badges.md](stack-badges.md). Лицензия: [license.md](license.md). Эталон: [reference.md](reference.md).

### 5. Write project rules

Правила проекта (`AGENTS.md` + нативные rule-файлы агентов) генерирует **подскилл [`sync-project-rules`](../sync-project-rules/SKILL.md)** - он владеет шаблонами. Вызови его и выполни его workflow:

1. `AGENTS.md` - канон для всех агентов (Codex, Cursor, Claude, Copilot, Gemini). **Всегда.**
2. **Rule-файл агента запуска** - `.cursor/rules/dotcore-project.mdc` / `CLAUDE.md` / `GEMINI.md`; создай файл и папку, если их нет.
3. README-sync: при глобальных изменениях агент обновляет README через `generate-readme`, правила - через `sync-project-rules`.

Если `sync-project-rules` не установлен, его шаблоны зеркалированы здесь в [project-rules.md](project-rules.md) (fallback для автономной работы) - используй их.

Сверх правил `generate-readme` добавляет то, что вне scope подскилла:

4. `docs/portfolio-draft.md` - только если `audience=portfolio` (см. [project-rules.md](project-rules.md))
5. Лицензия: `LICENSE` + футер `## Лицензия` (см. [license.md](license.md))

Fresh regeneration: не копируй устаревшие блоки. Уникальные проектные секции старого `AGENTS.md`/`CLAUDE.md` - **слей, не теряй**.

### 6. Validate

Self-check (ниже) + аудит [audit.md](audit.md). Минимум **8/10**. Исправь замечания до отчёта.

### 7. LoC finalize

В конце сессии:

```bash
pip install code-counter-ntwusr   # один раз, Python 3.12+ и git
code-counter .
```

Обнови `{N}` в LoC-бейдже между `<!-- loc:start -->` и `<!-- loc:end -->`. **Сокращай при `N >= 1000`:** floor до тысяч с суффиксом `k+` (`211332` → `211k+`, `5990` → `5k+`), миллионы - `M+`; меньше 1000 - как есть. В URL `+` кодируется как `%2B`.

## Счётчик строк кода

LoC - **4-й бейдж в группе header**, на одном уровне с Runtime · Platform · Category (а не под cover). Чтобы все четыре были в один ряд на GitHub, **все header-бейджи - `<img style=flat>` внутри одного `<p>`** (см. [stack-badges.md](stack-badges.md)). LoC - последним в `<p>`, перед обложкой.

```markdown
<p>
  <img src="https://img.shields.io/badge/Runtime-...-339933?style=flat" alt="Runtime" />
  <img src="https://img.shields.io/badge/Platform-...-555?style=flat" alt="Platform" />
  <img src="https://img.shields.io/badge/Category-...-orange?style=flat" alt="Category" />
  <!-- loc:start --><img src="https://img.shields.io/badge/lines_of_code-{N}-lightgrey?style=flat" alt="{N} lines of code" /><!-- loc:end -->
</p>
```

Маркеры `<!-- loc:start -->` / `<!-- loc:end -->` обязательны - по ним идёт обновление LoC, не удаляй их. Если `code-counter` недоступен - посчитай по git и укажи метод. Не выдумывай.

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

- Contributing - только если уже значим в репо (Лицензия - всегда, футером, см. license.md)
- Roadmap, бенчмарки, star-hunting
- Длинные operational-инструкции для агентов (они в AGENTS.md)
- Бейджи технологий без deps

## Self-check

**README**

- [ ] Русский (или EN-only); тон internal doc
- [ ] Cover по режиму; SVG tagline на русском; нет битых img
- [ ] Header: 4 бейджа `<img style=flat>` внутри одного `<p>` - Runtime · Platform · Category · **LoC (4-й, в маркерах)** - один ряд на GitHub, перед cover
- [ ] Cover для GitHub - `docs/cover.svg` + `<img>` (inline `<svg>` GitHub вырезает); стек - `<img>` for-the-badge в `<p>`
- [ ] Команды из scripts; стек из deps; архитектура - последняя содержательная
- [ ] `## Лицензия` футером (строгий All Rights Reserved), есть файл `LICENSE`
- [ ] `## Что внутри` уместна и с числами

**Project rules**

- [ ] `AGENTS.md` перегенерирован, команды проверены
- [ ] Rule-файл агента запуска создан (папка создана, если её не было)
- [ ] `AGENTS.md`/`CLAUDE.md`/`.mdc` содержат правило README-sync (обновлять README при глобальных изменениях)
- [ ] `.cursor/rules/dotcore-project.mdc` существует
- [ ] `CLAUDE.md` → AGENTS.md, без дубля
- [ ] `docs/portfolio-draft.md` только для portfolio

**Аудит**

- [ ] Оценка ≥ 8/10 по [audit.md](audit.md)

## Файлы скилла

| Файл                                       | Назначение                                                                                                                         |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| [SKILL.md](SKILL.md)                       | Workflow (этот файл)                                                                                                               |
| [project-classify.md](project-classify.md) | Тип, аудитория, cover mode                                                                                                         |
| [project-rules.md](project-rules.md)       | Зеркало/fallback правил (канон - подскилл `sync-project-rules`): AGENTS.md, .mdc, CLAUDE.md, portfolio, агент запуска, README-sync |
| [license.md](license.md)                   | Лицензия (строгий All Rights Reserved), LICENSE + футер                                                                            |
| [logo-cover.md](logo-cover.md)             | SVG DotBioSite                                                                                                                     |
| [stack-badges.md](stack-badges.md)         | Shields, LoC в header                                                                                                              |
| [audit.md](audit.md)                       | Оценка 1-10                                                                                                                        |
| [reference.md](reference.md)               | Пример README (DotLearn)                                                                                                           |
| [PROMPT.md](PROMPT.md)                     | Standalone без skills                                                                                                              |
| [codex-prompt.md](codex-prompt.md)         | Промпт `/generate-readme` для Codex                                                                                                |
| [README.md](README.md)                     | Установка Cursor / Claude / Codex / проект                                                                                         |
