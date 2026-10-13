# AGENTS.md

> Инструкции для AI coding agents. Человеческий обзор - в [README.md](README.md).
> Перегенерировано скиллом `sync-project-rules`. Источник правды - код репозитория, не этот файл.

## Профиль проекта

- **Тип:** learning (local-first workbench) + full-stack монорепо
- **Аудитория:** internal
- **Runtime:** Node.js >=22, pnpm >=11 (`packageManager`: pnpm@11.13.1)
- **Монорепо:** да (pnpm workspaces + Turborepo)

`.learn` работает без бэкенда. Тема под `topics/<slug>/`: теория MDX, упражнения YAML, схемы Zod из `packages/contracts`. Опциональный `apps/api`: заявки, admin, поиск, presence, синк прогресса по коду (merge на клиенте в `apps/web/src/lib/sync/`).

## Быстрый старт

```bash
pnpm install
pnpm dev:web      # http://localhost:5173
pnpm dev:api      # NestJS, порт 3000, вне production Swagger /docs
```

`pnpm dev` поднимает web и api параллельно.

## Сборка и проверки

| Действие         | Команда                                                     |
| ---------------- | ----------------------------------------------------------- |
| Установка        | `pnpm install`                                              |
| Dev (web)        | `pnpm dev:web`                                              |
| Dev (web + api)  | `pnpm dev`                                                  |
| Тесты            | `pnpm test`                                                 |
| Typecheck        | `pnpm typecheck`                                            |
| Lint             | `pnpm lint` / `pnpm lint:fix`                               |
| Формат           | `pnpm format` / `pnpm format:check`                         |
| Валидация тем    | `pnpm validate`                                             |
| Build            | `pnpm build`                                                |
| i18n             | `pnpm check:i18n`                                           |
| Бюджет бандла    | `pnpm check:bundle` (после build)                           |
| Security headers | `pnpm check:headers`                                        |
| Скиллы           | `pnpm sync:skills` / `pnpm check:skills`                    |
| Interview        | `pnpm check:interview`, `pnpm validate:interview-exercises` |

Команды только из `package.json`, `Makefile` и CI. После `topics/**` запускай `pnpm validate`.

## Структура репозитория

```
.learn/
├── apps/
│   ├── web/        # Vite + React
│   └── api/        # NestJS
├── packages/
│   ├── contracts/
│   ├── lesson-engine/
│   └── sandbox/
├── topics/         # 64 темы, 46 с en
├── interview/      # 1455 вопросов в index.json
├── deploy/
├── scripts/
├── .cursor/skills/
└── .claude/skills/
```

## Соглашения

- **Документация:** русский. Пакеты и техтермины как в коде.
- **Стиль:** ESLint + Prettier. Без комментариев в коде. Без эмодзи, если пользователь не просит.
- **Имена:** по смыслу (`submissionStatus`, не `s`). Ошибки доменные, не голый `Error`.
- **Монорепо:** `pnpm --filter @dotlearn/<pkg> ...`. Пакеты не импортируют `apps/*`.

## Скиллы

Канон: `.cursor/skills/<name>/SKILL.md`. Зеркало: `.claude/skills/` через `pnpm sync:skills`.

- **`lesson-forge`**: новая тема, уроки, упражнения. Не пиши контент темы вручную.
- **`generate-readme`**: README, обложка, LoC, лицензия, правила.
- **`sync-project-rules`**: только `AGENTS.md` и rule-файлы, без README и LoC.

CLI без нативной загрузки скиллов читает `SKILL.md` и идёт по workflow внутри.

## Архитектурные правила

1. **Монорепо.** `apps/web` и `apps/api` друг из друга не импортируют. Общий слой: `packages/contracts`.
2. **Local-first.** Фронт работает без API. Темы через `import.meta.glob`. Sandbox в Web Workers.
3. **Темы - контент.** Не импортируют из `apps/*`.
4. **Zod.** Типы через `z.infer<>`.
5. **Нет рантайм-AI.** Ключей провайдеров в приложении нет. LLM только офлайн для контента (`SECURITY.md`).

