# Security Audit · Ember Circuit · 2026-07-18

| Поле                 | Значение                         |
| -------------------- | -------------------------------- |
| Статус               | PASSED WITH WARNINGS             |
| Прогон               | ember-circuit                    |
| Уровень              | medium                           |
| Охват                | leaks + code                     |
| Модель               | Claude Opus                      |
| Дата                 | 2026-07-18                       |
| Аудируемое состояние | HEAD `21866a4`                   |

Веер из 4 подагентов: утечки/PII, инъекции/exec/path/SSRF/XSS, authz/крипто/дефолты, зависимости/Docker/CI. Critical/High не найдены (adversarial-шаг не требовался). Medium подтверждены чтением кода.

## Сводка

```
Трек A · Секреты/ключи:   0  (Crit 0 / High 0)
Трек A · PII/экспозиция:   3  (1 Med · 2 Low)
Трек A · История git:      n/a (средний уровень)
Трек B · Инъекции/exec:    4  Low/Info (нет High)
Трек B · Authz/крипто:     9  (1 Med · 8 Low)
Трек B · Зависимости:      3  Low
Инфра/CI/Docker:           6  Low
```

Severity: **Crit 0 · High 0 · Med 2 · Low 18 · Info (гигиена)**  
Готовность: **7/10**  
Вердикт: **PASSED WITH WARNINGS**

## Находки (открытые)

