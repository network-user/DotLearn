# Security Audit · Amber Sentinel · 2026-07-08

| Поле                 | Значение                                                         |
| -------------------- | ---------------------------------------------------------------- |
| Статус               | PASSED WITH WARNINGS                                             |
| Прогон               | amber-sentinel                                                   |
| Уровень              | full                                                             |
| Охват                | leaks + code                                                     |
| Модель               | Fable 5                                                          |
| Дата                 | 2026-07-08                                                       |
| Аудируемое состояние | HEAD `6f81c1ec` (security-фиксы прогона + UI error-UX полировка) |

Аудит выполнил **Fable 5** (Claude Fable 5). Веер из 9 подагентов по измерениям — утечки (секреты / история / PII), код (инъекции·exec·path, web·sandbox·XSS·CSP, auth·authz·JWT), зависимости·CI·Docker, инфра-деплой, свежий diff. История проверена включая **GitHub PR-рефы** (которых нет в локальном клоне).

## Сводка

```
Трек A · Секреты/ключи:    0  (Crit 0 / High 0)
Трек A · PII/экспозиция:   0
Трек A · История git:      1 Medium (M3) + 1 Info
Трек B · Инъекции/exec:    0
Трек B · Web/XSS/CSP:      0
Трек B · Authz/крипто:     0  (3 Low, defense-in-depth)
Трек B · Зависимости:      0 prod (1 Low, dev-only)
Инфра/CI/Docker:           1 Medium (FIXED) + Low
```

Severity (после фиксов): **Crit 0 · High 0 · Med 1** (M3, вне репозитория) **· Low ~10 · Info**
Готовность: **9/10**
Вердикт: **PASSED WITH WARNINGS** — единственный варнинг M3 (экспозиция через GitHub PR-рефы; реальных секретов нет; устраняется вне репозитория).

## Находки (severity по убыванию)

| Severity       | Категория           | Файл:строка                                                               | Описание                                                                                                                                                                                                                                                   | Статус / рекомендация                                                                                   |
| -------------- | ------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Medium**     | history-exposure    | GitHub `refs/pull/*/head` → `.smoke/*.png`, `.claude/settings.local.json` | Вычищенные из `main` файлы доступны в 18 публичных PR-рефах: машинные пути `C:/Users/<user>/…`, allow-list команд, внешний URL, тест-плейсхолдеры ADMIN\_\* (**реальных секретов нет** — хеш алфавитный, TOTP это публичный pyotp-пример, JWT в 1-2 символа) | **ОТКРЫТО**. Вне репозитория: GitHub Support cache purge, либо private→полная пересборка истории→public |
| Medium → fixed | supply-chain/ci     | `.github/workflows/deploy.yml:31,38,45,50,64`                             | Официальные экшены по мутируемому тегу (`@v3`/`@v6`) при `packages: write` + автодеплой `:latest`                                                                                                                                                          | **FIXED**: SHA-пины checkout/login/buildx/build-push                                                    |
| Medium → fixed | availability/DI     | `apps/api/src/modules/auth/auth.controller.ts`                            | `import type` стирал DI-метаданные → API не стартовал (crash-loop), гейты при этом зелёные                                                                                                                                                                 | **FIXED** в коммите `78f1f46`                                                                           |
| Low → fixed    | rate-limit          | `apps/web/nginx.conf:23`                                                  | XFF replace → троттлер ключуется по IP прокси, все per-IP лимиты в одном бакете (DoS логина для всех админов)                                                                                                                                              | **FIXED**: `$proxy_add_x_forwarded_for`                                                                 |
| Low → fixed    | container-hardening | `docker-compose.yml` (api, web)                                           | нет `cap_drop` / `no-new-privileges` (паритет с systemd)                                                                                                                                                                                                   | **FIXED**                                                                                               |
| Low → fixed    | ci-permissions      | `.github/workflows/deploy.yml`                                            | `deploy`-job без явного `permissions:`                                                                                                                                                                                                                     | **FIXED**: top-level `contents: read`                                                                   |
| Low → fixed    | secrets-hygiene     | `.gitignore`                                                              | нет паттернов ключей/сертов/кред-стора                                                                                                                                                                                                                     | **FIXED** (+ `.tmp-*`)                                                                                  |
| Low → fixed    | build-cache         | `turbo.json`                                                              | `VITE_GITHUB_URL` не инвалидирует turbo-кэш → устаревший футер                                                                                                                                                                                             | **FIXED**                                                                                               |
| Low            | authz-def-in-depth  | `admin-submissions.controller.ts`, `admin-hidden-topics.controller.ts`    | fail-closed держится **неявно** (jwt отвергает пустой секрет)                                                                                                                                                                                              | Рек.: `AuthConfigGuard` на все `admin/*`                                                                |
| Low            | jwt-hardening       | `apps/api/src/modules/auth/auth.service.ts`                               | JWT без `iss`/`aud`                                                                                                                                                                                                                                        | Рек.: добавить issuer/audience                                                                          |
| Low            | crypto              | `apps/api/src/modules/auth/auth.service.ts`                               | backup-коды через sha256, не bcrypt                                                                                                                                                                                                                        | Приемлемо (одноразовые + throttle + lockout)                                                            |
| Low            | info-disclosure     | `apps/api/src/modules/health/health.controller.ts`                        | `authConfigured` отдаётся без auth                                                                                                                                                                                                                         | Приемлемо (fail-closed, имён переменных не раскрывает)                                                  |
| Low            | dep (dev)           | `esbuild@0.28.0`                                                          | dev-only CVE GHSA-g7r4-m6w7-qqqr (dev-сервер, Windows), в prod не попадает                                                                                                                                                                                 | Рек.: `pnpm.overrides` `esbuild >=0.28.1`                                                               |
| Low            | test-gap            | api boot                                                                  | нет boot-smoke → DI/boot-крэш проходит typecheck·build·test                                                                                                                                                                                                | Рек.: boot-smoke собранного api в CI                                                                    |
| Low            | repo-hygiene        | `packages/sandbox/.tmp-sqlite-smoke.mjs`                                  | tmp-smoke закоммичен в `d01e079` (без секретов, в бандл не идёт)                                                                                                                                                                                           | Рек.: `git rm` (удаление — по подтверждению)                                                            |
| Info           | repo-hygiene        | `apps/api/data/revoked-tokens.json` (в истории)                           | рантайм-файл был в истории; уже удалён, `apps/api/data/` в `.gitignore`                                                                                                                                                                                    | —                                                                                                       |
| Info           | supply-chain        | prod-зависимости                                                          | `pnpm audit --prod` = 0 уязвимостей                                                                                                                                                                                                                        | —                                                                                                       |

