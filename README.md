# .learn

Локальная, AI-расширяемая учебная рабочая среда. Каждая «тема» — самодостаточный, типобезопасный модуль: теория в MDX, упражнения в YAML и опциональный кастомный sandbox. Новые темы генерируются скиллом `lesson-forge` — любая тема, прошедшая скилл, удовлетворяет одному контракту, запускается в одном плеере и без конфликтов вливается в форки.

## Концепция

Хочешь выучить SQL → просишь агента «создай тему по SQL» → агент вызывает `lesson-forge` → тот разворачивает структуру, генерирует уроки и задачи, валидирует их против Zod-контракта, прогоняет каждое gold-решение в браузерном sandbox и открывает PR. Ты pull-ишь, читаешь теорию, решаешь упражнения во встроенном SQL-редакторе. Через месяц — Python OOP. Тот же workflow, совсем другой контент, идентичный UX.

## Почему ещё одна обучающая платформа

В нише уже есть AI-тьюторы (OpenTutor, DeepTutor, AI-Shifu) и интерактивные песочницы (BitLab, LiveCodes, Nexora). Они делятся на два лагеря:

- **Платформы генерации контента** генерят JSON/Markdown уроки в фиксированных шаблонах. Новые типы интерактивности — только через разработчика.
- **Интерактивные песочницы** дают богатые рантаймы, но возят статическую, вручную составленную программу.

.learn занимает третью нишу: **codegen-расширяемая** платформа, где AI-агент может вводить и новый контент, *и* новые типы интерактивности — потому что каждая тема это код-модуль, а не строка в базе. Скилл `lesson-forge` гарантирует, что все темы стандартизованы.

## Что внутри (после Phase 1)

- **Plugin-free плеер**: открывается на `http://localhost:5173` без бэкенда, аккаунтов и интернета.
- **6 типов упражнений**: theory-quiz, sql-query, python-function, javascript-function, fill-in-blanks, predict-output.
- **2 живых рантайма**:
  - sql.js в Web Worker для SQL-запросов;
  - Pyodide в Web Worker (загружается с CDN при первом использовании) для Python.
- **Monaco-редактор** в SQL- и Python-упражнениях с подсветкой и автокомплитом.
- **Прогресс в IndexedDB** (Dexie): pass/fail по упражнению, активность по дням, серия (streak), GitHub-style heatmap на `/progress`.
- **FSRS-планировщик** флэшкарт через `ts-fsrs` готов к использованию (требует темы с `flashcards/*.yaml`).
- **MDX + Shiki**: теория рендерится с подсветкой кода и фронт-меттером.
- **Светлая и тёмная темы**: переключаются в шапке, тема сохраняется в `localStorage`.
- **BYOK-провайдеры**: `/settings` хранит ключи OpenAI / Anthropic / Ollama / OpenRouter в IndexedDB и проверяет соединение кнопкой Test connection. Ключи никогда не уходят на сервер.
- **Опциональный бэкенд** (`apps/api`, NestJS): submissions + admin для пользовательских предложений тем.
- **Валидатор**: `pnpm validate` запускает gold-решения каждого `sql-query` упражнения в sql.js под Node и сравнивает строки с `expected.rows`.

## Быстрый старт

```bash
pnpm install
pnpm dev:web
```

Открой http://localhost:5173. Демо-темы `sql-fundamentals` и `python-oop` уже в репозитории.

Чтобы добавить свою тему — попроси **Cursor** или **Claude Code** в этом репозитории:

> «Используй lesson-forge, добавь тему по SQL JOINs»

Скилл зеркалится в `.cursor/skills/lesson-forge/` и `.claude/skills/lesson-forge/`, поэтому активируется в любом инструменте. Он разворачивает `topics/<slug>/` и ведёт агента по контракту. Другие агенты (Aider, Continue и т.п.) читают `AGENTS.md` в корне — это универсальный entry point.

## Как присылать темы

Способов два:

1. **GitHub PR** — форкнул, запустил `lesson-forge` локально, прислал pull request. Качество проверяет CI против контракта.
2. **Форма в приложении** — кнопка «+ Add topic» открывает форму, которая POST-ит в `apps/api`. Заявки попадают в очередь модерации; мейнтейнер смотрит их в `/admin` и одобряет/отклоняет.

Оба маршрута сходятся в одной точке ревью.

## Структура проекта

```
.learn/
├── apps/
│   ├── web/                  # Vite + React, локально-первый UI
│   └── api/                  # NestJS, опциональный бэкенд (submissions, admin)
├── packages/
│   ├── contracts/            # Zod-схемы — единый источник правды
│   ├── lesson-engine/        # Topic loader + runners упражнений + Node CLI валидатор
│   ├── sandbox/              # sql.js / Pyodide воркеры
│   └── ai-providers/         # BYOK-абстракция: OpenAI/Anthropic/Ollama/OpenRouter
├── topics/                   # Контент (автодискавери)
│   ├── sql-fundamentals/
│   └── python-oop/
├── .cursor/skills/lesson-forge/
├── .claude/skills/lesson-forge/
├── AGENTS.md                 # универсальный entry point для агентов
└── docs/
```

## Команды

| Команда | Что делает |
|---|---|
| `pnpm dev:web` | Фронтенд. Работает офлайн после первой загрузки тем. AI — BYOK в браузере. |
| `pnpm dev:api` | NestJS API для submissions / admin / AI-прокси. |
| `pnpm dev` | Оба процесса параллельно. |
| `pnpm typecheck` | TS-проверка всех воркспейсов (Turborepo). |
| `pnpm validate` | Прогоняет контракт-валидатор по `topics/**` и запускает gold-решения SQL. |
| `pnpm build` | Production-сборка всех пакетов. |
| `pnpm sync:skills` | Синхронизирует скиллы из `.cursor/skills/` в `.claude/skills/`. |
| `pnpm check:skills` | CI-проверка, что зеркала идентичны. |

