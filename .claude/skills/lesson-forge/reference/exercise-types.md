# Exercise types catalog

Only these `type` values are valid. Each maps to a runner in `packages/lesson-engine/src/runners/`. To introduce a new type, extend the schema, the runner, and this document **in a single PR** — never as a side effect of a content addition.

## `theory-quiz`

Multiple choice on a piece of theory. No code execution.

```yaml
- id: select-quiz-001
  concept: select
  type: theory-quiz
  difficulty: 1
  prompt: 'What does the SQL keyword SELECT do?'
  choices:
    - id: a
      text: 'Removes rows from a table.'
    - id: b
      text: 'Retrieves rows from a table.'
    - id: c
      text: 'Creates a new table.'
  correct: [b]
  explanation: 'SELECT is the read operation.'
```

**Required for every quiz and every variant:** choice lengths must be balanced (next subsection). A correct option that is a long explanation next to short distractors is a content bug, not a style preference.

### Choice length balance (anti-cheat) - mandatory

Learners must not be able to pick the right answer by length alone. Soft-lint (`pnpm validate --lint`) flags length-biased quizzes; for new/regenerated topics treat those warnings as blocking.

Thresholds (implemented in `packages/lesson-engine/src/cli/soft-lint.ts`):

| Check | Limit |
| ----- | ----- |
| longest correct / longest wrong | ≤ **1.3** |
| if correct is uniquely the longest: longest correct / average wrong | ≤ **1.45** |

Rules:

1. **Similar length.** All `choices[].text` in one quiz (and each variant) should sit in roughly the same band.
2. **Put detail in `explanation`, not in the correct choice.** A short accurate correct option + a rich explanation beats a paragraph-long correct option next to one-line distractors.
3. **Expand wrong options with plausible misconceptions**, not filler. Wrong answers should sound like real student mistakes at the same level of detail as the correct one.
4. **Never pad with fluff** just to match length - write a real alternative claim.
5. **Apply per language and per variant.** Balancing only the base quiz or only `ru` is not enough.
6. **Authoring check.** Before leaving the quiz, cover the `correct` ids and ask: "Is the longest option obviously right?" If yes, rewrite.

Bad (correct is uniquely longest and ~2× average wrong):

```yaml
choices:
  - id: a
    text: 'Чем плотнее таблица, тем больше коллизий и длиннее проба; запас держит среднее время поиска близким к O(1).'
  - id: b
    text: 'Свободные бакеты ускоряют сортировку ключей.'
  - id: c
    text: 'Это требование стандарта, без практического смысла.'
  - id: d
    text: 'Чтобы можно было хранить значения None.'
correct: [a]
```

Good (lengths close; detail lives in explanation):

```yaml
choices:
  - id: a
    text: 'Запас снижает коллизии и длину проб, держа поиск около O(1).'
  - id: b
    text: 'Свободные бакеты нужны, чтобы быстрее сортировать ключи.'
  - id: c
    text: 'Это формальное требование стандарта без пользы на практике.'
  - id: d
    text: 'Запас нужен, чтобы словарь мог хранить значения None.'
correct: [a]
explanation: 'При open addressing высокий load factor резко удлиняет пробы; таблица растёт заранее.'
```

## `sql-query`

Learner writes SQL. Runner executes against `fixture`, compares result-set to `expected`.

```yaml
- id: select-basic-001
  concept: select
  type: sql-query
  difficulty: 1
  prompt: 'Return users older than 18, sorted by name.'
  fixture: |
    CREATE TABLE users(id INT, name TEXT, age INT);
    INSERT INTO users VALUES (1, 'Anna', 25), (2, 'Bob', 17), (3, 'Eva', 30);
  expected:
    kind: result-set
    ordered: true
    rows:
      - { id: 1, name: 'Anna', age: 25 }
      - { id: 3, name: 'Eva', age: 30 }
  hints:
    - 'Use WHERE for filtering.'
    - 'Use ORDER BY for sorting.'
  solution: |
    SELECT * FROM users WHERE age > 18 ORDER BY name;
```

