# generate-readme

Скилл DotCore из monorepo [dotcore-skills](../../README.md): **README.md** (internal doc) + **правила проекта** (`AGENTS.md`, Cursor rule, `CLAUDE.md`) в каждом репозитории, где запущен.

Сохраняет брендинг: SVG-обложка DotBioSite, flat-бейджи, LoC через `code-counter`, ASCII-архитектура. Классификация проекта, аудит 1-10, стандарт [agents.md](https://agents.md/).

## Что создаётся в целевом проекте

| Файл                                | Назначение                                           |
| ----------------------------------- | ---------------------------------------------------- |
| `README.md`                         | Документация для разработчика (DotCore)              |
| `AGENTS.md`                         | Канон для Codex, Cursor, Claude, Copilot             |
| `.cursor/rules/dotcore-project.mdc` | Правило Cursor, `alwaysApply: true`                  |
| `CLAUDE.md`                         | Обёртка → AGENTS.md                                  |
| `LICENSE`                           | Строгий All Rights Reserved (всегда)                 |
| Файл агента запуска                 | Нативный rule-файл агента, из которого запущен скилл |
| `docs/cover.svg`                    | Обложка для GitHub (если cover_mode=file)            |
| `docs/portfolio-draft.md`           | Черновик DotBioSite (если audience=portfolio)        |

## Файлы скилла

| Файл                                       | Назначение                                                     |
| ------------------------------------------ | -------------------------------------------------------------- |
| [SKILL.md](SKILL.md)                       | Workflow (точка входа)                                         |
| [project-classify.md](project-classify.md) | Тип, аудитория, cover mode                                     |
| [project-rules.md](project-rules.md)       | Шаблоны AGENTS.md, .mdc, CLAUDE.md, агент запуска, README-sync |
| [license.md](license.md)                   | Лицензия (строгий All Rights Reserved)                         |
| [logo-cover.md](logo-cover.md)             | SVG DotBioSite                                                 |
| [stack-badges.md](stack-badges.md)         | Shields, LoC в header                                          |
| [audit.md](audit.md)                       | Оценка 1-10                                                    |
| [reference.md](reference.md)               | Пример README (DotLearn)                                       |
| [PROMPT.md](PROMPT.md)                     | Standalone для чатов без skills                                |
| [codex-prompt.md](codex-prompt.md)         | Промпт `/generate-readme` для Codex                            |

## Установка

### Из dotcore-skills (рекомендуется)

```powershell
cd path\to\dotcore-skills
.\scripts\install.ps1 -Skill generate-readme          # все агенты
.\scripts\install.ps1 -Agent cursor,claude,agents    # выборочно
.\scripts\install.ps1 -ListAgents
```

```bash
./scripts/install.sh generate-readme
AGENTS=cursor,claude,agents ./scripts/install.sh
```

При разработке: `.\scripts\install.ps1 -Link`.

Поддерживаемые агенты: Cursor, Claude Code, Codex, Gemini CLI, OpenCode, Goose, Roo Code, Junie, Amp, universal `.agents/` - см. [docs/AGENTS_PATHS.md](../../docs/AGENTS_PATHS.md).

### Вручную

| ID       | Агент       | Путь                                                       |
| -------- | ----------- | ---------------------------------------------------------- |
| `cursor` | Cursor      | `~/.cursor/skills/generate-readme/`                        |
| `claude` | Claude Code | `~/.claude/skills/generate-readme/`                        |
| `codex`  | Codex       | `~/.codex/skills/` + `~/.codex/prompts/generate-readme.md` |
| `agents` | Universal   | `~/.agents/skills/generate-readme/`                        |
| `gemini` | Gemini CLI  | `~/.gemini/skills/generate-readme/`                        |
| …        |             | [полная таблица](../../docs/AGENTS_PATHS.md)               |

Источник файлов - папка `skills/generate-readme/` в этом репозитории.

### В целевом проекте

```text
your-repo/.cursor/skills/generate-readme/
```

Полная копия папки, не wrapper. Опционально: `.claude/skills/generate-readme/`.

### Без поддержки skills

Блок из [PROMPT.md](PROMPT.md) между `---START---` и `---END---`.

## Триггеры

«обнови README», «сгенерируй документацию», «настрой правила проекта», `/generate-readme` (Codex).

## Тест

1. Открой целевой DotCore-репозиторий.
2. «Обнови README и правила проекта по DotCore».
3. Self-check в [SKILL.md](SKILL.md), аудит ≥ 8/10 в [audit.md](audit.md).
4. Эталон README - [reference.md](reference.md).

## LoC и обложка

```bash
pip install code-counter-ntwusr
code-counter .
```

LoC-бейдж - 4-й в строке header, см. [stack-badges.md](stack-badges.md). GitHub cover - [logo-cover.md](logo-cover.md). Лицензия - [license.md](license.md).
