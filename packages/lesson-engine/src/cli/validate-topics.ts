import { existsSync, watch as watchFs, type FSWatcher } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { exerciseVariantCount, resolveExerciseVariant } from '@dotlearn/contracts';

import { runSqlQuery } from '../runners/sql-query';
import { runPythonFunction } from '../runners/python-function';
import { runGitChallenge } from '../runners/git-challenge';
import type { RunResult } from '../runners/result';
import { parseFlashcardDeck } from '../loader/parse';
import { TopicLoadError, TopicNotFoundError, type TopicBundle } from '../loader/source';
import { createNodeTopicSource } from '../loader/node';
import { createSqlJsNodeRuntime } from '../runtime/sql-js-node';
import { createPythonNodeRuntime } from '../runtime/python-node';
import type { SqlRuntime } from '../runtime/sql';
import type { PythonRuntime } from '../runtime/python';

import {
  indexExerciseLocations,
  locateExercise,
  type ExerciseLocationIndex,
} from './yaml-locator';
import { formatGoldDetails } from './gold-diff';
import { compileTheoryBody } from './mdx-compile';
import {
  checkCoverage,
  checkLanguageParity,
  checkPrerequisites,
  checkSlugUniqueness,
} from './structural-gates';
import {
  classifyRuntimeForSandbox,
  hasFigure,
  hasLiveSandbox,
  lintTheoryFrontmatter,
  parseTheoryFrontmatter,
} from './theory-lint';
import { runSoftLint } from './soft-lint';
import { buildTopicReport, formatTopicReport, type TopicReport } from './report';

const ROOT = resolve(process.cwd(), '..', '..');
const TOPICS_DIR = resolve(ROOT, 'topics');

interface CliOptions {
  lint: boolean;
  report: boolean;
  json: boolean;
  watch: boolean;
  slug?: string;
}

const HELP = `validate-topics — DotLearn topic validator

Usage:
  validate                 Run hard gates over every topic (default). Exit 1 on any failure.
  validate --slug <slug>   Validate a single topic.
  validate --lint          Also print non-blocking theory-lint + soft-lint warnings (exit unaffected).
  validate --report        Print a per-topic health scorecard (add --json for machine output).
  validate --watch         Re-validate a topic when its files change; keep runtimes warm.
  validate --help          Show this help.

Hard gates (block the default run):
  variant parity, static answer checks, flashcard parsing, gold-solution execution,
  MDX theory compilation, slug uniqueness, prerequisite resolution, language structural parity.

Non-blocking (always reported, never fail the run):
  exercise coverage (>=3 exercises per concept, easy + hard spread).

Flag-gated (non-blocking, opt-in):
  --lint    theory frontmatter / figure / sandbox lint + dangling wikilinks, weak hints, missing overview.
  --report  health scorecard with difficulty / type mix and theory word budget.`;

const parseArgs = (argv: string[]): CliOptions | 'help' => {
  const options: CliOptions = { lint: false, report: false, json: false, watch: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--help':
      case '-h':
        return 'help';
      case '--lint':
        options.lint = true;
        break;
      case '--report':
        options.report = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--watch':
        options.watch = true;
        break;
      case '--slug': {
        const next = argv[index + 1];
        if (next !== undefined) {
          options.slug = next;
        }
        index += 1;
        break;
      }
      default:
        if (arg && arg.startsWith('--slug=')) {
          options.slug = arg.slice('--slug='.length);
        }
        break;
    }
  }
  return options;
};

interface GateFailure {
  scope: string;
  reason: string;
  details?: unknown;
  diff?: string;
  location?: string;
}

interface Warning {
  scope: string;
  reason: string;
}

const formatFailures = (failures: GateFailure[]): string =>
  failures
    .map((failure) => {
      const head = failure.location ? `${failure.location}  ${failure.scope}` : `  • ${failure.scope}`;
      const lines = [`${head}: ${failure.reason}`];
      if (failure.diff) {
        lines.push(failure.diff);
      } else if (failure.details !== undefined) {
        lines.push(`      ${JSON.stringify(failure.details)}`);
      }
      return lines.join('\n');
    })
    .join('\n');

const formatWarnings = (warnings: Warning[]): string =>
  warnings.map((warning) => `  ~ ${warning.scope}: ${warning.reason}`).join('\n');

interface GoldRuntimes {
  sql: SqlRuntime;
  python: PythonRuntime;
}