When `ordered: false`, the runner sorts both sides before comparing.

## `python-function`

Learner writes a Python function with a known signature. Runner imports it and runs the listed `cases`.

```yaml
- id: pyoop-init-001
  concept: classes
  type: python-function
  difficulty: 2
  prompt: 'Implement `class Vector` with `.length()` returning Euclidean length.'
  starter: |
    class Vector:
        def __init__(self, x: float, y: float):
            ...
        def length(self) -> float:
            ...
  cases:
    - call: 'Vector(3, 4).length()'
      expect: 5.0
    - call: 'Vector(0, 0).length()'
      expect: 0.0
    - call: 'Vector(1, 1).length()'
      expect_approx: 1.4142135
  solution: |
    class Vector:
        def __init__(self, x, y):
            self.x = x
            self.y = y
        def length(self):
            return (self.x ** 2 + self.y ** 2) ** 0.5
```

## `javascript-function`

Same shape as `python-function`, JavaScript variant.

## `fill-in-blanks`

Code with placeholders the learner fills in. Per-blank validation.

```yaml
- id: select-blanks-001
  concept: select
  type: fill-in-blanks
  difficulty: 1
  prompt: 'Complete the query.'
  template: |
    SELECT {{col}} FROM users WHERE {{cond}};
  blanks:
    col:
      accept: ['*', 'id, name, age']
    cond:
      accept_regex: '^age\s*>\s*18$'
```

Placeholders are **double-curly** `{{name}}` (not `${...}`). The player parses them with `/\{\{([a-zA-Z0-9_-]+)\}\}/g` and renders one input per placeholder, so every `{{name}}` in `template` must have a matching key under `blanks`.

## `predict-output`

Learner predicts what a snippet outputs.

```yaml
- id: select-predict-001
  concept: select
  type: predict-output
  difficulty: 2
  prompt: 'What does the following query return?'
  snippet: |
    SELECT COUNT(*) FROM users WHERE age > 100;
  fixture: |
    CREATE TABLE users(age INT);
    INSERT INTO users VALUES (25), (30);
  expected:
    kind: scalar
    value: 0
```

## `git-challenge`

Learner reaches a target repository state by typing real git commands into an in-browser terminal. The challenge runs entirely in a deterministic JavaScript git engine (no backend, no real git): the topic `runtime` must be `git`.

Shape:

- `setup` (optional): the starting repository state. `setup.files` seeds the worktree (path → contents); `setup.commands` is an ordered list of git/shell commands the engine replays to build history before the learner starts. Supported shell verbs: `git`, `echo`, `cat`, `ls`, `rm`, `touch`, `mkdir`, `pwd`, plus `>`/`>>` redirection. Supported git subcommands include `init`, `config`, `add`, `rm`, `status`, `commit`, `log`, `diff`, `branch`, `checkout`, `switch`, `merge`, `reset`, `revert`, `restore`, `stash`, `cherry-pick`, `rebase`, `tag`, `reflog`, `remote`, `fetch`, `pull`, `push`.
- `goal` (required, min 1): assertions checked against the resulting repository. The challenge passes only when every assertion holds. Available `kind`s: `commit-count`, `file-content`, `file-tracked`, `file-absent`, `staged`, `branch-exists`, `branch-absent`, `head-on-branch`, `head-detached`, `head-at`, `clean-tree`, `merged`, `commit-message`, `tag-exists`.
- `solution` (required, min 1): an ordered list of git command strings that satisfies every goal. `pnpm validate` replays this solution in the engine and fails the build if the goals are not met, so the gold solution is verified on every run.

Goal field reference (only the fields each kind reads are honored):

- `commit-count` → `ref` (default `HEAD`), `equals`
- `file-content` → `path`, `equals`, `where` (`worktree` | `head`, default `worktree`)
- `file-tracked` / `staged` → `path`
- `file-absent` → `path`, `where` (default `worktree`)
- `branch-exists` / `branch-absent` / `head-on-branch` / `tag-exists` → `name`
- `head-detached` / `clean-tree` → no extra fields
- `head-at` → `ref`
- `merged` → `branch`, `into` (default `HEAD`)
- `commit-message` → `ref` (default `HEAD`), `index` (default `0`, counts back from `ref`), `contains`

