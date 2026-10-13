import type {
  DesignerCommand,
  DesignerGoal,
  DesignerGradeMode,
  DesignerSeed,
  DesignerStep,
  DesignerStepExpect,
  DesignerValue,
} from '@dotlearn/contracts';

import {
  applyDesignerCommand,
  createDesignerState,
  designerBalances,
  type DesignerState,
} from './state';

const same = (left: string, right: string): boolean =>
  left.trim().toLowerCase() === right.trim().toLowerCase();

const close = (left: number, right: number): boolean => Math.abs(left - right) < 1e-9;

const sameValue = (actual: DesignerValue | undefined, expected: DesignerValue): boolean => {
  if (typeof expected === 'number') return typeof actual === 'number' && close(actual, expected);
  return same(String(actual ?? ''), expected);
};

const valuesMatch = (
  actual: Record<string, DesignerValue>,
  expected: Record<string, DesignerValue>,
): boolean => Object.entries(expected).every(([key, value]) => sameValue(actual[key], value));

export const expectHolds = (
  state: DesignerState,
  assertion: DesignerStepExpect | DesignerGoal,
): boolean => {
  switch (assertion.kind) {
    case 'mode':
      return state.ui.mode === assertion.equals;
    case 'list':
      return (
        state.ui.draft === null && state.ui.list !== null && same(state.ui.list, assertion.object)
      );
    case 'form':
      if (!assertion.open) return state.ui.draft === null;
      return (
        state.ui.draft !== null &&
        (!assertion.object || same(state.ui.draft.object, assertion.object))
      );
    case 'has-catalog':
      return state.catalogs.some((item) => same(item.name, assertion.name));
    case 'has-document':
      return state.documents.some((item) => same(item.name, assertion.name));
    case 'has-register':
      return state.registers.some((item) => same(item.name, assertion.name));
    case 'has-field': {
      const host =
        state.catalogs.find((item) => same(item.name, assertion.object)) ??
        state.documents.find((item) => same(item.name, assertion.object));
      const field = host?.fields.find((item) => same(item.name, assertion.name));
      return field !== undefined && (assertion.type === undefined || field.type === assertion.type);
    }
    case 'has-dimension': {
      const register = state.registers.find((item) => same(item.name, assertion.register));
      return Boolean(register?.dimensions.some((item) => same(item.name, assertion.name)));
    }
    case 'has-movement': {
      const document = state.documents.find((item) => same(item.name, assertion.document));
      return Boolean(
        document?.movements.some(
          (item) =>
            same(item.register, assertion.register) && item.direction === assertion.direction,
        ),
      );
    }
    case 'has-guard': {
      const document = state.documents.find((item) => same(item.name, assertion.document));
      return Boolean(
        document?.guards.some((guard) => {
          if (guard.kind !== assertion.guard) return false;
          if (
            assertion.minutes !== undefined &&
            'minutes' in guard &&
            guard.minutes !== assertion.minutes
          ) {
            return false;
          }
          if (assertion.rules && guard.kind === 'probe-count') {
            return assertion.rules.every((rule) =>
              guard.rules.some(
                (item) => same(item.standard, rule.standard) && item.count === rule.count,
              ),
            );
          }
          return assertion.rules === undefined;
        }),
      );
    }
    case 'item': {
      const item = state.items.find(
        (row) => same(row.catalog, assertion.catalog) && same(row.name, assertion.name),
      );
      return (
        item !== undefined &&
        (assertion.values === undefined || valuesMatch(item.values, assertion.values))
      );
    }
    case 'posted':
      return state.docs.some(
        (doc) =>
          doc.posted &&
          same(doc.document, assertion.document) &&
          valuesMatch(doc.values, assertion.values),
      );
    case 'not-posted':
      return state.docs.every((doc) => !doc.posted || !same(doc.document, assertion.document));
    case 'balance': {
      const line = designerBalances(state).find(
        (row) =>
          same(row.register, assertion.register) &&
          row.dims.length === assertion.dims.length &&
          assertion.dims.every((dim) =>
            row.dims.some((actual) => same(actual.name, dim.name) && same(actual.value, dim.value)),
          ),
      );
      return close(line?.qty ?? 0, assertion.qty);
    }
  }
};

export interface DesignerGrade {
  ok: boolean;
  steps: { id: string; ok: boolean }[];
  goals: { index: number; kind: string; ok: boolean }[];
}

export interface DesignerGradeSpec {
  mode: DesignerGradeMode;
  seed: DesignerSeed;
  steps: readonly DesignerStep[];
  goal: readonly DesignerGoal[];
}

export const gradeDesignerSession = (
  spec: DesignerGradeSpec,
  commands: readonly DesignerCommand[],
): DesignerGrade => {
  let state = createDesignerState(spec.seed);
  const latched = new Set<string>();
  const latch = (current: DesignerState): void => {
    for (const step of spec.steps) {
      if (latched.has(step.id)) continue;
      if (step.expect.every((item) => expectHolds(current, item))) latched.add(step.id);
    }
  };
  latch(state);
  for (const command of commands) {
    state = applyDesignerCommand(state, command);
    latch(state);
  }
  const steps = spec.steps.map((step) => ({ id: step.id, ok: latched.has(step.id) }));
  const goals = spec.goal.map((item, index) => ({
    index,
    kind: item.kind,
    ok: expectHolds(state, item),
  }));
  const stepsOk = steps.every((step) => step.ok);
  const goalsOk = goals.every((goal) => goal.ok);
  const ok = (spec.mode === 'snapshot' || stepsOk) && (spec.mode === 'steps' || goalsOk);
  return { ok, steps, goals };
};