Типы `Exercise` (union по `type`, 9 штук): `theory-quiz`, `sql-query`, `python-function`, `javascript-function`, `fill-in-blanks`, `predict-output`, `git-challenge`, `onec-lab`, `onec-designer`. Не добавляй тип точечно.

## Backend (`apps/api`)

NestJS, модули `src/modules/<domain>/`: `auth`, `health`, `hidden-topics`, `presence`, `submissions`, `search`, `sync`.

- Контроллеры только HTTP. Логика в сервисах. Хранилище за интерфейсом.
- Валидация: `class-validator` (whitelist + transform) и `ZodBodyPipe` для payload из `@dotlearn/contracts`.
- Глобальные response-интерсептор и exception-фильтр. Swagger на каждом эндпоинте. Логи через `nestjs-pino`, без `console.log`.
- Будущие финансовые операции: ledger и idempotency.

## Frontend (`apps/web`)

- React 18, TypeScript strict, только функциональные компоненты. TanStack Router, Tailwind. Inline-стили только если класс Tailwind недостижим.
- SEO: `<Seo>` из `apps/web/src/lib/seo.tsx`. Новая страница ставит свой `<Seo>`. Приватные и утилитарные: `robots="noindex,nofollow"`. Layout заголовок вкладки не трогает.
- EN: `/en` и `/en/topics/<slug>`. Layout форсит язык контента и не пишет в localStorage пользователя. Тема без en редиректится на ru в `beforeLoad`.
- Сборка вызывает `apps/web/scripts/{prerender,seo-artifacts,og}.mjs`: пререндер (сейчас 3032 HTML: темы ru+en, home, глоссарий, хабы, interview ru+en, 404), sitemap, robots, llms, markdown-зеркала, OG ru и `.en.png`. Origin: `VITE_SITE_URL`, иначе `VITE_API_BASE`. Пререндер не входит в SW-прекэш (`workbox.globIgnores` в `vite.config.ts`, там же `onec/**`) и не в eager-бандл.
- Данные для Node-скриптов лежат json рядом с ts (`catalog-categories.data.json`, `glossary.data.json`, `tracks.data.json`). Меняешь данные, меняй json.

### Учёт (`/onec`)

Один пункт меню «1С» ведёт на `/onec` (`OnecHubPage.tsx`, `navigation-items.ts`). Отдельных пунктов на окна нет.

- `/workbench`: учёт товаров, упражнение `onec-lab`, тема `topics/onec-workbench`.
- `/plant`: учёт завода, упражнение `onec-designer`, тема `topics/plant-case`.
- `/clinic`: база клиники. В трек `onec` (`tracks.data.json`) не входит и типом упражнения не является.

Пререндер-хаб `onec` в `apps/web/scripts/prerender.mjs`. Ключ `onec` в `HUB_ORDER` в `apps/web/scripts/seo-artifacts.mjs`.

### Адаптивность

- Mobile-first: база узкая, `sm:` / `md:` / `lg:` / `xl:` расширяют.
- Тач-таргеты >= 44px (`--tap`, `--tap-comfort`). Основные кнопки на мобиле на всю ширину.
- Инпуты 16px на мобиле (`text-[16px] sm:text-sm` или `form-input`).
- Hover не несущий. Ниже `md` навигация в `BottomTabBar`; fixed-UI не ставь в `--mobile-tabbar-h` + `--safe-bottom`.
- Широкий контент в `overflow-x-auto`. Перед сдачей проверь 375px и 1280px.

### Бюджет загрузки

- MDX, YAML, Monaco, sql.js, pyodide грузятся лениво. Нет eager `import.meta.glob` по `topics/**`.
- Роуты через `React.lazy` в `router.tsx`. В entry только `HomePage`.
- Списки берут числа упражнений из `virtual:topic-stats`, не из полных бандлов тем.

## Интернационализация

Русский основной и fallback, английский вторичный. Детект: `localStorage`, затем `navigator.language`, иначе `ru`.

