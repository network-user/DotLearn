# Self-hosting через Docker

`docker compose up` поднимает три сервиса: `web` (nginx со статикой), `api` (NestJS) и `elasticsearch` (для fuzzy-поиска заявок). Данные API живут в named volume `dotlearn-data` - submissions и hidden-topics переживают пересборку контейнеров.

## Шаги

```bash
# 1. Скопировать шаблон окружения
cp .env.example .env

# 2. Сгенерировать секреты админки (вывод сразу в формате .env)
pnpm --filter @dotlearn/api admin:hash 'СильныйПароль123!'
pnpm --filter @dotlearn/api admin:totp        # покажет QR в терминале - отсканируй
pnpm --filter @dotlearn/api admin:jwt-secret

# 3. Вписать выводы (ADMIN_PASSWORD_HASH, ADMIN_TOTP_SECRET,
#    ADMIN_BACKUP_CODES_HASHED, ADMIN_JWT_SECRET, ADMIN_REFRESH_SECRET)
#    в .env. Backup-коды сохрани отдельно - они показываются один раз.

# 4. Заполнить публичные параметры (VITE_API_BASE, VITE_ADMIN_PATH, WEB_ORIGIN)
#    и поднять стек
docker compose up --build -d
```

Готово: фронт на `http://localhost:8080`, API на `http://localhost:3000`, Swagger на `http://localhost:3000/docs`.

## Ключевые переменные `.env`

| Переменная                                                  | Зачем                                                                                                 |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE`                                             | Откуда фронт ходит в API. Должно совпадать с публичным адресом контейнера `api`.                      |
| `VITE_ADMIN_PATH`                                           | Путь админки на фронте. Сделай его трудноугадываемым (`/secret-admin-7f2c`).                          |
| `WEB_ORIGIN`                                                | CORS allowlist API. Должно совпадать с публичным origin фронта.                                       |
| `ADMIN_LOGIN` / `ADMIN_PASSWORD_HASH` / `ADMIN_TOTP_SECRET` | Учётка единственного админа.                                                                          |
| `ADMIN_BACKUP_CODES_HASHED`                                 | JSON-массив SHA256-хэшей backup-кодов на случай потери authenticator'а.                               |
| `ADMIN_JWT_SECRET` / `ADMIN_REFRESH_SECRET`                 | Подпись access и refresh JWT.                                                                         |
| `ES_ENABLED`                                                | `true` → fuzzy-поиск через elasticsearch. `false` → in-memory Левенштейн (хватает на десятки заявок). |

Все остальные тайминги (`ADMIN_ACCESS_TTL`, `ADMIN_LOCKOUT_TTL`, `ADMIN_STEPUP_TTL` и т.д.) - необязательные, разумные дефолты в `auth.config.ts`.

## Ротация секретов

- **Пароль / TOTP / backup-коды:** перегенерируй CLI-скриптами, обнови `.env`, рестарт `api`. Старые refresh-токены продолжают работать, пока активны - поэтому **сразу после ротации** жми в админке «Сбросить все сессии» (кнопка в шапке), чтобы инвалидировать всё разом.
- **`VITE_ADMIN_PATH`:** этот путь зашивается в бандл фронта на этапе билда. Просто перезаписать `.env` мало - нужно пересобрать `web`-образ:

  ```bash
  docker compose build web && docker compose up -d web
  ```

  Старый путь после этого отдаст 404. Если открыт в другом табе - пользователь увидит ту же страницу 404 и должен будет узнать новый путь.

- **JWT-секреты:** ротация секретов автоматически инвалидирует все выпущенные токены (старые перестают верифицироваться). После рестарта `api` все админы должны войти заново.

## Бэкап данных

```bash
docker run --rm -v dotlearn_dotlearn-data:/data -v "$(pwd)":/backup alpine \
  tar czf /backup/dotlearn-data-$(date +%F).tar.gz -C /data .
```

В томе лежат `submissions.json` и `hidden-topics.json` - это всё состояние API. Elasticsearch-индекс восстанавливается из них автоматически при старте через `SubmissionsSearchIndexer`.