const buildLocationIndex = async (
  slug: string,
  filename: string,
  cache: Map<string, ExerciseLocationIndex>,
): Promise<ExerciseLocationIndex> => {
  const cached = cache.get(filename);
  if (cached) {
    return cached;
  }
  let index: ExerciseLocationIndex = { byId: new Map() };
  try {
    index = indexExerciseLocations(await readFile(join(TOPICS_DIR, slug, filename), 'utf-8'));
  } catch {
    index = { byId: new Map() };
  }
  cache.set(filename, index);
  return index;
};

const locationLabel = (
  slug: string,
  filename: string,
  index: ExerciseLocationIndex,
  exerciseId: string,
): string => {
  const located = locateExercise(index, exerciseId);
  const suffix = located ? `:${located.line}` : '';
  return `topics/${slug}/${filename}${suffix}`;
};

const validateGoldSolutions = async (
  slug: string,
  bundle: TopicBundle,
  runtimes: GoldRuntimes,
  locationCache: Map<string, ExerciseLocationIndex>,
): Promise<GateFailure[]> => {
  const failures: GateFailure[] = [];
  for (const concept of bundle.concepts) {
    for (const exerciseFile of concept.exercises) {
      for (const exercise of exerciseFile.exercises) {
        if (
          exercise.type !== 'sql-query' &&
          exercise.type !== 'python-function' &&
          exercise.type !== 'git-challenge'
        ) {
          continue;
        }
        const variantTotal = exerciseVariantCount(exercise);
        for (let variantIndex = 0; variantIndex < variantTotal; variantIndex += 1) {
          const resolved = resolveExerciseVariant(exercise, variantIndex);
          const variantSuffix = variantIndex === 0 ? '' : ` [variant ${variantIndex}]`;
          const scope = `${exercise.id}${variantSuffix}`;
          let outcome: RunResult;
          if (resolved.type === 'sql-query') {
            outcome = await runSqlQuery(resolved, resolved.solution, runtimes.sql);
          } else if (resolved.type === 'python-function') {
            outcome = await runPythonFunction(resolved, resolved.solution, runtimes.python);
          } else if (resolved.type === 'git-challenge') {
            outcome = runGitChallenge(resolved, resolved.solution);
          } else {
            continue;
          }
          if (!outcome.ok) {
            const index = await buildLocationIndex(slug, exerciseFile.filename, locationCache);
            const diff = formatGoldDetails(outcome.details);
            const failure: GateFailure = {
              scope,
              reason: outcome.reason,
              details: outcome.details,
              location: locationLabel(slug, exerciseFile.filename, index, exercise.id),
            };
            if (diff !== undefined) {
              failure.diff = diff;
            }
            failures.push(failure);
          }
        }
      }
    }
  }
  return failures;
};

const PLACEHOLDER_PATTERN = /\{\{([a-zA-Z0-9_-]+)\}\}/g;

const placeholderSet = (template: string): Set<string> => {
  const found = new Set<string>();
  const matcher = new RegExp(PLACEHOLDER_PATTERN.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(template)) !== null) {
    if (match[1] !== undefined) {
      found.add(match[1]);
    }
  }
  return found;
};

const checkFillInBlanks = (
  scope: string,
  template: string,
  blanks: Record<string, unknown>,
  failures: GateFailure[],
): void => {
  const placeholders = placeholderSet(template);
  for (const key of Object.keys(blanks)) {
    if (!placeholders.has(key)) {
      failures.push({ scope, reason: `blank "${key}" has no {{${key}}} placeholder in template` });
    }
  }
  for (const key of placeholders) {
    if (!(key in blanks)) {
      failures.push({ scope, reason: `placeholder {{${key}}} has no matching blank spec` });
    }
  }
};

const checkQuizCorrect = (
  scope: string,
  choices: ReadonlyArray<{ id: string }>,
  correct: ReadonlyArray<string>,
  failures: GateFailure[],
): void => {
  const choiceIds = new Set(choices.map((choice) => choice.id));
  for (const id of correct) {
    if (!choiceIds.has(id)) {
      failures.push({ scope, reason: `correct answer "${id}" is not a choice id` });
    }
  }
};