| Severity | Категория | Файл:строка | Описание | Рекомендация |
|----------|-----------|-------------|----------|--------------|
| Medium | network-bind | `apps/api/src/main.ts:102` | Дефолт `HOST=0.0.0.0` - API слушает все интерфейсы без `.env` | Дефолт bare-metal `127.0.0.1`; `0.0.0.0` только через compose/Docker env |
| Medium | auth-oracle | `apps/api/src/modules/auth/auth.service.ts:112-123` | Разные 401: `Invalid credentials` vs `Invalid TOTP code` подтверждают верный пароль до MFA | Единое сообщение для всех сбоев login (например `Invalid credentials`) |
| Low | env-file-perms | `deploy/update.sh:37` | Docker-update не делает `chmod 600` на repo `.env` (bare-metal deploy.sh - делает) | После проверки `.env`: `chmod 600` |
| Low | insecure-default | `docker-compose.yml:9` | ES profile: `xpack.security.enabled=false` (порт только loopback) | Не публиковать ES наружу; для non-local включить auth |
| Low | predictable-surface | `.env.example:18` | `VITE_ADMIN_PATH=/admin` по умолчанию | Непредсказуемый path на prod-сборке |
| Low | authz-guard | `admin-submissions.controller.ts` / `admin-hidden-topics` | `AuthConfigGuard` только на `AuthController`; admin business - только JWT guards | `AuthConfigGuard` на всех admin-контроллерах → 503 при unconfigured |
| Low | crypto-entropy | `apps/api/scripts/gen-admin-secrets.mjs` | Backup codes ~32 bit (XXXX-XXXX), SHA-256 без соли | ≥128 bit entropy; KDF/HMAC с pepper |
| Low | jwt | `auth.service.ts` sign/verify | Нет `iss`/`aud` на access/refresh | Зафиксировать iss/aud на sign и enforce на verify |
| Low | session | `lockout.service.ts`, step-up | Lockout/step-up только in-memory Map | Документировать single-instance; shared store при scale-out |
| Low | rate-limit | `main.ts:55-65` | `TRUSTED_PROXY_HOPS` default 0 - throttle по IP прокси | Assert hops≥1 в production за reverse-proxy |
| Low | crypto-sync | `apps/web/src/lib/sync/engine.ts` | Fallback push plaintext blob без AES-GCM если WebCrypto недоступен | Fail-closed без E2E или server reject non-DLS1 |
| Low | defaults | `scripts/deploy.sh` | `ADMIN_LOGIN` default `admin`; min password 8 | Не-default login на first deploy; сильнее floor |
| Low | info-disclosure | `health.controller.ts` | Публичный health отдаёт `authConfigured` | Убрать флаг из public body |
| Low | auth-lockout | `auth.service.ts:104` | Ошибки пароля не крутят lockout (by design, anti-DoS) | Оставить + выровнять сообщения; progressive delay/CAPTCHA по IP |
| Low | mdx-xss | `apps/web/vite.config.ts` MDX | MDX без rehype-sanitize; trust = review topics/** | Review gate; опционально sanitize allowlist |
| Low | xss | `StaticCode.tsx` / demos | `dangerouslySetInnerHTML` от Shiki HTML | Только Shiki/uqr markup; regression на escape |
| Low | code-exec | `packages/lesson-engine/.../javascript.ts` | `new Function` для JS exercises; не wired в SPA | Перед включением: Worker + hardenWorkerScope |
| Low | code-exec-cli | `validate-topics.ts` gold | Node pyodide/sql.js на solutions из topics/** | Только trusted remote/CI; не HTTP |
| Low | supply-chain | `.npmrc` | Нет `ignore-scripts` / `onlyBuiltDependencies` | pnpm: ignore-scripts + allowlist native builds |
| Low | supply-chain | root `package.json` | Security pins в lockfile, нет `pnpm.overrides` в package.json | Дублировать overrides в package.json |
| Low | docker | `docker-compose.prod.yml` | Образы `:latest` + auto-pull | Pin digest / git SHA tag |
| Low | docker | `apps/*/Dockerfile` | Base images по тегу, не digest | `FROM image@sha256:…` |
| Low | docker | `docker-compose.yml` | Нет mem/cpu/pids limits | Лимиты в prod overlay |
| Low | ci | `.github/workflows/deploy.yml` | `secrets.DEPLOY_REPO_PATH` интерполируется в remote shell | Variable + path allowlist, не secret в shell path |

## Проверено и чисто (в охвате)

- **Секреты в дереве:** нет PEM/AWS/GitHub/Stripe live tokens; `.env` / `*.pem` / credentials в `.gitignore`; tracked только `.env.example` с плейсхолдерами.
- **CORS:** allowlist из `WEB_ORIGIN`, `credentials: true`, не `*`.
- **Auth:** JWT alg pinned HS256; secrets из env, min length, dual secrets; refresh rotation + jti revoke + session epoch; TOTP + backup; step-up на admin mutations; access token только в memory.
- **Sync:** code ~60 bit Crockford; server stores sha256(code); path allowlist hex-64; blob opaque base64 size-capped; не eval на сервере.
- **Path/SSRF/SQL server:** JSON file store + traversal reject; API без server SQL; ES node только из env; sandbox exec только client Web Workers / offline CLI gold.
- **Sandbox:** hardenWorkerScope neuters network/storage escape globals; CSP без `unsafe-eval` на document.
- **Зависимости:** `pnpm audit` 0 high/critical (prod); frozen-lockfile в CI/Docker; no postinstall lifecycle hooks in workspace packages.
- **Инфра:** non-root containers, cap_drop ALL; systemd unit strongly hardened; CI `pull_request` (не `pull_request_target`), actions SHA-pinned.

## Охват и оговорки

- Уровень **medium**: ревью критичных модулей (auth, sync, presence, submissions, search, hidden-topics, storage, sandbox, web XSS) + гигиена утечек + deps/CI light. **История git не сканировалась** (нужен full / public-visibility прогон).
- Новый функционал с прошлой даты (SEO surface, glossary, resizable runners, lesson-engine grading, personalize, interview content) не вводил server RCE/инъекций; риск по-прежнему content-trust (MDX/topics) и client sandbox.
- Локальный `pnpm@11` audit на Node 20 упал (нужен Node 22+); audit прогнан через совместимый pnpm - результат 0 High/Critical.
- Ремедиация в этом прогоне **не делалась** (только аудит + stamp).

## Приоритет ремедиации

1. **Medium:** единое login error message; HOST default loopback.
2. **Low auth/crypto:** AuthConfigGuard на admin, backup code entropy, iss/aud JWT, TRUSTED_PROXY assert.
3. **Low ops:** chmod 600 в update.sh, pin images, compose resource limits.
4. **Low supply-chain:** pnpm overrides в package.json, ignore-scripts policy.
5. **Info/hygiene:** MDX sanitize policy, presence caps (deferred from cobalt-lattice).
