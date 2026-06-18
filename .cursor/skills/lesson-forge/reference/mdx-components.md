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

## Theory-viz components by topic

These are the interactive teaching visualizations added for the decorators, object-detection (YOLO), LLM-internals, and prompt-engineering topics. They are registered in the MDX scope — use them by tag name, no import. All accept Russian-defaulted text and render fully with no props (defaults shown in each entry). All are responsive to 375px; wide content scrolls inside `overflow-x-auto`. Most expose play/step/reset or slider/nudge/toggle controls and are **not** wrapped in the zoom lightbox (so their controls stay live); the only static figure here, `TokenizerViz`, is zoomable like the other figures.

### Decorators

#### DecoratorWrap

Animates how a decorator wraps a plain function: nested boxes (outer wrapper around the inner function), a call token entering the wrapper, the before-hook firing, control flowing into the original function and back, the after-hook firing, then the result returning outward. Play/step/reset controls; each stage gets a Russian caption explaining what runs. Use it to teach the order of before/after side effects around the wrapped call.

Props: `decoratorName?: string` (default `'timed'`, shown after `@`); `funcName?: string` (default `'compute'`, wrapped function name); `before?: string` (default `'start = time()'`, code label for the before hook); `after?: string` (default `'log(time() - start)'`, code label for the after hook); `label?: string` (header override); `callExpression?: string` (default `` `${funcName}(x)` ``, text on the incoming call token).

```mdx
<DecoratorWrap decoratorName="timed" funcName="compute" before="start = time()" after="log(time() - start)" />
```

#### CallStackViz

Visualizes the call stack growing and shrinking as stacked decorators nest around a single call. Frames push on (top-down: outer decorator first) until the innermost function body is reached at the peak, then pop off as each returns. Includes a depth gauge, a per-frame legend, play/step/reset controls, and Russian stage captions describing push/peak/pop. Makes decorator nesting order and LIFO unwinding concrete.

Props: `frames?: string[]` (default `['@auth', '@cache', '@log']`, ordered frame labels, outermost first); `innerLabel?: string` (default `'handler()'`, the innermost wrapped-body frame at the peak); `label?: string` (header override).

```mdx
<CallStackViz frames={['@auth', '@cache', '@log']} innerLabel="handler()" />
```

### Object detection (YOLO)

#### IoUViz

Two bounding boxes on an SVG canvas; shades the intersection and reports the IoU value (intersection / union). The prediction box is nudgeable via touch-friendly arrow controls so learners see IoU change live; the IoU readout color reflects quality (>= 0.5 green, >= 0.25 amber, else red).

Props: `label?: string`; `boxA?: BoxRect`; `boxB?: BoxRect` where `BoxRect = { x, y, w, h }` in a 320x220 viewport; plus Russian-defaulted text props `boxALabel`, `boxBLabel`, `intersectionLabel`, `unionLabel`, `iouLabel`, `nudgeLabel`, `resetLabel`, `hintLabel`.

```mdx
<IoUViz boxA={{ x: 36, y: 44, w: 150, h: 120 }} boxB={{ x: 120, y: 86, w: 150, h: 110 }} />
```

#### AnchorGridViz

An image area split into an SxS grid with anchor boxes overlaid. Highlights the responsible cell (the one containing the object center) and marks the best-IoU anchor for the target object. Anchors can be toggled on/off.

Props: `label?: string`; `grid?: number` (S, clamped 2..12); `anchors?: AnchorShape[]` where `AnchorShape = { w, h }` normalized 0..1; `object?: AnchorObjectBox` where the box is `{ cx, cy, w, h }` normalized 0..1; plus Russian-defaulted text props `objectLabel`, `cellLabel`, `anchorsTitle`, `showAnchorsLabel`, `hideAnchorsLabel`, `hintLabel`.

```mdx
<AnchorGridViz grid={5} anchors={[{ w: 0.85, h: 0.35 }, { w: 0.4, h: 0.85 }, { w: 0.6, h: 0.6 }]} object={{ cx: 0.62, cy: 0.46, w: 0.34, h: 0.5 }} />
```

#### NmsViz