const validateStaticChecks = async (
  slug: string,
  bundle: TopicBundle,
  locationCache: Map<string, ExerciseLocationIndex>,
): Promise<GateFailure[]> => {
  const failures: GateFailure[] = [];
  for (const concept of bundle.concepts) {
    for (const exerciseFile of concept.exercises) {
      for (const exercise of exerciseFile.exercises) {
        const fileFailures: GateFailure[] = [];
        if (exercise.type === 'fill-in-blanks') {
          checkFillInBlanks(exercise.id, exercise.template, exercise.blanks, fileFailures);
          exercise.variants?.forEach((variant, index) =>
            checkFillInBlanks(
              `${exercise.id} [variant ${index + 1}]`,
              variant.template,
              variant.blanks,
              fileFailures,
            ),
          );
        } else if (exercise.type === 'theory-quiz') {
          checkQuizCorrect(exercise.id, exercise.choices, exercise.correct, fileFailures);
          exercise.variants?.forEach((variant, index) =>
            checkQuizCorrect(
              `${exercise.id} [variant ${index + 1}]`,
              variant.choices,
              variant.correct,
              fileFailures,
            ),
          );
        }
        if (fileFailures.length > 0) {
          const index = await buildLocationIndex(slug, exerciseFile.filename, locationCache);
          const location = locationLabel(slug, exerciseFile.filename, index, exercise.id);
          for (const failure of fileFailures) {
            failures.push({ ...failure, location });
          }
        }
      }
    }
  }
  return failures;
};

const languageOfExerciseFile = (filename: string): string =>
  /\.([a-z]{2})\.ya?ml$/.exec(filename)?.[1] ?? 'unknown';

const validateVariantParity = (bundle: TopicBundle): GateFailure[] => {
  const failures: GateFailure[] = [];
  for (const concept of bundle.concepts) {
    const countsByExercise = new Map<string, Map<string, number>>();
    for (const exerciseFile of concept.exercises) {
      const language = languageOfExerciseFile(exerciseFile.filename);
      for (const exercise of exerciseFile.exercises) {
        const perLanguage = countsByExercise.get(exercise.id) ?? new Map<string, number>();
        perLanguage.set(language, exerciseVariantCount(exercise));
        countsByExercise.set(exercise.id, perLanguage);
      }
    }
    for (const [exerciseId, perLanguage] of countsByExercise) {
      const counts = [...perLanguage.values()];
      if (new Set(counts).size > 1) {
        failures.push({
          scope: `${concept.conceptId} :: ${exerciseId}`,
          reason: 'variant count differs between languages',
          details: Object.fromEntries(perLanguage),
        });
      }
    }
  }
  return failures;
};

