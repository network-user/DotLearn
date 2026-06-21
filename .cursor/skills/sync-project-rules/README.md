# sync-project-rules

Скилл DotCore из monorepo [dotcore-skills](../../README.md): перегенерирует **правила проекта для агентов** (`AGENTS.md` + нативные rule-файлы) из фактов репозитория. Лёгкая половина `generate-readme` - без README, обложки, бейджей, LoC и аудита.

Для частого случая: изменились команды/скрипты, модули, зависимости или структура - надо синхронизировать `AGENTS.md`, но полный README с пересчётом LoC и аудитом не нужен.

## Что создаётся/обновляется в целевом проекте

| Файл                                | Назначение                                       |
| ----------------------------------- | ------------------------------------------------ |
| `AGENTS.md`                         | Канон для Codex, Cursor, Claude, Copilot, Gemini |
| `.cursor/rules/dotcore-project.mdc` | Правило Cursor, `alwaysApply: true`              |
| `CLAUDE.md`                         | Обёртка → AGENTS.md                              |
| `GEMINI.md`                         | Обёртка → AGENTS.md                              |

README, обложка, бейджи, LoC, `LICENSE` - **не трогает**. Это зона `generate-readme`.

## Связь с generate-readme

`sync-project-rules` владеет шаблонами правил. `generate-readme` вызывает его на шаге «правила» и сам делает README + обложку + LoC + лицензию + аудит. Запускай этот скилл отдельно, когда нужны только правила.

| Нужно                                                    | Скилл                |
| -------------------------------------------------------- | -------------------- |
| Обновить только `AGENTS.md`/правила (команды, структура) | `sync-project-rules` |
| Полный README + обложка + LoC + лицензия + правила       | `generate-readme`    |

## Файлы скилла

| Файл                               | Назначение                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| [SKILL.md](SKILL.md)               | Workflow (точка входа)                                                              |
| [templates.md](templates.md)       | Шаблоны AGENTS.md, .mdc, CLAUDE.md, GEMINI.md; агент запуска; README-sync; миграция |
| [PROMPT.md](PROMPT.md)             | Standalone для чатов без skills                                                     |
| [codex-prompt.md](codex-prompt.md) | Промпт `/sync-project-rules` для Codex                                              |

## Установка

### Из dotcore-skills (рекомендуется)

```powershell
cd path\to\dotcore-skills
.\scripts\install.ps1 -Skill sync-project-rules
```

```bash
./scripts/install.sh sync-project-rules
```

При разработке: `.\scripts\install.ps1 -Skill sync-project-rules -Link`.

Поддерживаемые агенты и пути - [docs/AGENTS_PATHS.md](../../docs/AGENTS_PATHS.md).

### В целевом проекте

```text
your-repo/.cursor/skills/sync-project-rules/
```

Полная копия папки (self-contained), опционально `.claude/skills/sync-project-rules/`.

### Без поддержки skills

Блок из [PROMPT.md](PROMPT.md) между `---START---` и `---END---`.

## Триггеры

«обнови AGENTS.md», «синхронизируй правила проекта», «обнови правила агентов», `/sync-project-rules` (Codex).

## Тест

1. Открой целевой DotCore-репозиторий после изменения команд/структуры.
2. «Синхронизируй правила проекта (AGENTS.md)».
3. Проверь: команды в `AGENTS.md` сверены с манифестами, проектные секции сохранены, README не тронут.
