import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { exerciseVariantCount, resolveExerciseVariant } from '@dotlearn/contracts';

import { runSqlQuery } from '../runners/sql-query';
import { runPythonFunction } from '../runners/python-function';
import type { RunResult } from '../runners/result';
import { TopicLoadError, TopicNotFoundError, type TopicBundle } from '../loader/source';
import { createNodeTopicSource } from '../loader/node';
import { createSqlJsNodeRuntime } from '../runtime/sql-js-node';
import { createPythonNodeRuntime } from '../runtime/python-node';
import type { SqlRuntime } from '../runtime/sql';
import type { PythonRuntime } from '../runtime/python';

const ROOT = resolve(process.cwd(), '..', '..');
const TOPICS_DIR = resolve(ROOT, 'topics');

interface GateFailure {
  scope: string;
  reason: string;
  details?: unknown;
}

const formatFailures = (failures: GateFailure[]): string =>
  failures
    .map(
      (failure) =>
        `  • ${failure.scope}: ${failure.reason}${
          failure.details !== undefined ? `\n      ${JSON.stringify(failure.details)}` : ''
        }`,
    )
    .join('\n');

interface GoldRuntimes {
  sql: SqlRuntime;
  python: PythonRuntime;
}

const validateGoldSolutions = async (
  bundle: TopicBundle,
  runtimes: GoldRuntimes,
): Promise<GateFailure[]> => {
  const failures: GateFailure[] = [];
  for (const concept of bundle.concepts) {
    for (const exerciseFile of concept.exercises) {
      for (const exercise of exerciseFile.exercises) {
        if (exercise.type !== 'sql-query' && exercise.type !== 'python-function') {
          continue;
        }
        const variantTotal = exerciseVariantCount(exercise);
        for (let variantIndex = 0; variantIndex < variantTotal; variantIndex += 1) {
          const resolved = resolveExerciseVariant(exercise, variantIndex);
          const scope =
            variantIndex === 0
              ? `${exerciseFile.filename} :: ${exercise.id}`
              : `${exerciseFile.filename} :: ${exercise.id} [variant ${variantIndex}]`;
          let outcome: RunResult;
          if (resolved.type === 'sql-query') {
            outcome = await runSqlQuery(resolved, resolved.solution, runtimes.sql);
          } else if (resolved.type === 'python-function') {
            outcome = await runPythonFunction(resolved, resolved.solution, runtimes.python);
          } else {
            continue;
          }
          if (!outcome.ok) {
            failures.push({ scope, reason: outcome.reason, details: outcome.details });
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

const validateStaticChecks = (bundle: TopicBundle): GateFailure[] => {
  const failures: GateFailure[] = [];
  for (const concept of bundle.concepts) {
    for (const exerciseFile of concept.exercises) {
      for (const exercise of exerciseFile.exercises) {
        const base = `${exerciseFile.filename} :: ${exercise.id}`;
        if (exercise.type === 'fill-in-blanks') {
          checkFillInBlanks(base, exercise.template, exercise.blanks, failures);
          exercise.variants?.forEach((variant, index) =>
            checkFillInBlanks(`${base} [variant ${index + 1}]`, variant.template, variant.blanks, failures),
          );
        } else if (exercise.type === 'theory-quiz') {
          checkQuizCorrect(base, exercise.choices, exercise.correct, failures);
          exercise.variants?.forEach((variant, index) =>
            checkQuizCorrect(`${base} [variant ${index + 1}]`, variant.choices, variant.correct, failures),
          );
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

const main = async (): Promise<number> => {
  if (!existsSync(TOPICS_DIR)) {
    console.log('No topics/ directory yet. Nothing to validate.');
    return 0;
  }

  const source = createNodeTopicSource({ topicsDir: TOPICS_DIR });
  const slugs = await source.list();
  if (slugs.length === 0) {
    console.log('No topics found.');
    return 0;
  }

  const sql = createSqlJsNodeRuntime();
  const python = createPythonNodeRuntime();
  let totalFailures = 0;

  for (const slug of slugs) {
    try {
      const bundle = await source.load(slug);
      const failures = [
        ...validateVariantParity(bundle),
        ...validateStaticChecks(bundle),
        ...(await validateGoldSolutions(bundle, { sql, python })),
      ];
      if (failures.length === 0) {
        console.log(`OK  ${slug}`);
      } else {
        totalFailures += 1;
        console.error(`FAIL ${slug} — ${failures.length} gold solution failure(s)`);
        console.error(formatFailures(failures));
      }
    } catch (error) {
      totalFailures += 1;
      if (error instanceof TopicNotFoundError) {
        console.error(`FAIL ${slug} — manifest missing`);
      } else if (error instanceof TopicLoadError) {
        console.error(`FAIL ${slug} — ${error.resource}: ${error.message}`);
      } else {
        console.error(`FAIL ${slug} — unexpected error`);
        console.error(error);
      }
    }
  }

  console.log(`\n${slugs.length - totalFailures}/${slugs.length} topics valid.`);
  return totalFailures > 0 ? 1 : 0;
};

main().then((code) => process.exit(code));
