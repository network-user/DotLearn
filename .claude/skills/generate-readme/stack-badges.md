# Бейджи - shields.io

Два разных места, две роли.

| Место | Стиль | Кол-во |
|-------|-------|--------|
| Под `# {brand}` | flat (без `for-the-badge`) | 3: Runtime, Platform, Category |
| `## Стек` | только `<img>` for-the-badge, один визуальный стиль | все ключевые технологии из репо (обычно 6-12) |

Только технологии, реально присутствующие в `dependencies` / `docker` / CI / dev deps секции «Стек». Не декор.

## Header (3-4 flat)

| Бейдж | Откуда брать | Пример значения |
|-------|--------------|-----------------|
| Runtime | `engines`, `.nvmrc`, `pyproject`, `go.mod` | `Node.js-20%2B`, `Python-3.12` |
| Platform | где работает | `Web`, `Windows%20%7C%20Linux%20%7C%20macOS`, `Docker`, `Telegram` |
| Category | тип проекта | `Learning`, `Bot`, `CLI`, `API` |

```markdown
![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933)
![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20Docker-lightgrey)
![Category](https://img.shields.io/badge/Category-Learning-orange)

<img src="docs/cover.svg" width="720" alt="DotLearn">

<!-- loc:start --><img src="https://img.shields.io/badge/lines_of_code-211875-lightgrey?style=flat" alt="211875 lines of code" /><!-- loc:end -->
```

## Lines of code (под cover)

**Не** в строке header-бейджей. Сразу **после** cover (`<img>` или inline `<svg>`), **перед** intro-абзацем.

| Источник | `code-counter` → `TOTAL`, без запятых в URL |
| Маркеры | `<!-- loc:start -->` … `<!-- loc:end -->` |
| Формат | `<img src=".../lines_of_code-{N}-lightgrey?style=flat">` |

LoC-бейдж - **`<img>`**, не `![]()`. Label: `lines_of_code`. Цвет: `lightgrey`.

---

## `## Стек` - единый формат (важно)

**Запрещено смешивать:** картинки-бейджи + plain-текст `Git · setuptools · mypy` в одной секции. Выглядит рвано.

**Правило:** каждая технология в стеке - **отдельный** `<img>` с `style=for-the-badge`. Одинаковый размер для всех.

- Есть logo в Simple Icons → добавь `logo=` и `logoColor=` (см. таблицу).
- Нет logo → тот же `style=for-the-badge`, **без** `logo=`, нейтральный цвет (`555555`, `2d3748`).
- Dev-only (pytest, ruff, mypy) - тоже бейджи, можно суффикс в label: `mypy_(dev)` или отдельный цвет `4A5568`.
- Больше ~8-10 в одной строке → **вторая строка** `<img>`, не plain-text.
- Без `<p align="center">`.

```markdown
## Стек

<img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
<img src="https://img.shields.io/badge/pytest-0A9EDC?style=for-the-badge&logo=pytest&logoColor=white" alt="pytest" />
<img src="https://img.shields.io/badge/ruff-D7FF64?style=for-the-badge&logo=ruff&logoColor=black" alt="ruff" />
<img src="https://img.shields.io/badge/Git-F05032?style=for-the-badge&logo=git&logoColor=white" alt="Git" />
<img src="https://img.shields.io/badge/setuptools-555555?style=for-the-badge" alt="setuptools" />
<img src="https://img.shields.io/badge/mypy-2C5282?style=for-the-badge" alt="mypy" />
```

Markdown `![]()` допустим, но **`<img>` предпочтительнее** - как в header и LoC.

---

## logo-map (Simple Icons → `logo=`)

| Технология | logo= | Цвет |
|------------|-------|------|
| TypeScript | `typescript` | `3178C6` |
| JavaScript | `javascript` | `F7DF1E` |
| Node.js | `nodedotjs` | `339933` |
| Python | `python` | `3776AB` |
| Git | `git` | `F05032` |
| pytest | `pytest` | `0A9EDC` |
| ruff | `ruff` | `D7FF64` |
| React | `react` | `20232A` |
| Vue | `vuedotjs` | `4FC08D` |
| Astro | `astro` | `BC52EE` |
| Vite | `vite` | `646CFF` |
| Next.js | `nextdotjs` | `000000` |
| NestJS | `nestjs` | `E0234E` |
| FastAPI | `fastapi` | `009688` |
| Django | `django` | `092E20` |
| Docker | `docker` | `2496ED` |
| PostgreSQL | `postgresql` | `4169E1` |
| Redis | `redis` | `DC382D` |
| SQLite | `sqlite` | `003B57` |
| Elasticsearch | `elasticsearch` | `005571` |
| Turborepo | `turborepo` | `EF4444` |
| pnpm | `pnpm` | `F69220` |
| npm | `npm` | `CB3837` |
| GitHub Actions | `githubactions` | `2088FF` |
| Cloudflare | `cloudflare` | `F38020` |
| Telegram / aiogram | `telegram` | `26A5E4` |
| Rust | `rust` | `000000` |
| Go | `go` | `00ADD8` |
| Tailwind CSS | `tailwindcss` | `06B6D4` |
| Monaco / VS Code | `visualstudiocode` | `007ACC` |
| Kubernetes | `kubernetes` | `326CE5` |
| Nginx | `nginx` | `009639` |
| Celery | `celery` | `37814A` |
| RabbitMQ | `rabbitmq` | `FF6600` |
| Kafka | `apachekafka` | `231F20` |
| PyTorch | `pytorch` | `EE4C2C` |
| OpenAI | `openai` | `412991` |

### Без logo в Simple Icons

Тот же `style=for-the-badge`, neutral цвет:

```markdown
<img src="https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge" alt="Zod" />
<img src="https://img.shields.io/badge/setuptools-555555?style=for-the-badge" alt="setuptools" />
<img src="https://img.shields.io/badge/mypy-2C5282?style=for-the-badge" alt="mypy" />
<img src="https://img.shields.io/badge/sql.js-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="sql.js" />
```

Подчёркивание в label = пробел: `TanStack_Router`.

## Порядок

1. Язык / runtime · 2. UI / framework · 3. build / tooling · 4. backend / data · 5. infra · 6. dev (pytest, ruff…).

## Чеклист

- [ ] В `## Стек` **только** for-the-badge `<img>`, без plain-строки через `·`.
- [ ] Каждый бейдж = реальная зависимость.
- [ ] `for-the-badge` только в `## Стек`; header flat (3-4 шт.).
- [ ] LoC в маркерах, обновлён через `code-counter`.
- [ ] Нет centered `<p>`.
