import type {
  OnecCommand,
  OnecGoal,
  OnecLabMode,
  OnecSeed,
  OnecStep,
  OnecStepExpect,
} from '@dotlearn/contracts';

import { applyOnecCommand, createOnecState, onecBalances, type OnecState } from './state';

const sameName = (left: string, right: string): boolean =>
  left.trim().toLowerCase() === right.trim().toLowerCase();

const close = (left: number, right: number): boolean => Math.abs(left - right) < 1e-9;

const postedMatches = (
  state: OnecState,
  assertion: Extract<OnecGoal, { kind: 'document-posted' }>,
): boolean => {
  const docs = assertion.doc === 'sale' ? state.sales : state.receipts;
  return docs.some((doc) => {
    if (doc.posted !== assertion.posted) return false;
    if (!sameName(doc.counterpartyName, assertion.counterparty)) return false;
    if (!sameName(doc.warehouseName, assertion.warehouse)) return false;
    if (doc.lines.length !== assertion.lines.length) return false;
    const used = new Set<number>();
    for (const expected of assertion.lines) {
      const index = doc.lines.findIndex(
        (line, lineIndex) =>
          !used.has(lineIndex) &&
          sameName(line.productName, expected.product) &&
          close(line.qty, expected.qty),
      );
      if (index < 0) return false;
      used.add(index);
    }
    return true;
  });
};

const queryMatches = (
  state: OnecState,
  assertion: Extract<OnecGoal, { kind: 'query-result' }>,
): boolean => {
  const rows = state.lastQuery?.rows;
  if (!rows || rows.length !== assertion.rows.length) return false;
  const used = new Set<number>();
  return assertion.rows.every((expected) => {
    const index = rows.findIndex((row, rowIndex) => {
      if (used.has(rowIndex)) return false;
      return Object.entries(expected).every(([key, value]) => {
        const actual = row[key];
        if (typeof value === 'number' && typeof actual === 'number') return close(actual, value);
        if (typeof value === 'boolean') return actual === value;
        return sameName(String(actual ?? ''), String(value));
      });
    });
    if (index < 0) return false;
    used.add(index);
    return true;
  });
};

export const expectHolds = (state: OnecState, assertion: OnecStepExpect | OnecGoal): boolean => {
  switch (assertion.kind) {
    case 'section':
      return state.ui.section === assertion.equals;
    case 'list':
      return state.ui.list === assertion.object;
    case 'form':
      if (assertion.equals === 'none') return state.ui.draft === null;
      return state.ui.draft?.kind === assertion.equals;
    case 'catalog-item':
      return state[assertion.catalog].some((item) => sameName(item.name, assertion.name));
    case 'document-posted':
      return postedMatches(state, assertion);
    case 'balance': {
      const row = onecBalances(state).find(
        (item) =>
          sameName(item.productName, assertion.product) &&
          sameName(item.warehouseName, assertion.warehouse),
      );
      return close(row?.qty ?? 0, assertion.qty);
    }
    case 'no-posted': {
      const docs = assertion.doc === 'sale' ? state.sales : state.receipts;
      return docs.every((doc) => !doc.posted);
    }
    case 'marked-catalog': {
      const item = state[assertion.catalog].find((row) => sameName(row.name, assertion.name));
      return item !== undefined && item.deletionMark === assertion.marked;
    }
    case 'marked-document': {
      const docs = assertion.doc === 'sale' ? state.sales : state.receipts;
      const doc = docs.find((row) => row.number === assertion.number);
      return doc !== undefined && doc.deletionMark === assertion.marked;
    }
    case 'query-result':
      return queryMatches(state, assertion);
  }
};

export interface OnecGrade {
  ok: boolean;
  steps: { id: string; ok: boolean }[];
  goals: { index: number; kind: string; ok: boolean }[];
}

export interface OnecGradeSpec {
  mode: OnecLabMode;
  seed: OnecSeed;
  steps: readonly OnecStep[];
  goal: readonly OnecGoal[];
}

export const gradeOnecSession = (
  spec: OnecGradeSpec,
  commands: readonly OnecCommand[],
): OnecGrade => {
  let state = createOnecState(spec.seed);
  const latched = new Set<string>();
  const latch = (current: OnecState): void => {
    for (const step of spec.steps) {
      if (latched.has(step.id)) continue;
      if (step.expect.every((item) => expectHolds(current, item))) {
        latched.add(step.id);
      }
    }
  };
  latch(state);
  for (const command of commands) {
    state = applyOnecCommand(state, command);
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