Several overlapping candidate boxes with confidence scores. Steps through non-maximum suppression: each step keeps the highest-scoring remaining box and suppresses candidates whose IoU with it exceeds the threshold. A side list mirrors box states (kept / suppressed / candidate); captions explain each step. Fully steppable (no autoplay) so touch users get a usable view.

Props: `label?: string`; `boxes?: NmsBox[]` where `NmsBox = { x, y, w, h, score }` in a 320x220 viewport; `iouThreshold?: number`; plus Russian-defaulted text props `stepLabel`, `resetLabel`, `keptLabel`, `suppressedLabel`, `candidateLabel`, `thresholdLabel`, `introHint`, `doneHint`.

```mdx
<NmsViz iouThreshold={0.45} boxes={[{ x: 40, y: 40, w: 130, h: 120, score: 0.92 }, { x: 58, y: 58, w: 130, h: 118, score: 0.81 }, { x: 180, y: 70, w: 110, h: 110, score: 0.88 }]} />
```

#### PrCurve

A precision-recall curve plotted on an SVG axis with the area under it (Average Precision) shaded and printed. A toggle switches between the raw curve and the standard right-max-interpolated curve so learners see how AP is computed.

Props: `label?: string`; `points?: PrPoint[]` where `PrPoint = [recall, precision]`, each 0..1; plus Russian-defaulted text props `apLabel`, `recallLabel`, `precisionLabel`, `interpolateLabel`, `rawLabel`, `hintLabel`.

```mdx
<PrCurve points={[[0, 1], [0.2, 0.92], [0.4, 0.86], [0.6, 0.78], [0.8, 0.55], [1, 0.3]]} />
```

### LLM internals

#### TokenizerViz

Splits Russian input text into BPE-style token chips, each showing the sub-word piece (spaces rendered as middle-dots) and a synthetic vocab id, with a live token + character count in the footer. Chips animate in on mount. This is the one static figure in this group, so it is zoomable.

Props: `text?: string` (default Russian sentence); `tokens?: string[]` (override the split; ids are derived from each piece); `label?`, `countLabel?`, `charLabel?: string` (Russian UI defaults).

```mdx
<TokenizerViz text="Привет, мир! Это токены." />
```

#### AttentionHeatmap

Renders a tokens x tokens attention matrix as a cyan-intensity heatmap. Each row is softmax-normalized to sum to 1; hovering, focusing, or tapping a cell reads out the query->key weight in the footer. Synthesizes a causal (lower-triangular, recency-biased) matrix when no weights are supplied.

Props: `tokens?: string[]` (default 5 Russian tokens); `weights?: number[][]` (square matrix matching token count, rows auto-normalized; throws `AttentionShapeError` on mismatched dimensions); `label?`, `rowHint?`, `colHint?`, `emptyHint?: string`.

```mdx
<AttentionHeatmap tokens={["Кошка", "села", "на", "коврик"]} />
```

#### EmbeddingSpace

A 2D SVG scatter plot of words where semantically near words form colored clusters (auto-detected by distance). Points animate in; hover/focus/tap highlights a word, dims other clusters, and names the cluster in the footer.

Props: `points?: EmbeddingPoint[]` where `EmbeddingPoint = [x: number (0..1), y: number (0..1), label: string]` (default 12 Russian words in 3 clusters); `label?`, `emptyHint?: string`.

```mdx
<EmbeddingSpace points={[[0.2, 0.2, "король"], [0.25, 0.18, "королева"], [0.75, 0.2, "кошка"], [0.8, 0.26, "собака"]]} />
```

#### SamplingBars

Next-token probability bars that recompute live from a temperature slider, plus top-k and top-p (nucleus) sliders that visibly cut candidates (struck-through, greyed, labeled top-k / top-p) and renormalize the surviving mass. Footer reports kept count and nucleus mass.

Props: `candidates?: SamplingCandidate[]` where `SamplingCandidate = [token: string, logit: number]` (default 7 Russian candidates); `label?`, `temperatureLabel?`, `topKLabel?`, `topPLabel?: string`.

```mdx
<SamplingBars candidates={[["кофе", 3.2], ["чай", 2.7], ["воду", 2.1], ["сок", 1.4]]} />
```

#### ContextWindowViz

