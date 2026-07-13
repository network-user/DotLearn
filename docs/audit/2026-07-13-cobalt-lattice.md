# Security Audit · Cobalt Lattice · 2026-07-13

| Поле | Значение |
|------|----------|
| Статус | PASSED |
| Прогон | cobalt-lattice |
| Уровень | full |
| Охват | leaks + code |
| Модель | Claude Opus 4.8 |
| Дата | 2026-07-13 |
| Аудируемое состояние | HEAD `5b18979` + ремедиация этой сессии (см. ниже) |

Веер из 8 подагентов по измерениям (утечки: дерево, история, PII; код: auth·sync·submissions, API core·сеть·persistence, sandbox, web·XSS·крипто; зависимости; инфра·CI) + adversarial-верификация. Затем ремедиация уровня «зелёный + безопасные фиксы» с проверкой гейтами.

## Сводка (после ремедиации)

```
Трек A · Секреты/ключи:       0  (Crit 0 / High 0; 7 benign-verified)
Трек A · PII/экспозиция:       1  Low (machine-path в истории, generic-аккаунт)
Трек A · История git:          0  секретов (скрабы pass-7/8 держатся)
Трек B · Инъекции/exec/path/SSRF/ReDoS: 0
Трек B · Auth/authz/крипто:    3  Low (deferred: квоты, proxy-assert; reason FIXED)
Трек B · Sandbox-изоляция:     0  (OPFS/WebSocketStream/self-test FIXED; 1 REFUTED)
Трек B · Web/XSS/крипто:       0  (deep-link, progress-io FIXED)
Трек B · Зависимости:          1  Low (install-scripts; Node-EOL и esbuild FIXED)
Инфра/CI/Docker:               4  Low (deferred: digests, limits, chmod, admin-path)
```

Severity (после ремедиации): **Crit 0 · High 0 · Med 0 · Low 9 · Info 12**
Готовность: **10/10**
Вердикт: **PASSED**. Единственный Medium прогона (Node 20 EOL) устранён (переход на Node 22 LTS). Остаток только уровня Low/Info: часть закрыта в этой сессии, часть сознательно отложена (объём «зелёный + безопасные фиксы», инфра/API-логика в следующий проход).

## Ремедиация (сессия 2026-07-13, объём: зелёный + безопасные фиксы)

Закрыто и верифицировано (typecheck web/api/sandbox чисто; тесты contracts 109 / api 157 / web 165 включая `merge.test.ts` 47 и `progress-io.spec.ts` 19; vite-трансформ 5461 модуля):

| Было (severity) | Фикс | Файлы |
|-----------------|------|-------|
| Medium · Node 20 EOL | Node 20 → 22 LTS (снимает единственный Medium) | `.nvmrc`, `package.json` engines, `apps/api/Dockerfile`, `apps/web/Dockerfile`, `.github/workflows/ci.yml`, README-бейдж |
| Low · esbuild dev-CVE | `pnpm.overrides esbuild >=0.28.1` (глобальный; scoped ломал бинарь-валидацию); vite-build подтвердил совместимость | `package.json`, `pnpm-lock.yaml` |
| Low · OPFS не нейтрализован | `navigator.storage` добавлен в нейтеринг (own-property затеняет getter) | `packages/sandbox/src/harden-worker-scope.ts` |
| Low · денилист неполон | `WebSocketStream` добавлен | тот же файл |
| Low · neutralize() fail-open | fail-closed self-test: `assertWorkerScopeHardened` + `WorkerScopeHardeningError` реджектят промис воркера, user-код не стартует при уцелевшем глобале | тот же файл |
| Low · reason наружу | публичный `GET /api/topics/hidden` больше не отдаёт `reason`; схема разделена `HiddenTopic` (admin) / `HiddenTopicPublic` | `packages/contracts/src/admin-topics.schema.ts`, `hidden-topic.entity.ts`, service, controller, web `api-client.ts`, `AdminPage.tsx` |
| Low · deep-link phishing | подтверждение показывает полный код + предупреждение о выгрузке данных (ru/en) | `apps/web/src/components/SyncPanel.tsx`, `locales/{ru,en}.json` |
| Low · progress-io unknown keys | allowlist-пересборка каждой записи (`pick`), неизвестные ключи режутся до `bulkPut`; та же защита в `merge.ts` | `apps/web/src/lib/progress-io.ts`, `sync/merge.ts` |
| Low · .dockerignore | добавлен `**/.env*` (вложенные `.env` вне build-context) | `.dockerignore` |
| Low · scratch tracked | `git rm --cached packages/sandbox/.tmp-sqlite-smoke.mjs` (файл на диске, теперь ignored) | index |