Улики маскированы; значения секретов в отчёт не выносятся. Реальных секретов ни в дереве, ни в истории, ни в PR-рефах не найдено.

## Проверено и чисто

- **Секреты (дерево):** 7 категорий сигнатур + проверка индекса + ignored-but-tracked — 0.
- **История git:** 0 жёстких сигнатур (AWS/GCP/GitHub/Slack/Stripe/PEM) по всем 67 коммитам И по всем 32 GitHub PR-рефам; реальный `.env` не коммитился (только `.env.example`); `provider-credentials.ts` (удалённый BYOK) без хардкода; `.smoke/`+`settings.local.json` вычищены из `main`.
- **Auth:** fail-closed на кривом ADMIN\_\* подтверждён эмпирически (два слоя, 503/401); jwtid-баг исправлен; login-throttle 5/min + lockout; rotating refresh с reuse-detection; TOTP-replay защита; cookie httpOnly+secure(prod)+sameSite.
- **Web/sandbox:** harden-before-eval, нейтеринг fetch/сети/WebRTC/WebTransport в воркерах; postMessage валидируется; нет `dangerouslySetInnerHTML`/`innerHTML`; CSP `'self'` синхронизирован по 4 каналам; импорт прогресса Zod-валидируется, prototype-pollution закрыт.
- **Инъекции/exec/path/SSRF:** нет `child_process`, нет серверного `fetch`; YAML безопасный парсер + Zod; path-гарды (`../`/`\0`); sql.js/pyodide by-design в песочнице; validate не исполняет несандбоксированный код на PR-контенте.
- **Деплой:** `.env`→`/etc/dotlearn` `600 root`, `crypto.randomBytes(48)`, пароль по stdin, apt gpg-signed по HTTPS, systemd hardening (`NoNewPrivileges`/`ProtectSystem=strict`/пустой `CapabilityBoundingSet`), Makefile tar-slip защита, `trust proxy` дефолт 0 при кривом вводе.

## Охват и оговорки

- **Scope прогона:** до коммита `6f81c1ec` включительно. Параллельный сеанс закоммитил security-фиксы прогона (`deploy.yml`, `nginx.conf`, `docker-compose.yml`, `.gitignore`, `turbo.json`) вместе со своей UI-полировкой в один коммит `6f81c1ec`.
- **UI-дельта `6f81c1ec`** (`AdminPage.tsx`, `ProposalsPage.tsx`, `HomePage.tsx`, `locales/{ru,en}.json`) доревьюена: вынос dev-подсказки «pnpm dev:api» в отдельный i18n-ключ (gated `import.meta.env.DEV`, в prod не течёт), паритет ru/en сохранён, рендер как React-текст — новых XSS-стоков/`dangerouslySetInnerHTML` нет. Чисто.
- **M3** не устраним внутри репозитория; вердикт PASSED WITH WARNINGS учитывает его как стоящий варнинг. Существенные изменения кода после этого прогона обесценивают заявление — перезапустите аудит.

---

Аудит выполнил **Fable 5**.
