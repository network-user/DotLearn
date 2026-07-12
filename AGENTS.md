# AGENTS.md

> Инструкции для AI coding agents. Человеческий обзор - в [README.md](README.md).
> Перегенерировано скиллом `generate-readme`. Источник правды - код репозитория, не этот файл.

## Профиль проекта

- **Тип:** learning (local-first учебный workbench) + full-stack монорепо
- **Аудитория:** internal
- **Runtime:** Node.js 20+, pnpm 9
- **Монорепо:** да (pnpm workspaces + Turborepo)

`.learn` - локальный learning-плеер. Каждая тема под `topics/<slug>/` - самодостаточный модуль: теория в MDX, упражнения в YAML, всё валидируется Zod-схемами из `packages/contracts`. Фронт (`apps/web`) работает без бэкенда; опциональный `apps/api` даёт submission/admin-эндпоинты, анонимный счётчик онлайна (presence) и кросс-девайс синхронизацию прогресса по коду (sync: снапшот-blob на сервере, merge на клиенте в `apps/web/src/lib/sync/`).

## Скиллы

Репозиторий держит скиллы в двух зеркальных папках:

- `.cursor/skills/<name>/SKILL.md` - канон (Cursor)
- `.claude/skills/<name>/SKILL.md` - зеркало (Claude Code), генерится через `pnpm sync:skills`

Доступны:

- **`lesson-forge`** - сгенерировать новую тему. Активируй, когда просят добавить тему, создать уроки, упражнения или курс. **Не генерируй контент темы вручную, минуя скилл.**
- **`generate-readme`** - перегенерировать `README.md` (DotCore internal doc) и правила проекта (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/dotcore-project.mdc`).
- **`sync-project-rules`** - лёгкая синхронизация правил агентов (`AGENTS.md` + rule-файлы) с фактами репозитория, без README/обложки/LoC. Для «обнови AGENTS.md» / «синхронизируй правила проекта».

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
│   └── api/        # NestJS (DDD): submissions, admin, search, presence, sync
├── packages/
│   ├── contracts/      # Zod-схемы, общие типы (единственный общий слой)
│   ├── lesson-engine/  # загрузчик тем, раннеры упражнений, CLI-валидатор
│   └── sandbox/        # sql.js + Pyodide в Web Workers
├── topics/         # 46 тем (manifest + MDX + YAML)
├── deploy/         # шаблоны Caddyfile + systemd-юнит (bare-metal деплой)
├── scripts/        # deploy.sh, sync/checks, контент-тулинг
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
- SEO-мета страниц: компонент `<Seo>` из `apps/web/src/lib/seo.tsx` (title/description/canonical/robots/OG/hreflang). Каждая новая страница ставит свой `<Seo>`; приватные и утилитарные - с `robots="noindex,nofollow"`. Layout заголовок вкладки не трогает.
- EN-версии тем: `/en` и `/en/topics/<slug>` (layout-роут форсит язык контента через `ForcedContentLanguageContext` и клон i18n-инстанса, localStorage пользователя не мутируется). Тема без en редиректится на ru в `beforeLoad`.
- Build-time SEO-слой: `apps/web/scripts/{prerender,seo-artifacts,og}.mjs` вызываются из web `pnpm build` и пишут в `dist/` пререндер ~84 страниц (ru+en, без гидрации), sitemap/robots/llms.txt, markdown-зеркала и OG-PNG. Пререндер и артефакты не должны попадать в SW-прекэш (`workbox.globIgnores` в `vite.config.ts`) и в eager-бандл.

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
- SEO-поля манифеста: `descriptions.{ru,en}` (meta description, 50-200 символов) и `titleEn` (титул en-страниц). Правила: `descriptions[primaryLanguage]` обязателен всегда; для тем с `en` обязательны `descriptions.en` и `titleEn`; языковые ключи только из `availableLanguages`. Валидируется `pnpm validate`.

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

| Переменная                                                                           | Назначение                                                                                                                                       |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DOMAIN` / `ACME_EMAIL`                                                              | домен и email для авто-HTTPS (Caddy/Let's Encrypt) при деплое                                                                                    |
| `DATA_DIR`                                                                           | путь тома данных api (json-file-store)                                                                                                           |
| `ES_NODE` / `ES_ENABLED`                                                             | адрес Elasticsearch и флаг fuzzy-поиска (`ES_ENABLED=false` по умолчанию → in-memory)                                                            |
| `VITE_API_BASE`                                                                      | базовый URL api для фронта (в проде `https://$DOMAIN`, same-origin)                                                                              |
| `VITE_ADMIN_PATH`                                                                    | путь admin-роута                                                                                                                                 |
| `VITE_GITHUB_URL`                                                                    | ссылка на репозиторий для футера (не задана или пустая - ссылка в футере скрыта)                                                                 |
| `VITE_SITE_URL`                                                                      | канонический origin для SEO-артефактов (sitemap/canonical/OG); не задан - берётся `VITE_API_BASE`                                                |
| `WEB_ORIGIN`                                                                         | разрешённый origin для CORS api                                                                                                                  |
| `HOST` / `PORT`                                                                      | адрес/порт прослушивания api (`127.0.0.1` за прокси)                                                                                             |
| `TRUSTED_PROXY_HOPS`                                                                 | число reverse-прокси перед api (считай все хопы: только Caddy = `1`, Caddy + nginx = `2`)                                                        |
| `PRESENCE_TTL_MS` / `PRESENCE_MAX_TRACKED`                                           | окно «онлайна» heartbeat-счётчика (90с) и потолок трекаемых id (50000)                                                                           |
| `SYNC_MAX_BLOB_BYTES` / `SYNC_MAX_CODES` / `SYNC_TTL_DAYS` / `SYNC_BODY_LIMIT_BYTES` | кросс-девайс синк по коду: потолок decoded-blob'а (1 МиБ), максимум кодов (2000), TTL простоя (90д), лимит тела `/api/sync` (2 МиБ, опционально) |

Admin-секреты api (логин, JWT, TOTP) читаются из `.env`; имена и ротация - в [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md). **Не читай `.env`, не коммить секреты.**

## Деплой

Основной путь - bare-metal на Debian/Ubuntu, без Docker (минимум RAM/диска): Caddy отдаёт статику с авто-HTTPS и проксирует `/api`, api крутится под systemd.

| Действие               | Команда                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| Полный деплой          | `sudo bash scripts/deploy.sh` (спросит домен/email/пароль, идемпотентен) |
| Обновление             | `make update` (git pull + redeploy)                                      |
| Статус / логи          | `make status` / `make logs` / `make logs-web`                            |
| Рестарт                | `make restart`                                                           |
| Бэкап / восстановление | `make backup` / `make restore FILE=...`                                  |

- Прод-артефакты: api-бандл `pnpm deploy --prod` → `/opt/dotlearn/api`, статика → `/var/www/dotlearn`, данные → `/var/lib/dotlearn/data`.
- `scripts/deploy.sh` сам ставит Node/pnpm/Caddy, генерит admin-секреты (`apps/api/scripts/gen-admin-secrets.mjs`), чистит build-зависимости и pnpm-store ради диска.
- Caddyfile и systemd-юнит - шаблоны в `deploy/`. Elasticsearch опционален (`ES_ENABLED=false` по умолчанию).
- Статика включает пререндер-страницы и SEO-артефакты: Caddy/nginx резолвят `{path}/index.html`, ставят no-store на навигационный HTML и `text/markdown` для `.md`-зеркал. Правки заголовков держи в location-блоках, не в `security-headers.conf` (гейт `pnpm check:headers`).
- Docker - второй путь и основа хостинга: CI (`.github/workflows/deploy.yml`) собирает образы web/api и пушит в `ghcr.io/<owner>/dotlearn-*`, сервер только тянет готовые (`docker compose -f docker-compose.yml -f docker-compose.prod.yml pull && up -d --no-build`, овнер в `GHCR_OWNER`). За общим фронт-Caddy web-nginx отдаёт статику и проксирует `/api`, поэтому в проде `TRUSTED_PROXY_HOPS=2`. Локально - `docker compose up`; ES под профилем `search`. Детали - в [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

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
