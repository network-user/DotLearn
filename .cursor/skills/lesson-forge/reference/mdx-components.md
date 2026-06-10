# MDX component catalog

Every component listed here is registered in the theory MDX scope (`apps/web/src/components/TheoryContent.tsx`). Use them without imports. All components are theme-aware (light/dark) and responsive; never pass raw hex colors.

## Figures

### Figure

Wrapper for any visual. Auto-numbers («Рис. N» / "Fig. N") in reading order and renders a captioned frame.

```mdx
<Figure caption="Строки, не прошедшие WHERE, не доходят до SELECT.">
  <RowFilterFigure
    columns={["name", "age"]}
    rows={[
      { cells: ["Ana", "34"], kept: true },
      { cells: ["Boris", "17"], kept: false },
      { cells: ["Vera", "29"], kept: true },
    ]}
    condition="age >= 18"
    title="Фильтрация строк"
  />
</Figure>
```

Props: `caption?: ReactNode`, `id?: string`, `wide?: boolean` (breaks out of the prose column on large screens; content scrolls horizontally if needed).

### Prebuilt illustrations

All accept `title` (accessible label). Wrap each in `<Figure>`.

| Component | Use for | Key props |
|---|---|---|
| `PipelineFigure` | SQL logical execution order, any staged process | `stages: { label, note?, active? }[]` |
| `RowFilterFigure` | WHERE / projection: rows in, kept rows out | `columns: string[]`, `rows: { cells: string[], kept: boolean }[]`, `condition?` |
| `SortLimitFigure` | ORDER BY + LIMIT | `items: { label, value }[]`, `limit?`, `desc?`, `orderLabel?` |
| `NestedQueryFigure` | Subquery evaluation order | `outerLabel`, `innerLabel`, `innerResult`, `resultLabel`, `footnote?` |
| `ObjectMemoryFigure` | Names pointing to objects, instance attrs | `objects: { name, className, attrs: Record<string,string> }[]`, `sharedName?` |
| `MroFigure` | Attribute lookup along the MRO chain | `chain: string[]`, `lookup?`, `foundIn?`, `startLabel?` |

Example:

```mdx
<Figure caption="Поиск метода идёт слева направо и останавливается на первом совпадении.">
  <MroFigure chain={["Dog", "Animal", "object"]} lookup="speak()" foundIn="Animal" title="MRO" />
</Figure>
```

### Custom sketches

When no prebuilt fits, compose from primitives inside `Sketch` (SVG shell with arrow markers and hatch pattern):

```mdx
<Figure caption="Композиция: хост делегирует части.">
  <Sketch viewBox="0 0 400 160" title="Композиция">
    <SketchBox x={20} y={40} width={120} height={80} fill="rgb(var(--surface-2))" />
    <SketchLabel x={80} y={85} mono>Order</SketchLabel>
    <SketchBox x={260} y={55} width={110} height={50} accent />
    <SketchLabel x={315} y={85} mono accent>Cart</SketchLabel>
    <SketchArrow from={[145, 80]} to={[255, 80]} accent />
    <SketchHighlight x={255} y={50} width={120} height={60} />
  </Sketch>
</Figure>
```

Primitives: `SketchBox` (`x,y,width,height, fill?, hatched?, accent?, dashed?, radius?`), `SketchLabel` (`x,y, size?, mono?, muted?, accent?, anchor?, weight?`), `SketchArrow` (`from:[x,y], to:[x,y], curve?, dashed?, accent?`), `SketchHighlight` (`x,y,width,height`).

## Charts

Hand-rolled SVG, zero dependencies. Wrap in `<Figure>` when they deserve a caption.

```mdx
<Figure caption="COUNT по странам: две страны дают 80% строк.">
  <BarChart
    title="Пользователи по странам"
    data={[
      { label: "RU", value: 420 },
      { label: "DE", value: 180 },
      { label: "JP", value: 95 },
    ]}
    highlight={["RU", "DE"]}
  />
</Figure>
```

