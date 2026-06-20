# Аудит README и правил проекта

Финальный шаг workflow (после Write). Оценка 1-10 по категориям. Минимум **8/10** для завершения без доработки.

## Категории (по 0-2 балла каждая, итого /10)

### 1. Фактичность (0-2)

- [ ] Каждая команда в README и AGENTS.md есть в scripts/Makefile/pyproject
- [ ] Пути, env-имена, версии, числа сверены с репо
- [ ] LoC из `code-counter` или явно указан способ подсчёта
- [ ] Стек-бейджи = реальные зависимости

**0** - выдуманные факты · **1** - мелкие несоответствия · **2** - всё проверено

### 2. DotCore-формат (0-2)

- [ ] Тон internal doc, русский (или EN-only проект)
- [ ] Нет `<details>`, centered hero, emoji, LLM-маркеров, длинного тире
- [ ] Header flat (3), LoC под cover, стек for-the-badge
- [ ] Архитектура - последняя секция README

### 3. Обложка и визуал (0-2)

- [ ] Cover mode корректен (GitHub → file, IDE → inline)
- [ ] `docs/cover.svg` создан если `<img>` ссылается на него
- [ ] SVG: monochrome DotBioSite, tagline на русском, префикс id
- [ ] Нет битых `<img>`

### 4. Правила агента (0-2)

- [ ] `AGENTS.md` перегенерирован, 80-150 строк, без marketing
- [ ] `.cursor/rules/dotcore-project.mdc` обновлён
- [ ] `CLAUDE.md` - обёртка на AGENTS.md
- [ ] Нет дублирования README целиком в AGENTS.md

### 5. Классификация и полнота (0-2)

- [ ] `project_type` отражён в опциональных секциях
- [ ] `## Что внутри` только где уместно, с числами
- [ ] `docs/portfolio-draft.md` если portfolio
- [ ] Пустые шаблонные секции удалены

## Быстрый отчёт (выведи пользователю)

```
Аудит generate-readme
─────────────────────
Фактичность:      X/2
DotCore-формат:   X/2
Обложка:          X/2
Правила агента:   X/2
Классификация:    X/2
ИТОГО:            X/10

Исправлено: {список или «ничего»}
Файлы: README.md, AGENTS.md, .cursor/rules/dotcore-project.mdc, CLAUDE.md{, docs/portfolio-draft.md}
LoC: {N}
Cover: {file|inline|preview}
```

## Типичные замечания (исправить сразу)

| Проблема | Исправление |
|----------|-------------|
| LoC в header | Перенести под cover |
| Команда не в package.json | Удалить или найти реальный script |
| AGENTS.md копирует README | Оставить в AGENTS только operational |
| CLAUDE.md дублирует AGENTS | Сократить до обёртки |
| for-the-badge в header | Только flat в header |
| Plain-text в ## Стек | Заменить на `<img>` бейджи |
| Tagline EN в SVG | Перевести на русский |
| Нет dotcore-project.mdc | Создать по шаблону |

## Промпт аудита (standalone)

Для ручной проверки без полной регенерации:

```
Сверь README.md и AGENTS.md с чеклистом audit.md скилла generate-readme.
Перечисли нарушения, оцени X/10, предложи минимальный diff.
Не переписывай без явного запроса.
```