- Строки UI: `apps/web/src/locales/{ru,en}.json`. Ключ сразу в оба файла.
- В компонентах `useTranslation` и `t()`. Разметка через `<Trans>`. Тосты, ARIA, плейсхолдеры и ошибки не хардкодь.
- Манифест: `availableLanguages`, `primaryLanguage`. Файлы `theory/<NN>-<id>.<lang>.mdx` и `exercises/<NN>-<id>.<lang>.yaml`. `id` упражнения общий между языками.
- SEO манифеста: `descriptions.{ru,en}` (50-200 символов) и `titleEn`. `descriptions[primaryLanguage]` обязателен. Для тем с `en` обязательны `descriptions.en` и `titleEn`. Проверяет `pnpm validate`.

## Тесты

Vitest. Глобалы выключены. Node-env в пакетах и api. `apps/web`: jsdom и `fake-indexeddb`, отдельный `vitest.config.ts`. У `lesson-engine` есть порог coverage.

- Схему или grading/loader меняй вместе со спеками.
- Тестируй сравнение ответов, схемы, лоадеры, домен api. Presentational-разметку не тестируй.
- Component-render и Playwright e2e не добавляй без явной просьбы. Живой sync-e2e уже есть: `pnpm --filter @dotlearn/web test:e2e:sync`.
- Без сети и без pyodide/sql.js в unit-тесте. Подставляй фейки (`inlineJavascriptRuntime`).

## Расширение контракта

Новый `type` упражнения или рантайм ломает контракт. В одном изменении:

1. Вариант в `packages/contracts` (`exercise.schema.ts` или соседняя схема, которую union уже включает).
2. Раннер в `packages/lesson-engine/src/runners/` и спеки. `pnpm test` зелёный.
3. `exercise.schema.json` и `reference/exercise-types.md` в обоих скиллах.
4. `pnpm sync:skills`.

Смена языковых полей или суффиксов файлов темы тоже breaking: `topic.schema.ts`, резолвер, оба `manifest.schema.json`, миграция тем, `pnpm sync:skills`, `pnpm validate`. Не начинай, если не доведёшь в одном изменении.

## Переменные окружения

Имена, не значения. `.env` не читай и не коммить.

| Переменная                                                                           | Назначение                                                                |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `DOMAIN` / `ACME_EMAIL`                                                              | домен и email авто-HTTPS при bare-metal деплое                            |
| `DATA_DIR`                                                                           | том данных api                                                            |
| `ES_NODE` / `ES_ENABLED`                                                             | Elasticsearch. `ES_ENABLED` не `true` означает in-memory                  |
| `VITE_API_BASE`                                                                      | базовый URL api для фронта                                                |
| `VITE_ADMIN_PATH`                                                                    | путь admin-роута, дефолт `/admin`                                         |
| `VITE_GITHUB_URL`                                                                    | ссылка футера; пусто значит ссылка скрыта                                 |
| `VITE_SITE_URL`                                                                      | origin SEO-артефактов; пусто значит берётся `VITE_API_BASE`               |
| `VITE_UMAMI_WEBSITE_ID` / `VITE_UMAMI_SRC`                                           | опциональный Umami на сборке web; без id скрипт не вшивается              |
| `WEB_ORIGIN`                                                                         | CORS api, дефолт `http://localhost:5173`                                  |
| `HOST` / `PORT`                                                                      | bind api, дефолт `127.0.0.1:3000`                                         |
| `TRUSTED_PROXY_HOPS`                                                                 | хопы перед api. Compose: `1`. Prod-overlay: `2`                           |
| `PRESENCE_TTL_MS` / `PRESENCE_MAX_TRACKED`                                           | окно онлайна (дефолт 90с) и потолок id (дефолт 50000)                     |
| `PRESENCE_ANALYTICS`                                                                 | расширенная аналитика presence. Выкл по умолчанию. `deploy.sh` ставит `1` |
| `SYNC_MAX_BLOB_BYTES` / `SYNC_MAX_CODES` / `SYNC_TTL_DAYS` / `SYNC_BODY_LIMIT_BYTES` | синк: дефолты 1 МиБ, 2000 кодов, 90 дней, тело 2 МиБ                      |
| `GHCR_OWNER`                                                                         | владелец образов `ghcr.io/<owner>/dotlearn-*`                             |
| `DOTSOUND_NETWORK`                                                                   | внешняя docker-сеть web. Дефолт `dotsoundbackend_dotsound`                |
| `API_PORT` / `ES_PORT`                                                               | публикация на loopback, дефолты 3000 и 9200                               |