## Self-hosting через Docker

`docker compose up` поднимает три сервиса: `web` (nginx со статикой), `api` (NestJS) и `elasticsearch` (для fuzzy-поиска заявок). Данные API живут в named volume `dotlearn-data` — submissions и hidden-topics переживают пересборку контейнеров.

### Шаги

```bash
# 1. Скопировать шаблон окружения
cp .env.example .env

# 2. Сгенерировать секреты админки (вывод сразу в формате .env)
pnpm --filter @dotlearn/api admin:hash 'СильныйПароль123!'
pnpm --filter @dotlearn/api admin:totp        # покажет QR в терминале — отсканируй
pnpm --filter @dotlearn/api admin:jwt-secret

# 3. Вписать выводы (ADMIN_PASSWORD_HASH, ADMIN_TOTP_SECRET,
#    ADMIN_BACKUP_CODES_HASHED, ADMIN_JWT_SECRET, ADMIN_REFRESH_SECRET)
#    в .env. Backup-коды сохрани отдельно — они показываются один раз.

# 4. Заполнить публичные параметры (VITE_API_BASE, VITE_ADMIN_PATH, WEB_ORIGIN)
#    и поднять стек
docker compose up --build -d
```

Готово: фронт на `http://localhost:8080`, API на `http://localhost:3000`, Swagger на `http://localhost:3000/docs`.

### Ключевые переменные `.env`

| Переменная | Зачем |
|---|---|
| `VITE_API_BASE` | Откуда фронт ходит в API. Должно совпадать с публичным адресом контейнера `api`. |
| `VITE_ADMIN_PATH` | Путь админки на фронте. Сделай его трудноугадываемым (`/secret-admin-7f2c`). |
| `WEB_ORIGIN` | CORS allowlist API. Должно совпадать с публичным origin фронта. |
| `ADMIN_LOGIN` / `ADMIN_PASSWORD_HASH` / `ADMIN_TOTP_SECRET` | Учётка единственного админа. |
| `ADMIN_BACKUP_CODES_HASHED` | JSON-массив SHA256-хэшей backup-кодов на случай потери authenticator'а. |
| `ADMIN_JWT_SECRET` / `ADMIN_REFRESH_SECRET` | Подпись access и refresh JWT. |
| `ES_ENABLED` | `true` → fuzzy-поиск через elasticsearch. `false` → in-memory Левенштейн (хватает на десятки заявок). |

Все остальные тайминги (`ADMIN_ACCESS_TTL`, `ADMIN_LOCKOUT_TTL`, `ADMIN_STEPUP_TTL` и т.д.) — необязательные, разумные дефолты в `auth.config.ts`.

### Ротация секретов

- **Пароль / TOTP / backup-коды:** перегенерируй CLI-скриптами, обнови `.env`, рестарт `api`. Старые refresh-токены продолжают работать, пока активны — поэтому **сразу после ротации** жми в админке «Сбросить все сессии» (кнопка в шапке), чтобы инвалидировать всё разом.
- **`VITE_ADMIN_PATH`:** этот путь зашивается в бандл фронта на этапе билда. Просто перезаписать `.env` мало — нужно пересобрать `web`-образ:

  ```bash
  docker compose build web && docker compose up -d web
  ```

  Старый путь после этого отдаст 404. Если открыт в другом табе — пользователь увидит ту же страницу 404 и должен будет узнать новый путь.

- **JWT-секреты:** ротация секретов автоматически инвалидирует все выпущенные токены (старые перестают верифицироваться). После рестарта `api` все админы должны войти заново.

### Бэкап данных

```bash
docker run --rm -v dotlearn_dotlearn-data:/data -v "$(pwd)":/backup alpine \
  tar czf /backup/dotlearn-data-$(date +%F).tar.gz -C /data .
```

В томе лежат `submissions.json` и `hidden-topics.json` — это всё состояние API. Elasticsearch-индекс восстанавливается из них автоматически при старте через `SubmissionsSearchIndexer`.

## Архитектурные инварианты

1. **`apps/web` работает без `apps/api`.** Local-first значит: SPA читает `topics/` напрямую через `import.meta.glob`, гоняет sandbox в Web Workers, ходит в AI-провайдеры из браузера через BYOK. Бэкенд — *опциональное усиление*, никогда не обязательная зависимость.
2. **`packages/contracts` — единственное место, где встречаются оба мира.** Web валидирует манифесты тех же Zod-схем, которые API использует для DTO. TS-типы выводятся через `z.infer<>`.
3. **Темы никогда не импортируют из `apps/*`.** Манифест может ссылаться на кастомный `sandbox.tsx`, но только когда без него действительно нельзя. Всё остальное — данные. Так форки сливаются чисто.
4. **Скилл `lesson-forge` владеет контрактом.** Любое изменение формы темы — schemas + reference docs + шаблоны — должно идти одной транзакцией.
5. **`.cursor/skills/lesson-forge/` — канонический источник скилла.** `scripts/sync-skills.mjs` зеркалит его в `.claude/skills/lesson-forge/`. CI прогоняет `pnpm check:skills`.

Подробности — в [ARCHITECTURE.md](./ARCHITECTURE.md).

## Статус

Phase 1 (Minimum Viable Player) завершена: плеер запускается, упражнения интерактивны, прогресс сохраняется, темы валидируются end-to-end. Полный план развития — в [ROADMAP.md](./ROADMAP.md).

## Лицензия

MIT.