```yaml
- id: stage-and-commit-001
  concept: staging
  type: git-challenge
  difficulty: 1
  prompt: 'Создайте коммит с файлом notes.txt и сообщением «add notes».'
  setup:
    files:
      notes.txt: "first line\n"
    commands:
      - git init
      - git config user.name learner
  goal:
    - { kind: file-tracked, path: notes.txt }
    - { kind: commit-count, equals: 1 }
    - { kind: commit-message, contains: 'add notes' }
    - { kind: clean-tree }
  solution:
    - git add notes.txt
    - git commit -m "add notes"
```

## Variants (randomized practice)

Every exercise type accepts an optional `variants` array. Each variant is a **full alternative version of the same task**: same skill being tested, different surface (different data, different prompt, different expected answer). The runner picks a random variant per attempt and offers «другой вариант» after a pass, so learners internalize the principle instead of memorizing the answer.

Rules:

- The base exercise fields are variant 0; `variants` adds more.
- A variant must redefine the **core task fields** of its type (`choices`+`correct` for theory-quiz, `expected`+`solution` for sql-query, `cases`+`solution` for functions, `template`+`blanks` for fill-in-blanks, `snippet`+`expected` for predict-output, `goal`+`solution` for git-challenge). `prompt`, `fixture`, `starter`, `setup` are optional overrides - omit them to inherit from the base.
- A variant that differs only in wording is useless; vary the data or the target so the correct answer actually changes.
- Translations of an exercise must define the **same number of variants in the same order** (the validator enforces parity).
- Gold solutions of every sql-query variant are executed by `pnpm validate`; variant solutions for other runtimes follow the same manual verification rule as the base (see G6).
- Target: **difficulty 1-2 exercises ship >=2 variants (ideally 3)**; higher difficulties ship variants when the task lends itself to parametrization.

```yaml
- id: count-rows-001
  concept: aggregation
  type: sql-query
  difficulty: 1
  prompt: 'Посчитайте количество заказов.'
  fixture: |
    CREATE TABLE orders(id INT, amount INT);
    INSERT INTO orders VALUES (1, 100), (2, 250), (3, 90);
  expected: { kind: scalar, value: 3 }
  solution: SELECT COUNT(*) FROM orders;
  variants:
    - prompt: 'Посчитайте количество заказов дороже 100.'
      expected: { kind: scalar, value: 1 }
      solution: SELECT COUNT(*) FROM orders WHERE amount > 100;
    - prompt: 'Посчитайте сумму всех заказов.'
      expected: { kind: scalar, value: 440 }
      solution: SELECT SUM(amount) FROM orders;
```

For `theory-quiz`, the runner additionally shuffles choice order on every render, so never write prompts that reference choice position («первый вариант ответа»).

## Hints quality bar

Hints teach the mental model, not the syntax. Ladder them:

1. **Hint 1 - reorientation.** Restate what the task is really asking in terms of the concept's mental model. No syntax. Bad: «Используйте WHERE». Good: «WHERE отбрасывает строки до того, как SELECT их увидит - какие строки должны выжить?»
2. **Hint 2 - strategy.** Decompose: which clauses/methods in which order, what intermediate result to check.
3. **Hint 3 (optional) - concrete pointer.** A specific function or clause name, still not the answer.

Never paste the solution or a near-solution into a hint. Exercises at difficulty >=3 must ship at least 2 hints.

## Difficulty calibration

- **1** — trivial, single concept application, one operator
- **2** — combines two operators or one with a subtle edge case
- **3** — multi-step, requires planning
- **4** — non-obvious, requires understanding a less-common feature
- **5** — challenge problem, may have multiple valid solutions

Each concept should ship at least one exercise at difficulty 1 and one at difficulty ≥3; each topic should ship at least one difficulty 4-5 challenge.