Секреты admin (логин, JWT, TOTP) описаны в [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md). В чат их не копируй.

Манифесты тем объявляют `"license": "CC-BY-NC-4.0"`. Корневой `LICENSE` этот текст не дублирует. Поле лицензии темы не меняй без явной просьбы.

## Деплой

Основной путь: bare-metal Debian/Ubuntu. Caddy отдаёт статику и проксирует `/api`, api под systemd.

| Действие      | Команда                                       |
| ------------- | --------------------------------------------- |
| Полный деплой | `sudo bash scripts/deploy.sh`                 |
| Обновление    | `make update`                                 |
| Статус / логи | `make status` / `make logs` / `make logs-web` |
| Рестарт       | `make restart`                                |
| Бэкап         | `make backup` / `make restore FILE=...`       |

- Артефакты: api в `/opt/dotlearn/api`, статика в `/var/www/dotlearn`, данные в `/var/lib/dotlearn/data`.
- `deploy.sh` ставит Node 22, pnpm и Caddy, выставляет `VITE_SITE_URL` и `VITE_API_BASE`, генерит admin-секреты (`apps/api/scripts/gen-admin-secrets.mjs`).
- Шаблоны: `deploy/`. Elasticsearch по умолчанию выключен.
- Статика включает пререндер. Caddy и nginx резолвят `{path}/index.html`. Заголовки правь в location-блоках, не в `security-headers.conf` (гейт `pnpm check:headers`).
- Docker: CI (`.github/workflows/deploy.yml`) пушит образы в `ghcr.io`. Сервер делает `pull` и `up -d --no-build`. Локальный `docker compose up` требует внешнюю сеть `dotsound`; порт web на хост не публикуется.

## Поток заявок

Оба пути сходятся на approve, затем материализация через `lesson-forge`:

- GitHub PR в `topics/<slug>/` (CI гоняет `pnpm validate`).
- Форма `/submit` на `POST /api/submissions`, ревью на `/admin`.

## Что делать агенту

- Перед правкой читай затронутые файлы и соседний код.
- После правки гоняй релевантное из таблицы. После `topics/**` обязателен `pnpm validate`.
- **README-sync:** при глобальных изменениях (команды, модули, пакеты, зависимости, архитектура, runtime, точки входа) обнови `README.md` через `generate-readme` (включая LoC) и правила через `sync-project-rules`. Опечатки, внутренний рефактор и мелкие багфиксы README не трогают.
- Не латай разметку README вручную.
- Минимальный diff. Числа, пути и версии только из репозитория.
- Коммиты: Conventional Commits, одна тема на коммит при добавлении контента. Без `Co-Authored-By` и без «Generated with AI».

## Чего не делать

- Не выдумывать команды, зависимости, env, эндпоинты, пути, версии, LoC.
- Не ставить в README `<details>`, centered hero, emoji, маркетинговые абзацы.
- Не менять `docs/cover.svg` без регенерации обложки. Не ссылаться на `docs/readme-hero.svg`.
- Не менять `LICENSE` и лицензию тем без явного запроса.
- Не коммитить секреты, токены, `.env`.
- Не удалять маркеры `<!-- loc:start -->` / `<!-- loc:end -->` в README.

## Документация

- [README.md](README.md) - запуск, команды, стек, архитектура
- [ARCHITECTURE.md](ARCHITECTURE.md) - диаграммы и инварианты
- [CONTRIBUTING.md](CONTRIBUTING.md) - как предлагать темы
- [SECURITY.md](SECURITY.md) - модель угроз
- [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md) - деплой, секреты, бэкап
- [docs/NEXT_AGENT_PROMPT.md](docs/NEXT_AGENT_PROMPT.md) - хэндофф

## DotCore

Плоский технический README, SVG-обложка DotBioSite, LoC-бейдж. «Обнови README» значит `generate-readme`. «Обнови правила» значит `sync-project-rules`.