A fixed-size window sliding over a token stream. Step forward/back to move the window; tokens inside it are highlighted, tokens that scrolled past are dimmed and struck through (evicted), future tokens are faded. Footer tracks window size, evicted count, and position. Wide streams scroll inside `overflow-x-auto`.

Props: `tokens?: string[]` (default Russian story stream); `windowSize?: number` (default 8, clamped to token count); `label?`, `truncatedLabel?`, `contextLabel?`, `positionLabel?: string`.

```mdx
<ContextWindowViz windowSize={6} tokens={["раз", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять", "десять"]} />
```

#### AgentLoopDiagram

An animated circular agent loop (Думает -> Вызывает инструмент -> Наблюдает -> Повторяет -> Отвечает) laid out as SVG nodes joined by curved arrows. Play auto-advances around the cycle, Step advances once, the active node pulses, nodes are clickable, and the footer describes the current phase. Does not autoplay; honors prefers-reduced-motion.

Props: `steps?: AgentLoopStep[]` where `AgentLoopStep = { title: string; detail: string }` (default 5 Russian steps); `label?`, `playLabel?`, `pauseLabel?`, `stepLabel?`, `resetLabel?: string`.

```mdx
<AgentLoopDiagram />
```

#### McpDiagram

A Model Context Protocol diagram: a host/client box connected over a pulsing JSON-RPC link to a column of MCP servers, each tagged with the capabilities it exposes (Инструменты / Ресурсы / Промпты) with icons. Hover/focus/tap a server to read its description and light up the host link.

Props: `servers?: McpServer[]` where `McpServer = { name: string; capabilities: ('tools' | 'resources' | 'prompts')[]; detail?: string }` (default 3 Russian servers); `label?`, `hostLabel?`, `hostDetail?`, `emptyHint?: string`.

```mdx
<McpDiagram servers={[{ name: "Файловая система", capabilities: ["resources", "tools"] }, { name: "GitHub", capabilities: ["tools"] }]} />
```

### Prompt engineering

#### PromptAnatomy

Breaks a prompt into labelled, color-coded role segments (system/role, instruction, context, examples, constraints, output format). Each role gets a fixed swatch from the `--viz-cat` palette. A legend row of chips and the segment list cross-highlight on hover/tap/focus; non-active segments dim. Segments stagger-reveal on scroll into view (respecting reduced motion). No autoplay, no timers; touch-friendly and fully static-usable.

Props: `label?: string` (default `'Анатомия промпта'`); `segments?: PromptSegment[]` where `PromptSegment = { role: 'system' | 'instruction' | 'context' | 'examples' | 'constraints' | 'format'; label: string; text: string }` (Russian defaults provided); `caption?: string` (Russian default).

```mdx
<PromptAnatomy
  segments={[
    { role: 'system', label: 'Роль / система', text: 'Ты опытный технический редактор.' },
    { role: 'instruction', label: 'Инструкция', text: 'Перепиши абзац для новичка.' },
    { role: 'context', label: 'Контекст', text: 'Документация про индексы БД.' },
    { role: 'constraints', label: 'Ограничения', text: 'Не длиннее трёх предложений.' },
    { role: 'format', label: 'Формат ответа', text: 'Только готовый абзац.' },
  ]}
/>
```

#### FewShotViz

Illustrates few-shot prompting: a list of example input->output pairs feeds a "model" node, then a new query is continued in the same format. Play/pause/reset controls step through revealing each shot, then the query, then its predicted output (the query output shows `?` until predicted). A progress tick row and pulsing model badge convey flow. Reduced motion shortens timing; fully steppable and static-readable.