| Component | Props |
|---|---|
| `BarChart` | `data: { label, value }[]`, `unit?`, `highlight?: string[]`, `colorByCategory?` |
| `LineChart` | `series: { name, points: { x, y }[] }[]`, `xLabel?`, `yLabel?`, `area?`, `stacked?` |
| `AreaChart` | same as LineChart minus `area` (always filled), plus `stacked?` |
| `DistributionChart` | `values: number[]`, `bins?`, `xLabel?`, `markers?: { value, label }[]` — histogram; markers for AVG/median lines |

## Live sandboxes

### SideSql — SQL, runs in the page

```mdx
<SideSql
  title="Попробуй сам"
  editable
  live
  fixture={`CREATE TABLE users (id INT, name TEXT, age INT);
INSERT INTO users VALUES (1,'Ana',34),(2,'Boris',17),(3,'Vera',29);`}
  query="SELECT name FROM users WHERE age >= 18;"
/>
```

Props: `fixture` (DDL+inserts), `query?`, `title?`, `autoRun?` (default true), `editable?`, `live?` (debounced run-as-you-type; implies editable), `chart?: { type: 'bar' | 'line', x: '<column>', y: '<column>' }` (plots the result set under the grid — great for aggregation topics). With no `query`, renders the fixture schema browser.

In theory, prefer `editable live` and pose a "поменяй условие и посмотри" challenge in prose.

### PyDemo — Python (pyodide), explicit run

```mdx
<PyDemo
  title="Счётчик"
  code={`class Counter:
    def __init__(self, start=0):
        self.value = start

    def tick(self):
        self.value += 1

c = Counter(10)
c.tick()
print(c.value)`}
/>
```

Props: `code`, `title?`, `call?` (final expression shown as `→ value`), `autoRun?` (default false — pyodide is heavy, leave it off), `chart?: { type: 'bar' | 'line', label? }` (plots a returned list of numbers or `[label, number]` pairs from `call`). The editor shows a "modified, run again" hint automatically.

### PyStepper

Step-through visualization of Python execution: `code`, `title?`, `speed?`.

## Prose devices

| Component | Use | Example |
|---|---|---|
| `Callout` | Short note in flow; `type: "info" \| "warning" \| "success" \| "tip"`, `title?` | `<Callout type="warning">NULL не равен ничему, даже себе.</Callout>` |
| `Detail` | Collapsible deep-dive; `summary`, `defaultOpen?` | `<Detail summary="Как это устроено внутри">...</Detail>` |
| `Steps` | Numbered procedure | `<Steps><li>...</li><li>...</li></Steps>` |
| `KeyTakeaways` | End-of-article résumé; `items: string[]`, `title?` | `<KeyTakeaways items={["...", "..."]} />` |
| `MarginNote` | Side comment floated to the margin on wide screens; `label?` | `<MarginNote label="История">SQL появился в 1974.</MarginNote>` |
| `PullQuote` | One striking sentence, max once per article; `attribution?` | `<PullQuote>Таблица - это множество, пока вы не попросите порядок.</PullQuote>` |
| `Ref` + `Footnotes` | Numbered footnotes | `...формы<Ref id="codd" /> ... <Footnotes notes={[{ id: "codd", text: "Codd, 1970." }]} />` |
| `Compare` | Two-column comparison, stacks on mobile; `leftTitle`, `rightTitle`, `left`, `right`, `verdict?` | `<Compare leftTitle="Наследование" rightTitle="Композиция" left={...} right={...} verdict="..." />` |
| `SideViz` | Legacy floated panel; prefer `MarginNote` or `Figure` | — |

## Domain visualizations

Interactive teaching components with their own internal state; use where the domain matches. `ClassFactory`, `InheritanceTree`, `AccessScope`, `AggregateViz`, `GroupByViz`, `JoinViz`, `CompositionViz` — see existing topics for prop shapes (`topics/python-oop/theory/*.mdx`, `topics/sql-fundamentals/theory/*.mdx`).

## Rules

- Never put a figure or sandbox inside a `Callout`/`Detail` unless it is genuinely optional material.
- All user-visible strings inside component props must be in the language of the file.
- Tables and wide figures must remain usable at 375px (Figure handles horizontal scroll; don't fight it with fixed widths).
- Alternate visuals with prose; never stack two figures back-to-back without text between them.
