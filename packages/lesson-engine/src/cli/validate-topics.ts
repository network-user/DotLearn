import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { exerciseVariantCount, resolveExerciseVariant } from '@dotlearn/contracts';

import { runSqlQuery } from '../runners/sql-query';
import { TopicLoadError, TopicNotFoundError, type TopicBundle } from '../loader/source';
import { createNodeTopicSource } from '../loader/node';
import { createSqlJsNodeRuntime } from '../runtime/sql-js-node';
import type { SqlRuntime } from '../runtime/sql';

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

const validateGoldSolutions = async (
  bundle: TopicBundle,
  sql: SqlRuntime,
): Promise<GateFailure[]> => {
  const failures: GateFailure[] = [];
  for (const concept of bundle.concepts) {
    for (const exerciseFile of concept.exercises) {
      for (const exercise of exerciseFile.exercises) {
        if (exercise.type !== 'sql-query') {
          continue;
        }
        const variantTotal = exerciseVariantCount(exercise);
        for (let variantIndex = 0; variantIndex < variantTotal; variantIndex += 1) {
          const resolved = resolveExerciseVariant(exercise, variantIndex);
          if (resolved.type !== 'sql-query') {
            continue;
          }
          const scope =
            variantIndex === 0
              ? `${exerciseFile.filename} :: ${exercise.id}`
              : `${exerciseFile.filename} :: ${exercise.id} [variant ${variantIndex}]`;
          const outcome = await runSqlQuery(resolved, resolved.solution, sql);
          if (!outcome.ok) {
            failures.push({ scope, reason: outcome.reason, details: outcome.details });
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
  let totalFailures = 0;

  for (const slug of slugs) {
    try {
      const bundle = await source.load(slug);
      const failures = [...validateVariantParity(bundle), ...(await validateGoldSolutions(bundle, sql))];
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
