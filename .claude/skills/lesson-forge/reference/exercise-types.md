# Exercise types catalog

Only these `type` values are valid. Each maps to a runner in `packages/lesson-engine/src/runners/`. To introduce a new type, extend the schema, the runner, and this document **in a single PR** — never as a side effect of a content addition.

## `theory-quiz`

Multiple choice on a piece of theory. No code execution.

```yaml
- id: select-quiz-001
  concept: select
  type: theory-quiz
  difficulty: 1
  prompt: "What does the SQL keyword SELECT do?"
  choices:
    - id: a
      text: "Removes rows from a table."
    - id: b
      text: "Retrieves rows from a table."
    - id: c
      text: "Creates a new table."
  correct: [b]
  explanation: "SELECT is the read operation."
```

## `sql-query`

Learner writes SQL. Runner executes against `fixture`, compares result-set to `expected`.

```yaml
- id: select-basic-001
  concept: select
  type: sql-query
  difficulty: 1
  prompt: "Return users older than 18, sorted by name."
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
    - "Use WHERE for filtering."
    - "Use ORDER BY for sorting."
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
  prompt: "Implement `class Vector` with `.length()` returning Euclidean length."
  starter: |
    class Vector:
        def __init__(self, x: float, y: float):
            ...
        def length(self) -> float:
            ...
  cases:
    - call: "Vector(3, 4).length()"
      expect: 5.0
    - call: "Vector(0, 0).length()"
      expect: 0.0
    - call: "Vector(1, 1).length()"
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
  prompt: "Complete the query."
  template: |
    SELECT ${col} FROM users WHERE ${cond};
  blanks:
    col:
      accept: ["*", "id, name, age"]
    cond:
      accept_regex: '^age\s*>\s*18$'
```

## `predict-output`

Learner predicts what a snippet outputs.

```yaml
- id: select-predict-001
  concept: select
  type: predict-output
  difficulty: 2
  prompt: "What does the following query return?"
  snippet: |
    SELECT COUNT(*) FROM users WHERE age > 100;
  fixture: |
    CREATE TABLE users(age INT);
    INSERT INTO users VALUES (25), (30);
  expected:
    kind: scalar
    value: 0
```

## Difficulty calibration

- **1** — trivial, single concept application, one operator
- **2** — combines two operators or one with a subtle edge case
- **3** — multi-step, requires planning
- **4** — non-obvious, requires understanding a less-common feature
- **5** — challenge problem, may have multiple valid solutions

Each concept should ship at least one exercise at difficulty 1 and one at difficulty ≥3.
