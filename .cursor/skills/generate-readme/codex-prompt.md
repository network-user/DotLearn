---
description: DotCore generate-readme - README + AGENTS.md + правила проекта
---

Прочитай скилл `generate-readme` из установленного dotcore-skills:

- `~/.codex/skills/generate-readme/SKILL.md`
- или `skills/generate-readme/SKILL.md` в клоне dotcore-skills
- или `.cursor/skills/generate-readme/SKILL.md` в проекте

Выполни полный workflow (SKILL.md):

1. Scan репозитория
2. Classify (project-classify.md)
3. Cover mode (logo-cover.md)
4. Write README.md (стандарт DotCore; LoC - 4-й бейдж в header, лицензия - футер)
5. Write AGENTS.md, файл правил агента запуска, .cursor/rules/dotcore-project.mdc, CLAUDE.md (project-rules.md)
6. Write LICENSE - строгий All Rights Reserved (license.md)
7. Validate (audit.md, минимум 8/10)
8. LoC через code-counter

Факты только из кода. Перегенерируй файлы целиком. Сохрани SVG-обложку и LoC-бейдж (в header), строгую лицензию и правило README-sync.

В конце выведи отчёт аудита и список изменённых файлов.
