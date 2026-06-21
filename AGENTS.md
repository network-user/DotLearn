# AGENTS.md

> Инструкции для AI coding agents. Человеческий обзор - в [README.md](README.md).
> Перегенерировано скиллом `generate-readme`. Источник правды - код репозитория, не этот файл.

## Профиль проекта

- **Тип:** learning (local-first учебный workbench) + full-stack монорепо
- **Аудитория:** internal
- **Runtime:** Node.js 20+, pnpm 9
- **Монорепо:** да (pnpm workspaces + Turborepo)

`.learn` - локальный learning-плеер. Каждая тема под `topics/<slug>/` - самодостаточный модуль: теория в MDX, упражнения в YAML, всё валидируется Zod-схемами из `packages/contracts`. Фронт (`apps/web`) работает без бэкенда; опциональный `apps/api` даёт submission/admin-эндпоинты.

## Скиллы

Репозиторий держит скиллы в двух зеркальных папках:

- `.cursor/skills/<name>/SKILL.md` - канон (Cursor)
- `.claude/skills/<name>/SKILL.md` - зеркало (Claude Code), генерится через `pnpm sync:skills`

Доступны:

- **`lesson-forge`** - сгенерировать новую тему. Активируй, когда просят добавить тему, создать уроки, упражнения или курс. **Не генерируй контент темы вручную, минуя скилл.**
- **`generate-readme`** - перегенерировать `README.md` (DotCore internal doc) и правила проекта (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/dotcore-project.mdc`).

CLI-агент без нативной загрузки скиллов читает `SKILL.md` руками и следует workflow внутри.

## Быстрый старт

```bash
pnpm install
pnpm dev:web      # Vite SPA на http://localhost:5173
pnpm dev:api      # NestJS API (опционально)
```

## Сборка и проверки

| Действие        | Команда                                              |
| --------------- | ---------------------------------------------------- |
| Установка       | `pnpm install`                                       |
| Dev (web)       | `pnpm dev:web`                                       |
| Dev (web + api) | `pnpm dev`                                           |
| Тесты           | `pnpm test` (vitest; coverage-порог в lesson-engine) |
| Typecheck       | `pnpm typecheck`                                     |
| Lint            | `pnpm lint` / `pnpm lint:fix`                        |
| Формат          | `pnpm format` / `pnpm format:check`                  |
| Валидация тем   | `pnpm validate` (Zod-контракт + прогон gold-решений) |
| Build           | `pnpm build`                                         |
| i18n-паритет    | `pnpm check:i18n` (ключи ru/en в синхроне)           |
| Бюджет бандла   | `pnpm check:bundle` (eager-JS ≤ лимит, после build)  |
| Синк скиллов    | `pnpm sync:skills` / `pnpm check:skills`             |

Команды - только из `package.json` / `Makefile` / CI. После правок гоняй релевантное из таблицы; после правок в `topics/**` - `pnpm validate`.

## Структура репозитория

```
.learn/
├── apps/
│   ├── web/        # Vite + React SPA, local-first
│   └── api/        # NestJS (DDD): submissions, admin, search
├── packages/
│   ├── contracts/      # Zod-схемы, общие типы (единственный общий слой)
│   ├── lesson-engine/  # загрузчик тем, раннеры упражнений, CLI-валидатор
│   └── sandbox/        # sql.js + Pyodide в Web Workers
├── topics/         # 34 темы (manifest + MDX + YAML)
├── .cursor/skills/ # lesson-forge, generate-readme (канон)
└── .claude/skills/ # зеркало (pnpm sync:skills)
```

## Архитектурные правила

1. **Монорепо.** `apps/web` и `apps/api` - отдельные workspaces, друг из друга не импортируют. Общие типы только в `packages/contracts`.
2. **Local-first.** Фронт обязан работать без бэкенда. Темы грузятся через `import.meta.glob`, sandbox исполняется в Web Workers.
3. **Темы - это контент, не код.** Никогда не импортируют из `apps/*`.
4. **Zod - единственный источник правды для схем.** TS-типы выводятся через `z.infer<>`.
5. **Нет рантайм-AI.** Приложение - чистая логика, не хранит ключи провайдеров. LLM используются только офлайн для генерации контента (см. `SECURITY.md`).

## Backend (`apps/api`)

NestJS, Layered DDD:

- Модули под `src/modules/<domain>/`, в каждом: `domain/`, `infrastructure/`, `dto/`, контроллер, сервис, модуль.
- Контроллеры - только HTTP; бизнес-логика в сервисах; персистентность за инжектируемыми интерфейсами.
- Валидация: `class-validator` (whitelist + transform) и `ZodBodyPipe` для payload из `@dotlearn/contracts`.
- Глобальные response-интерсептор и exception-фильтр для единых конвертов.
- Swagger-декораторы на каждом эндпоинте.
- Логирование через `nestjs-pino` (никаких `console.log`).
- Будущие финансовые операции - ledger-паттерн + idempotency.

## Frontend (`apps/web`)

- React 18 + TypeScript strict, только функциональные компоненты.
- Vite (dev/build), TanStack Router, Tailwind (без inline-стилей, кроме недостижимого Tailwind).
- Sandbox в `packages/sandbox`, в Web Workers. AI в рантайме нет.

### Адаптивность (мобайл + десктоп, обязательно)

Каждая новая страница/компонент - **сразу под мобайл и десктоп**:

- Mobile-first Tailwind: базовые классы под узкий экран, `sm:`/`md:`/`lg:`/`xl:` расширяют.
- Тач-таргеты >= 44px через токены `--tap` / `--tap-comfort`; основные кнопки full-width на мобиле.
- Инпуты: 16px-шрифт на мобиле (`text-[16px] sm:text-sm` или `form-input`) - против iOS-зума.
- Hover не несущий: `future.hoverOnlyWhenSupported`; pointer-эффекты отключаются на тач-устройствах.
- Ниже `md` основная навигация - `BottomTabBar`; не ставь fixed-UI в её зону (`--mobile-tabbar-h` + `--safe-bottom`).
- Широкий контент скроллится внутри `overflow-x-auto`; не ломай горизонтальный скролл страницы.
- Проверяй 375px и 1280px перед сдачей.

### Бюджет загрузки контента

- Контент тем (MDX, YAML) и тяжёлые зависимости (Monaco, sql.js, pyodide) грузятся лениво. Никаких eager `import.meta.glob` по `topics/**`; не тащи тяжёлый редактор/рантайм в общий чанк (используй `LazyCodeEditor` / ленивые рантаймы).
- Роуты code-split через `React.lazy` в `router.tsx`; в entry-чанке только `HomePage`.
- Списки (home, progress) берут количества упражнений из build-time `virtual:topic-stats`, не грузя полные бандлы тем.

## Интернационализация (i18n)

Двуязычный проект: **русский - основной и fallback, английский - вторичный**. Локаль детектится из `localStorage` → `navigator.language`, дефолт `ru`.

- UI-строки: `apps/web/src/locales/{ru,en}.json` по неймспейсам. Ключ добавляй **в оба файла**, никогда в один.
- В компонентах: `useTranslation('<namespace>')` + `t('key.path')`; для разметки - `<Trans i18nKey="ns:key" .../>`.
- Не хардкодь user-facing строки (тосты, ARIA, плейсхолдеры, ошибки) - всё через `t()`.
- Мультиязычные темы: `TopicManifest` объявляет `availableLanguages` и `primaryLanguage`. Файлы: `theory/<NN>-<id>.<lang>.mdx`, `exercises/<NN>-<id>.<lang>.yaml`. `id` упражнений общий между языками (перевод, не дубликат). Лоадер `apps/web/src/lib/topics.ts` локаль-aware, падает в `primaryLanguage`.

## Тесты

Vitest. `pnpm test` (Turborepo), per-package `pnpm --filter @dotlearn/<pkg> test`. Тесты рядом как `src/**/*.spec.ts`, globals выключены (`import { describe, it, expect } from 'vitest'`). Node-env в пакетах и api; `apps/web` - jsdom + `fake-indexeddb` (отдельный `vitest.config.ts`, без app-плагинов). `lesson-engine` гоняет с порогом coverage.

- **Поддерживай suite вместе с изменением, не после.** Правишь схемы `packages/contracts` или grading/loader `packages/lesson-engine` - правь и спеки, держи `pnpm test` зелёным.
- **Тестируй там, где это окупается:** grading/сравнение ответов, валидация схем, лоадеры/резолверы, доменные сервисы api, нетривиальные алгоритмы. Тривиальный glue и presentational-разметку - нет.
- **Не добавляй** component-render и Playwright e2e по умолчанию (только по явной просьбе).
- Детерминизм: без сети и тяжёлых рантаймов; инжектируй фейки (`inlineJavascriptRuntime`, не запускай pyodide/sql.js в unit-тесте).

## Расширение контракта (breaking changes)

Новый `type` упражнения или рантайм - **breaking**, всё в одном PR:

1. Zod-вариант в `packages/contracts/src/exercise.schema.ts`.
2. Раннер в `packages/lesson-engine/src/runners/`.
3. `*.spec.ts` на раннер и вариант схемы; `pnpm test` зелёный.
4. Обнови `exercise.schema.json` в **обоих** скиллах (`.cursor` и `.claude`).
5. Обнови `reference/exercise-types.md` в обоих скиллах.
6. `pnpm sync:skills`.

Изменение языковых полей / суффиксов файлов темы - тоже breaking: правь `topic.schema.ts`, резолвер `topics.ts`, оба `manifest.schema.json`, reference-доки, мигрируй все темы, `pnpm sync:skills` + `pnpm validate`. Не начинай, если не доведёшь до конца в одном изменении.

## Стиль кода

- **Без комментариев в коде.** Интент - через имена и типы. Комментарии можно в MDX-прозе, не в fenced-блоках.
- **Без эмодзи** в коде и контенте, если пользователь явно не просит.
- **Описательные имена:** `submissionStatus`, не `s`.
- **Типизированные ошибки:** доменные классы ошибок, не голый `Error`.

## Переменные окружения

| Переменная               | Назначение                                        |
| ------------------------ | ------------------------------------------------- |
| `DATA_DIR`               | путь тома данных api (json-file-store)            |
| `ES_NODE` / `ES_ENABLED` | адрес Elasticsearch и флаг включения fuzzy-поиска |
| `VITE_API_BASE`          | базовый URL api для фронта                        |
| `VITE_ADMIN_PATH`        | путь admin-роута                                  |
| `WEB_ORIGIN`             | разрешённый origin для CORS api                   |

Admin-секреты api (логин, JWT, TOTP) читаются из `.env`; имена и ротация - в [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md). **Не читай `.env`, не коммить секреты.**

## Поток заявок (submissions)

Темы предлагают двумя путями, оба сходятся на approve, после - материализация через `lesson-forge`:

- **GitHub PR** под `topics/<slug>/` (CI гоняет `pnpm validate`).
- **In-app форма** `/submit` → POST `/api/submissions` → ревью на `/admin`.

## Что делать агенту

- Перед правками читай затронутые файлы и соседний код.
- После изменений - релевантные тесты/typecheck/lint; после `topics/**` - `pnpm validate`.
- **README-sync:** при глобальных изменениях функционала (новые/удалённые команды, модули, пакеты, зависимости, смена архитектуры или runtime, переименование точек входа) обнови `README.md` и `AGENTS.md` скиллом `generate-readme` - включая пересчёт LoC. Мелкие правки (опечатки, внутренний рефактор, багфиксы) README не трогают.
- Не латай разметку README вручную - перегенерируй скиллом.
- Минимальный diff, не рефактори несвязанное. Числа, пути, версии - только из репозитория.
- Коммиты - Conventional Commits, одна тема на коммит при добавлении контента.

## Чего не делать

- Не выдумывать команды, зависимости, env, API endpoints, пути, версии, LoC.
- Не добавлять `<details>`, centered hero, emoji, LLM-маркеры в README DotCore.
- Не менять `docs/cover.svg` без регенерации обложки; не ссылаться на `docs/readme-hero.svg`.
- Не менять `LICENSE` и текст лицензии без явного запроса пользователя.
- Не коммитить секреты, токены, `.env`.
- Не удалять маркеры `<!-- loc:start -->` / `<!-- loc:end -->` в README.

## Документация

- [README.md](README.md) - запуск, команды, стек, архитектура
- [ARCHITECTURE.md](ARCHITECTURE.md) - диаграммы и инварианты
- [CONTRIBUTING.md](CONTRIBUTING.md) - правила предложения тем
- [SECURITY.md](SECURITY.md) - модель угроз и харднинг
- [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md) - деплой, секреты, бэкап
- [docs/NEXT_AGENT_PROMPT.md](docs/NEXT_AGENT_PROMPT.md) - хэндофф следующему агенту

## DotCore

Проект следует стандарту DotCore: плоский технический README, SVG-обложка DotBioSite, LoC-бейдж. При запросе «обнови README» используй скилл `generate-readme`.
