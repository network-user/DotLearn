# Универсальный промпт - README + правила проекта

Для агентов без поддержки скиллов (ChatGPT, Gemini, веб-чат). Скопируй блок между маркерами.

---START---

Сгенерируй или обнови документацию репозитория в стандарте **DotCore**.

## Задача

1. **README.md** - плоский технический документ для разработчика
2. **AGENTS.md** - инструкции для coding-агентов (build, test, conventions)
3. **.cursor/rules/dotcore-project.mdc** - правило Cursor
4. **CLAUDE.md** - обёртка со ссылкой на AGENTS.md
5. **docs/portfolio-draft.md** - только если проект для портфолио DotBioSite

## Правила

- Язык русский (если проект не EN-only). Тон internal doc, не marketing.
- Читай репозиторий: команды из package.json/Makefile/pyproject, deps из манифестов, env-имена из .env.example/docker-compose. Ничего не выдумывай. Код важнее старого README.
- Запрещено в README: `<details>`, centered hero, emoji, длинное тире, LLM-маркеры, mermaid вместо ASCII-дерева, marketing-буллеты.

## Workflow

1. **Scan** - runtime, scripts, deps, структура, CI, remote, существующие AGENTS.md/CLAUDE.md
2. **Classify** - тип (learning/web-app/cli/library/bot/…), аудитория (internal/oss/portfolio), distribution (github/local/docker/…)
3. **Cover** - GitHub → `docs/cover.svg` + `<img width="720">`; IDE → inline `<svg>`; есть preview.png → используй
4. **Write README** - структура ниже
5. **Write rules** - AGENTS.md (80-150 строк), dotcore-project.mdc, CLAUDE.md (обёртка)
6. **LoC** - `code-counter .` → TOTAL в бейдж между `<!-- loc:start -->` / `<!-- loc:end -->`
7. **Audit** - оценка 1-10, минимум 8

## Структура README

```
# {brand}
[3 flat badges: Runtime, Platform, Category]
[cover]
<!-- loc:start --> LoC badge <!-- loc:end -->
{intro - до 3 предложений}

## Что внутри     ОПЦ. для UX-богатых проектов, факты и числа
## Запуск
## Команды        | Команда | Назначение |
## Стек            только <img for-the-badge>
## Тесты / …       если есть
## Архитектура     ПОСЛЕДНЯЯ: абзац + ASCII-дерево + 3-6 инвариантов
```

## AGENTS.md (кратко)

Секции: Профиль проекта · Быстрый старт · Сборка и проверки (таблица команд) · Структура (ASCII) · Соглашения · Env (имена) · Что делать / Чего не делать · Документация · DotCore. Без marketing. Команды только реальные.

## .cursor/rules/dotcore-project.mdc

YAML: `description`, `globs: ["**/*"]`, `alwaysApply: true`. Тело: ссылка на AGENTS.md, краткие install/dev/test, правила DotCore.

## CLAUDE.md

15-25 строк: «Прочитай AGENTS.md», приоритет контекста, триггер generate-readme. Не дублируй AGENTS.md.

## SVG cover (DotBioSite, tagline на русском)

GitHub: сохрани в `docs/cover.svg`, в README `<img src="docs/cover.svg" width="720">`.

Skeleton (замени {p}, {brand}, {name}, {tagline}, {glyph}):

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="720" viewBox="0 0 1600 900" role="img" aria-label="{name}">
  <defs>
    <linearGradient id="{p}-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0a0b0d"/><stop offset="1" stop-color="#14161a"/>
    </linearGradient>
    <radialGradient id="{p}-glow" cx="72%" cy="22%" r="60%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.12"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#{p}-bg)"/>
  <rect width="1600" height="900" fill="url(#{p}-glow)"/>
  <g opacity="0.05" stroke="#ffffff" stroke-width="1"><path d="M0 300H1600M0 600H1600M533 0V900M1067 0V900"/></g>
  <svg x="980" y="250" width="400" height="400" viewBox="0 0 48 48">
    <g opacity="0.1" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">{glyph}</g>
  </svg>
  <svg x="140" y="120" width="86" height="86" viewBox="0 0 48 48">
    <g fill="none" stroke="#f3f3f1" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">{glyph}</g>
  </svg>
  <text x="138" y="408" font-family="Inter, Arial, sans-serif" font-size="132" font-weight="800" fill="#f3f3f1" letter-spacing="-3">{brand}</text>
  <text x="146" y="470" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="700" fill="#f3f3f1">{name}</text>
  <text x="146" y="516" font-family="Inter, Arial, sans-serif" font-size="26" fill="#a6a7ab">{tagline}</text>
</svg>
```

## LoC badge

```markdown
<!-- loc:start --><img src="https://img.shields.io/badge/lines_of_code-{N}-lightgrey?style=flat" alt="{N} lines of code" /><!-- loc:end -->
```

## Self-check

- [ ] README + AGENTS.md + mdc + CLAUDE.md созданы/обновлены
- [ ] Команды и пути существуют; LoC обновлён
- [ ] Cover по среде; нет битых img; архитектура последняя в README
- [ ] AGENTS.md не дублирует README; CLAUDE.md - обёртка
- [ ] Аудит ≥ 8/10

Выведи краткий отчёт аудита и список изменённых файлов.

---END---