Props: `label?: string` (default `'Few-shot подсказка'`); `shots?: FewShot[]` where `FewShot = { input: string; output: string }`; `query?: string`; `prediction?: string` (the model's output for the query); `modelName?: string` (default `'модель'`); `caption?: string`. All have Russian defaults.

```mdx
<FewShotViz
  shots={[
    { input: 'отличный сервис, всё быстро', output: 'позитив' },
    { input: 'товар пришёл сломанным', output: 'негатив' },
    { input: 'нормально, без восторга', output: 'нейтрально' },
  ]}
  query="доставку ждал две недели, ужас"
  prediction="негатив"
/>
```

#### ChainOfThoughtViz

Contrasts a direct answer (shown immediately, marked wrong/right) with a step-by-step chain of thought revealed one reasoning step at a time, ending in the correct final answer. Two-column on desktop, stacked on mobile. Play auto-reveals steps; a Step button advances manually; Reset restarts. Progress ticks track revealed steps. Reduced motion and full static usability supported.

Props: `label?: string` (default `'Цепочка рассуждений'`); `question?: string`; `steps?: string[]` (reasoning steps); `answer?: string` (correct final answer); `directAnswer?: string` (the naive direct answer); `directIsWrong?: boolean` (default `true`; controls the red-cross vs green-check styling of the direct answer); `caption?: string`. All Russian defaults.

```mdx
<ChainOfThoughtViz
  question="В корзине было 23 яблока. Использовали 20 и докупили 6. Сколько осталось?"
  steps={[
    'Старт: 23 яблока.',
    'Использовали 20: 23 − 20 = 3.',
    'Докупили 6: 3 + 6 = 9.',
  ]}
  answer="9 яблок"
  directAnswer="3 яблока"
  directIsWrong
/>
```

### Neural networks

All five render fully with no props (Russian-defaulted labels) and are interactive/animated, so they are registered **unwrapped** (no zoom lightbox).

#### PerceptronViz

A single neuron: inputs x weights -> weighted sum -> activation -> output, with adjustable weights/bias and live recompute. Use it to make the dot-product-then-activation step concrete.

Props: `inputs?: number[]`; `weights?: number[]`; `bias?: number` (default `0.2`); `activation?: 'sigmoid' | 'tanh' | 'relu'` (default `'sigmoid'`); `label?: string`; `inputLabels?: string[]`.

```mdx
<PerceptronViz inputs={[1, 0.5, -1]} weights={[0.8, -0.4, 0.3]} bias={0.1} activation="relu" />
```

#### ActivationPlot

Plots an activation function over a range; by default the learner can switch between functions. Use it next to the activation-functions concept.

Props: `fn?: 'sigmoid' | 'tanh' | 'relu' | 'softmax'` (default `'sigmoid'`); `domain?: { min: number; max: number }` (default `-5..5`); `softmaxInputs?: number[]`; `selectable?: boolean` (default `true`); `label?: string`.

```mdx
<ActivationPlot fn="sigmoid" />
```

#### NetworkDiagram

A layered MLP graph that animates a forward pass, lighting up neurons/edges layer by layer (play/step controls). Use it for the multi-layer / forward-pass concept.

Props: `layers?: number[]` (neuron count per layer); `layerNames?: string[]`; `stepIntervalMs?: number` (default `900`); `label?: string`.

```mdx
<NetworkDiagram layers={[3, 5, 4, 2]} layerNames={['вход', 'скрытый', 'скрытый', 'выход']} />
```

#### GradientDescentViz

A 1D loss curve with a ball rolling downhill across steps; the learning-rate effect is visible. Use it for gradient descent / learning-rate intuition.

Props: `fn?: (x: number) => number`; `lr?: number` (default `0.2`); `startX?: number` (default `-4`); `stepIntervalMs?: number` (default `650`); `label?: string`.

```mdx
<GradientDescentViz lr={0.2} />
```

#### LossLandscape

A 2D contour of a loss surface with an animated descent path toward the minimum. Use it for the optimization-landscape mental model.

Props: `path?: [number, number][]`; `domain?: { min: number; max: number }` (default `-1..1`); `contourLevels?: number[]`; `minimum?: [number, number]`; `stepIntervalMs?: number`; `label?: string`.

```mdx
<LossLandscape />
```

### Git

#### GitTerminal

A live, in-browser git terminal backed by the deterministic pure-JS git engine. It runs real git/shell commands (see the git-challenge supported-commands list in `exercise-types.md`), renders a live commit graph + working-tree status, and — when a `goal` is supplied — shows a checklist that turns green as assertions are met. This is the SAME component the `git-challenge` exercise player uses; in theory MDX use it for an embedded, hands-on playground (with or without a goal).

Props: `initial?: { files?: Record<string, string>; commands?: string[] }` (seed files into the working tree, then run setup commands to build starting history); `goal?: GitGoalAssertion[]` (optional live goal checklist, same shape as a git-challenge `goal`); `labels?: { placeholder?, reset?, goal?, solved? }` (Russian defaults); `className?: string`. Renders with no props as an empty repo to `git init` in.

```mdx
<GitTerminal
  initial={{
    files: { 'README.md': '# Demo\n' },
    commands: ['git init', 'git add README.md', 'git commit -m "init"'],
  }}
/>
```

`GitGraph` is internal to `GitTerminal` (it requires a live engine snapshot) and is **not** available as a standalone MDX tag — embed `GitTerminal` instead.

### Hashing

Interactive teaching visualizations for the `hashing` topic. All render fully with no props (Russian-defaulted labels), are responsive to 375px (wide content scrolls inside the `VizShell`), and are registered **unwrapped** (their controls stay live), so do not wrap them in `<Figure>`. For the basic hash-table mechanism (open addressing, load factor, resize/rehash) reuse the existing `HashTableViz` documented under domain visualizations - the components below cover the parts it does not.

All five accept `lang?: 'ru' | 'en'` (default `'ru'`) which switches every built-in control, footer, and default dataset to that language. In an `.en.mdx` file pass `lang="en"`; in `.ru.mdx` omit it.

#### HashFunctionViz

A live hash function. Type into the input and watch a fixed-length hex fingerprint (a 32-bit FNV-1a hash) and a 32-cell bit grid update. The "изменить один символ" button mutates one character to demonstrate the avalanche effect: the footer reports how many of the 32 bits flipped. Use it for the hash-function-properties concept (determinism + avalanche).

Props: `initialText?: string` (default `'Москва'`); `label?: string`; `lang?: 'ru' | 'en'`.

```mdx
<HashFunctionViz initialText="Иванов" />
```

#### HashLoopDemo

A **looped** animation (autoplaying, not just on-demand): one hash function cycles through a list of inputs on a timer, morphing the hex fingerprint and bit grid each tick, with a play/pause toggle and a manual "next" step. Honors `prefers-reduced-motion` (no autoplay, manual stepping only). Use it as a lively intro figure where you want continuous motion rather than a control the reader must drive - e.g. the what-is-hashing concept.

Props: `inputs?: string[]` (cycled values, language-defaulted); `intervalMs?: number` (default `2000`); `label?: string`; `lang?: 'ru' | 'en'`.

```mdx
<HashLoopDemo />
```

#### CollisionViz

Contrasts the two collision-resolution strategies on the same key stream. Toggle between «цепочки» (chaining - each bucket holds a list) and «открытая адресация» (open addressing - one key per cell, linear probing to the next free slot), then step through insertions. In probing mode the probe path and growing clusters are visible. Use it for the collisions concept.

Props: `size?: number` (bucket count, default `7`); `keys?: string[]` (insertion order, language-defaulted); `label?: string`; `lang?: 'ru' | 'en'`.

```mdx
<CollisionViz />
```

#### LoadFactorViz

A focused load-factor gauge. Each "добавить элемент" raises α = elements / buckets; when α reaches the threshold the table doubles and rehashes (with a rehash counter), making the amortized-O(1) resize story concrete without the distraction of probing. Use it next to the hash-tables resize discussion.

Props: `initialSize?: number` (default `4`); `threshold?: number` (default `0.75`); `label?: string`; `lang?: 'ru' | 'en'`.

```mdx
<LoadFactorViz threshold={0.75} />
```

#### ConsistentHashRing

A consistent-hashing ring: nodes and keys sit on one circle, each key belongs to the first node clockwise (shown as colored ownership arcs). "узел +/-" adds or removes a node and pulses the keys that move; the footer reports how many of N keys were remapped, contrasting with `hash % N` where almost everything would move. Use it for the databases-and-systems concept (sharding / distributed caches).

Props: `keys?: string[]` (language-defaulted); `label?: string`; `lang?: 'ru' | 'en'`.

```mdx
<ConsistentHashRing />
```

## Rules

- Never put a figure or sandbox inside a `Callout`/`Detail` unless it is genuinely optional material.
- All user-visible strings inside component props must be in the language of the file.
- Tables and wide figures must remain usable at 375px (Figure handles horizontal scroll; don't fight it with fixed widths).
- Alternate visuals with prose; never stack two figures back-to-back without text between them.
