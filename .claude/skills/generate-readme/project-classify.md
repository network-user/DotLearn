# Классификация проекта

Перед записью README и правил агента определи профиль репозитория. Классификация влияет на опциональные секции README и акценты в `AGENTS.md`, но **не меняет** DotCore-брендинг, обложку, LoC и тон internal doc.

## Три оси (запиши в черновик Scan)

### 1. Тип (`project_type`)

| Тип             | Сигналы в репо                             | README: опционально                                | AGENTS.md: акцент                       |
| --------------- | ------------------------------------------ | -------------------------------------------------- | --------------------------------------- |
| `learning`      | темы, уроки, `topics/`, учебный UX         | `## Что внутри` с числами                          | как добавлять контент, структура тем    |
| `web-app`       | `apps/web`, SPA, `vite.config`, UI deps    | `## Что внутри` если UX-богатый                    | dev-сервер, порты, env                  |
| `full-stack`    | `apps/api` + frontend, monorepo            | оба блока при наличии                              | API + web setup, shared packages        |
| `bot`           | Telegram/Discord, `aiogram`, handlers      | `## Что внутри` если есть UX-команды               | deploy, токены (имена env, не значения) |
| `cli`           | `bin/`, `commander`, `argparse`, `main.ts` | без `## Что внутри`                                | options table, примеры вызова           |
| `library`       | `exports`, `pyproject` package, npm lib    | API overview в `## Запуск` или отдельный `### API` | public API, publish, versioning         |
| `monorepo-tool` | turbo/nx, много `packages/`                | архитектура обязательна                            | filter-команды, workspace layout        |
| `infra`         | terraform, k8s, только CI/Docker           | минимум features                                   | deploy, environments                    |

Если тип неочевиден - выбери ближайший и зафиксируй в `AGENTS.md` в блоке «Профиль проекта».

### 2. Аудитория (`audience`)

| Значение    | Когда                                  | Влияние                                                                                  |
| ----------- | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `internal`  | личные / DotCore / без OSS-целей       | README на русском, без star-hunting тона                                                 |
| `oss`       | публичный GitHub, issues, contributors | README + `CONTRIBUTING` только если уже есть; AGENTS.md - чёткие test/lint               |
| `portfolio` | карточка на DotBioSite                 | после README обнови `docs/portfolio-draft.md` (см. [project-rules.md](project-rules.md)) |

### 3. Дистрибуция (`distribution`)

| Значение       | Сигналы               | README                             |
| -------------- | --------------------- | ---------------------------------- |
| `github`       | remote на github.com  | cover → `docs/cover.svg` + `<img>` |
| `local-only`   | нет remote / приватно | inline `<svg>` допустим            |
| `npm` / `pypi` | publish в манифесте   | install из registry в `## Запуск`  |
| `docker`       | `Dockerfile`, compose | `### Docker` с реальными командами |
| `telegram`     | bot token env         | Platform badge `Telegram`          |

## Среда просмотра README → cover mode

**Дефолт - `file` (GitHub-first).** README обычно попадает на GitHub, где inline `<svg>` вырезается. Поэтому по умолчанию `docs/cover.svg` + `<img>` - даже если git remote ещё нет.

| Условие                                                                   | Cover mode                          |
| ------------------------------------------------------------------------- | ----------------------------------- |
| `distribution=github`, есть `origin`, или remote ещё не настроен (дефолт) | `file` → `docs/cover.svg`           |
| пользователь явно сказал «только IDE, GitHub не будет»                    | `inline`                            |
| есть `docs/preview.png`                                                   | `preview` → не перегенерировать SVG |

## Быстрый черновик (для агента)

После Scan заполни (не публикуй отдельным файлом, используй при Write):

```
project_type: ...
audience: ...
distribution: ...
cover_mode: file | inline | preview
primary_runtime: ...
has_tests: yes | no
has_docker: yes | no
monorepo: yes | no
```

## Чеклист классификации

- [ ] Тип выведен из структуры репо, не из названия папки.
- [ ] Cover mode согласован с `distribution` и remote.
- [ ] `## Что внутри` только если тип и UX это оправдывают.
- [ ] Для `library`/`cli` нет маркетинговых feature-буллетов.
