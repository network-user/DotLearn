import type { Exercise } from '@dotlearn/contracts';

import type { JavascriptRuntime } from '../runtime/javascript';
import type { PythonRuntime } from '../runtime/python';
import type { SqlRuntime } from '../runtime/sql';

import { runFillInBlanks } from './fill-in-blanks';
import { runGitChallenge } from './git-challenge';
import { runJavascriptFunction } from './javascript-function';
import { runPredictOutput } from './predict-output';
import { runPythonFunction } from './python-function';
import { fail, type RunResult } from './result';
import { runSqlQuery } from './sql-query';
import { runTheoryQuiz } from './theory-quiz';

export interface RunContext {
  sql?: SqlRuntime;
  python?: PythonRuntime;
  javascript?: JavascriptRuntime;
}

const isStringRecord = (value: unknown): value is Record<string, string> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((v) => typeof v === 'string');
};

export const runExercise = async (
  exercise: Exercise,
  answer: unknown,
  context: RunContext = {},
): Promise<RunResult> => {
  switch (exercise.type) {
    case 'theory-quiz': {
      const choices = Array.isArray(answer) ? answer.map((value) => String(value)) : [];
      if (!Array.isArray(answer)) {
        return fail('expected array of choice ids');
      }
      return runTheoryQuiz(exercise, choices);
    }
    case 'sql-query': {
      if (typeof answer !== 'string') {
        return fail('expected SQL string answer');
      }
      if (!context.sql) {
        return fail('sql runtime not provided');
      }
      return runSqlQuery(exercise, answer, context.sql);
    }
    case 'python-function': {
      if (typeof answer !== 'string') {
        return fail('expected python source as string');
      }
      if (!context.python) {
        return fail('python runtime not provided');
      }
      return runPythonFunction(exercise, answer, context.python);
    }
    case 'javascript-function': {
      if (typeof answer !== 'string') {
        return fail('expected javascript source as string');
      }
      if (!context.javascript) {
        return fail('javascript runtime not provided');
      }
      return runJavascriptFunction(exercise, answer, context.javascript);
    }
    case 'fill-in-blanks': {
      if (!isStringRecord(answer)) {
        return fail('expected answers as { [blankId]: string }');
      }
      return runFillInBlanks(exercise, answer);
    }
    case 'predict-output': {
      return runPredictOutput(exercise, answer);
    }
    case 'git-challenge': {
      if (typeof answer !== 'string' && !isStringArray(answer)) {
        return fail('expected git commands as string or string[]');
      }
      return runGitChallenge(exercise, answer);
    }
  }
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');
