# generate-readme

Скилл DotCore из monorepo [dotcore-skills](../../README.md): **README.md** (internal doc) + **правила проекта** (`AGENTS.md`, Cursor rule, `CLAUDE.md`) в каждом репозитории, где запущен.

Сохраняет брендинг: SVG-обложка DotBioSite, flat-бейджи, LoC через `code-counter`, ASCII-архитектура. Классификация проекта, аудит 1-10, стандарт [agents.md](https://agents.md/).

## Что создаётся в целевом проекте

| Файл | Назначение |
|------|------------|
| `README.md` | Документация для разработчика (DotCore) |
| `AGENTS.md` | Канон для Codex, Cursor, Claude, Copilot |
| `.cursor/rules/dotcore-project.mdc` | Правило Cursor, `alwaysApply: true` |
| `CLAUDE.md` | Обёртка → AGENTS.md |
| `docs/cover.svg` | Обложка для GitHub (если cover_mode=file) |
| `docs/portfolio-draft.md` | Черновик DotBioSite (если audience=portfolio) |

## Файлы скилла

| Файл | Назначение |
|------|------------|
| [SKILL.md](SKILL.md) | Workflow (точка входа) |
| [project-classify.md](project-classify.md) | Тип, аудитория, cover mode |
| [project-rules.md](project-rules.md) | Шаблоны AGENTS.md, .mdc, CLAUDE.md |
| [logo-cover.md](logo-cover.md) | SVG DotBioSite |
| [stack-badges.md](stack-badges.md) | Shields, LoC |
| [audit.md](audit.md) | Оценка 1-10 |
| [reference.md](reference.md) | Пример README (DotLearn) |
| [PROMPT.md](PROMPT.md) | Standalone для чатов без skills |
| [codex-prompt.md](codex-prompt.md) | Промпт `/generate-readme` для Codex |

## Установка

### Из dotcore-skills (рекомендуется)

```powershell
cd path\to\dotcore-skills
.\scripts\install.ps1 -Skill generate-readme
```

```bash
./scripts/install.sh generate-readme
```

При разработке скилла: `.\scripts\install.ps1 -Link`.

### Вручную

| Агент | Путь |
|-------|------|
| Cursor | `~/.cursor/skills/generate-readme/` |
| Claude Code | `~/.claude/skills/generate-readme/` |
| Codex | `~/.codex/skills/generate-readme/` + `~/.codex/prompts/generate-readme.md` |

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

LoC-бейдж под cover - [stack-badges.md](stack-badges.md). GitHub cover - [logo-cover.md](logo-cover.md).