Отложено сознательно (объём Tier C, следующий проход): потолки presence-множеств, per-IP-квоты sync/submissions, boot-assert `TRUSTED_PROXY_HOPS`, пины Docker-образов по digest + verify `:latest`, mem/pids-лимиты compose, `chmod 600` на `.env` в `update.sh`, `VITE_ADMIN_PATH`→vars, `install-scripts` hardening (pnpm 10), scrub machine-path в истории.

## Остаточные Low (открыто)

| Severity | Категория | Файл:строка | Описание |
|----------|-----------|-------------|----------|
| Low | resource-exhaustion | `apps/api/.../presence.service.ts:189` | `todayIds`/`topicToday` без потолка |
| Low | availability-dos | `apps/api/.../sync.service.ts:100`, `submissions.service.ts:60` | глобальные ёмкости без per-IP-квоты |
| Low | rate-limit-config | `apps/api/src/main.ts:55` | fairness/audit-IP зависят от `TRUSTED_PROXY_HOPS` |
| Low | install-script-hardening | `.npmrc:1` | нет `ignore-scripts`/`onlyBuiltDependencies` (pnpm 9) |
| Low | supply-chain-deploy | `docker-compose.prod.yml:18`, `deploy/update.sh:44` | `:latest`+auto-pull без digest/подписи |
| Low | env-file-perms | `deploy/update.sh:37` | нет `chmod 600` на repo-root `.env` |
| Low | resource-limits | `docker-compose.yml:24,60` | нет mem/cpu/pids-лимитов |
| Low | base-image-pinning | `apps/*/Dockerfile` | базовые образы по тегам, не digest |
| Low | machine-path-history | `docs/NEXT_AGENT_PROMPT.md` (истор.) | generic `C:\Users\User\…` в истории |

## Верификация Medium (adversarial)

- **OPFS `navigator.storage`**: CONFIRMED-LOW (понижен с Medium), затем FIXED. Достижим, но impact локальный (нет эксфильтрации под CSP, нет данных в OPFS, нет escape).
- **Pyodide `loadPackage` internal-fetch**: REFUTED. Против фактического `pyodide@0.26.4`: все 158 `fetch` в даунлоадере bare-вызовы; после harden `self.fetch=undefined` даёт TypeError без запроса, в dev и prod, независимо от CSP. Оговорка: перепроверить при бампе pyodide.

## Проверено и чисто (аудит)

Auth исключительно укреплён: JWT HS256 закреплён на sign+verify (нет `alg:none`), session-epoch + jti-revocation, refresh-ротация с reuse-detection, пустой секрет fail-closed сквозняком, TOTP replay-guard без гонки, каждый admin-роут за `AdminAuthGuard`+step-up. Path traversal / proto-pollution / SSRF / ReDoS закрыты. XSS: всё через Shiki-escape/QR-SVG, `sanitizeHref`, `rel=noreferrer`. Sync-крипто AES-GCM-256 + свежий IV + non-extractable ключ. История git чиста (скрабы pass-7/8 держатся, 124 коммита). Инфра: systemd hardening, `cap_drop ALL`, non-root образы, CI на `pull_request` c SHA-пинами, CSP байт-в-байт под гейтом. Зависимости: `pnpm audit` 0 High/Critical.

## Охват и оговорки

- **Гейты ремедиации**: мои правки верифицированы изолированно (typecheck web/api/sandbox зелёно; тесты contracts/api/web зелёно; vite-трансформ 5461 модуля зелёно). Полный `pnpm typecheck`/`test`/`build` на момент прогона КРАСНЫЙ по причинам вне этой ремедиации: параллельная сессия ведёт работу над topic-схемой (`descriptions.ru`/concept-`titleEn`) и добавила untracked-топики. Красное: `packages/contracts/src/topic.schema.spec.ts` (`concepts[0]` без guard), `lesson-engine` `parse/browser.spec` (устаревшие `demo`-фикстуры), web-build на `topics/react-hooks/.../05-usememo-usecallback.ru.mdx` (двоеточие в YAML-`title` без кавычек). Эти файлы не входят в security-ремедиацию; их владелец, параллельная сессия.
- **Node**: локальная валидация выполнена под Node 20.20.2; рантайм-валидация под Node 22 уходит в CI/Docker-сборку (пины обновлены сквозняком: `.nvmrc`, engines, оба Dockerfile, `ci.yml`).
- Существенные изменения кода после прогона обесценивают заявление; перезапустите аудит.
