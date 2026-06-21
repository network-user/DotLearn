---
description: DotCore sync-project-rules - перегенерирует AGENTS.md и правила агентов (без README)
---

Прочитай скилл `sync-project-rules` из установленного dotcore-skills:

- `~/.codex/skills/sync-project-rules/SKILL.md`
- или `skills/sync-project-rules/SKILL.md` в клоне dotcore-skills
- или `.cursor/skills/sync-project-rules/SKILL.md` в проекте

Выполни workflow (SKILL.md):

1. Scan репозитория (только rules-relevant: команды, deps, структура, существующие правила)
2. Определи агента запуска
3. Перегенерируй `AGENTS.md` (каркас по templates.md), сохранив проектные секции
4. Перегенерируй `.cursor/rules/dotcore-project.mdc`, `CLAUDE.md`, `GEMINI.md` - те, что нужны
5. Встрой правило README-sync

Факты только из кода. README, обложку, бейджи, LoC и LICENSE **не трогай** - это `generate-readme`. Проект-специфичные секции старого `AGENTS.md` сохрани (слияние, не затирание).

В конце выведи список изменённых файлов.
