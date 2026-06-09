import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

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
        const scope = `${exerciseFile.filename} :: ${exercise.id}`;
        const outcome = await runSqlQuery(exercise, exercise.solution, sql);
        if (!outcome.ok) {
          failures.push({ scope, reason: outcome.reason, details: outcome.details });
        }
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
      const failures = await validateGoldSolutions(bundle, sql);
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