const flashcardDeckFiles = async (slug: string): Promise<string[]> => {
  const flashcardsDir = join(TOPICS_DIR, slug, 'flashcards');
  if (!existsSync(flashcardsDir)) {
    return [];
  }
  const entries = await readdir(flashcardsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.ya?ml$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
};

const validateFlashcards = async (slug: string): Promise<GateFailure[]> => {
  const failures: GateFailure[] = [];
  for (const filename of await flashcardDeckFiles(slug)) {
    try {
      parseFlashcardDeck(
        slug,
        `flashcards/${filename}`,
        await readFile(join(TOPICS_DIR, slug, 'flashcards', filename), 'utf-8'),
      );
    } catch (error) {
      failures.push({
        scope: `flashcards/${filename}`,
        reason: error instanceof TopicLoadError ? error.message : String(error),
      });
    }
  }
  return failures;
};

const countFlashcards = async (slug: string): Promise<number> => {
  let total = 0;
  for (const filename of await flashcardDeckFiles(slug)) {
    try {
      const deck = parseFlashcardDeck(
        slug,
        `flashcards/${filename}`,
        await readFile(join(TOPICS_DIR, slug, 'flashcards', filename), 'utf-8'),
      );
      total += deck.cards.length;
    } catch {
      continue;
    }
  }
  return total;
};

const validateMdxCompilation = async (slug: string, bundle: TopicBundle): Promise<GateFailure[]> => {
  const failures: GateFailure[] = [];
  for (const concept of bundle.concepts) {
    for (const theory of concept.theory) {
      const { body } = parseTheoryFrontmatter(theory.source);
      const outcome = await compileTheoryBody(body);
      if (!outcome.ok) {
        const suffix = outcome.line !== undefined ? `:${outcome.line}` : '';
        failures.push({
          scope: theory.filename,
          reason: outcome.reason ?? 'theory MDX failed to compile',
          location: `topics/${slug}/${theory.filename}${suffix}`,
        });
      }
    }
  }
  return failures;
};

interface StructuralResult {
  failures: GateFailure[];
  warnings: Warning[];
}

const validateStructural = (bundle: TopicBundle, knownSlugs: ReadonlySet<string>): StructuralResult => {
  const failures: GateFailure[] = [];
  for (const finding of checkPrerequisites(
    bundle.manifest.slug,
    [...bundle.manifest.prerequisites],
    knownSlugs,
  )) {
    failures.push({ scope: finding.scope, reason: finding.reason });
  }
  for (const finding of checkLanguageParity(bundle)) {
    failures.push({ scope: finding.scope, reason: finding.reason });
  }
  const warnings: Warning[] = checkCoverage(bundle).map((finding) => ({
    scope: finding.scope,
    reason: finding.reason,
  }));
  return { failures, warnings };
};

const collectLintWarnings = (bundle: TopicBundle): Warning[] => {
  const warnings: Warning[] = [];
  const runtimeClass = classifyRuntimeForSandbox(bundle.manifest.runtime);
  for (const concept of bundle.concepts) {
    for (const theory of concept.theory) {
      const parsed = parseTheoryFrontmatter(theory.source);
      for (const issue of lintTheoryFrontmatter(parsed, concept.conceptId)) {
        warnings.push({ scope: theory.filename, reason: issue.reason });
      }
      if (!hasFigure(parsed.body)) {
        warnings.push({ scope: theory.filename, reason: 'theory has no figure / chart component' });
      }
      if (!hasLiveSandbox(parsed.body, runtimeClass)) {
        const kind = runtimeClass === 'python' ? '<PyDemo>' : 'live <SideSql>';
        warnings.push({
          scope: theory.filename,
          reason: `runtime "${bundle.manifest.runtime}" concept has no ${kind} sandbox`,
        });
      }
    }
  }
  for (const warning of runSoftLint(bundle)) {
    warnings.push({ scope: warning.scope, reason: warning.reason });
  }
  return warnings;
};

interface TopicValidation {
  slug: string;
  failures: GateFailure[];
  warnings: Warning[];
  loadError?: string;
}

const validateTopic = async (
  slug: string,
  knownSlugs: ReadonlySet<string>,
  runtimes: GoldRuntimes,
): Promise<TopicValidation> => {
  try {
    const source = createNodeTopicSource({ topicsDir: TOPICS_DIR });
    const bundle = await source.load(slug);
    const locationCache = new Map<string, ExerciseLocationIndex>();
    const structural = validateStructural(bundle, knownSlugs);
    const failures: GateFailure[] = [
      ...validateVariantParity(bundle),
      ...(await validateStaticChecks(slug, bundle, locationCache)),
      ...(await validateFlashcards(slug)),
      ...(await validateGoldSolutions(slug, bundle, runtimes, locationCache)),
      ...(await validateMdxCompilation(slug, bundle)),
      ...structural.failures,
    ];
    return { slug, failures, warnings: structural.warnings };
  } catch (error) {
    let loadError: string;
    if (error instanceof TopicNotFoundError) {
      loadError = 'manifest missing';
    } else if (error instanceof TopicLoadError) {
      loadError = `${error.resource}: ${error.message}`;
    } else {
      loadError = error instanceof Error ? error.message : String(error);
    }
    return { slug, failures: [], warnings: [], loadError };
  }
};

const appendLintWarnings = async (result: TopicValidation): Promise<void> => {
  if (result.loadError) {
    return;
  }
  try {
    const bundle = await createNodeTopicSource({ topicsDir: TOPICS_DIR }).load(result.slug);
    result.warnings = [...result.warnings, ...collectLintWarnings(bundle)];
  } catch {
    return;
  }
};

const printTopicResult = (result: TopicValidation): boolean => {
  if (result.loadError) {
    console.error(`FAIL ${result.slug} — ${result.loadError}`);
    return false;
  }
  const ok = result.failures.length === 0;
  if (ok) {
    console.log(`OK  ${result.slug}`);
  } else {
    console.error(`FAIL ${result.slug} — ${result.failures.length} validation failure(s)`);
    console.error(formatFailures(result.failures));
  }
  if (result.warnings.length > 0) {
    console.log(`WARN ${result.slug} — ${result.warnings.length} non-blocking warning(s)`);
    console.log(formatWarnings(result.warnings));
  }
  return ok;
};

const runValidation = async (slugs: string[], options: CliOptions): Promise<number> => {
  const allSlugs = await createNodeTopicSource({ topicsDir: TOPICS_DIR }).list();
  const slugFindings = checkSlugUniqueness(allSlugs);
  if (slugFindings.length > 0) {
    for (const finding of slugFindings) {
      console.error(`FAIL ${finding.scope} — ${finding.reason}`);
    }
    return 1;
  }
  const knownSlugs = new Set(allSlugs);

  const sql = createSqlJsNodeRuntime();
  const python = createPythonNodeRuntime();
  let failed = 0;

  for (const slug of slugs) {
    const result = await validateTopic(slug, knownSlugs, { sql, python });
    if (options.lint) {
      await appendLintWarnings(result);
    }
    const ok = printTopicResult(result);
    if (!ok) {
      failed += 1;
    }
  }

  console.log(`\n${slugs.length - failed}/${slugs.length} topics valid.`);
  return failed > 0 ? 1 : 0;
};

const runReport = async (slugs: string[], options: CliOptions): Promise<number> => {
  const source = createNodeTopicSource({ topicsDir: TOPICS_DIR });
  const reports: TopicReport[] = [];
  for (const slug of slugs) {
    try {
      const bundle = await source.load(slug);
      reports.push(buildTopicReport(bundle, await countFlashcards(slug)));
    } catch (error) {
      console.error(`FAIL ${slug} — ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (options.json) {
    console.log(JSON.stringify(reports, null, 2));
  } else {
    console.log(reports.map(formatTopicReport).join('\n\n'));
    const outOfBudget = reports.filter((report) => !report.theoryWordBudget.withinBudget).length;
    console.log(
      `\n${reports.length} topic(s) reported. ${outOfBudget} outside the theory word budget.`,
    );
  }
  return 0;
};

const debounce = (fn: () => void, ms: number): (() => void) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(fn, ms);
  };
};

const runWatch = async (options: CliOptions): Promise<number> => {
  const source = createNodeTopicSource({ topicsDir: TOPICS_DIR });
  const allSlugs = await source.list();
  const knownSlugs = new Set(allSlugs);
  const sql = createSqlJsNodeRuntime();
  const python = createPythonNodeRuntime();

  const targetSlugs = options.slug ? [options.slug] : allSlugs;
  const watchers: FSWatcher[] = [];

  const revalidate = async (slug: string): Promise<void> => {
    const result = await validateTopic(slug, knownSlugs, { sql, python });
    if (options.lint) {
      await appendLintWarnings(result);
    }
    printTopicResult(result);
  };

  for (const slug of targetSlugs) {
    const dir = join(TOPICS_DIR, slug);
    if (!existsSync(dir)) {
      continue;
    }
    const trigger = debounce(() => {
      void revalidate(slug);
    }, 150);
    try {
      const watcher = watchFs(dir, { recursive: true }, () => trigger());
      watchers.push(watcher);
    } catch {
      const watcher = watchFs(dir, () => trigger());
      watchers.push(watcher);
    }
  }

  console.log(`Watching ${targetSlugs.length} topic(s). Edit a file to re-validate. Ctrl+C to stop.`);
  for (const slug of targetSlugs) {
    await revalidate(slug);
  }
  await new Promise<void>(() => {});
  return 0;
};

const main = async (): Promise<number> => {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed === 'help') {
    console.log(HELP);
    return 0;
  }
  const options = parsed;

  if (!existsSync(TOPICS_DIR)) {
    console.log('No topics/ directory yet. Nothing to validate.');
    return 0;
  }

  const source = createNodeTopicSource({ topicsDir: TOPICS_DIR });
  const allSlugs = await source.list();
  if (allSlugs.length === 0) {
    console.log('No topics found.');
    return 0;
  }

  if (options.slug && !allSlugs.includes(options.slug)) {
    console.error(`Unknown topic slug "${options.slug}". Known: ${allSlugs.join(', ')}`);
    return 1;
  }

  const targetSlugs = options.slug ? [options.slug] : allSlugs;

  if (options.watch) {
    return runWatch(options);
  }
  if (options.report) {
    return runReport(targetSlugs, options);
  }
  return runValidation(targetSlugs, options);
};

main().then((code) => process.exit(code));
