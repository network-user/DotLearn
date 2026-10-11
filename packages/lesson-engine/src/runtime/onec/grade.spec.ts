import { describe, expect, it } from 'vitest';
import type { OnecCommand, OnecGoal, OnecSeed, OnecStep } from '@dotlearn/contracts';

import { gradeOnecSession } from './grade';

const seed: OnecSeed = {
  today: '2026-03-20',
  counterparties: [],
  products: [{ name: 'Бумага А4' }],
  warehouses: [{ name: 'Основной' }],
  receipts: [],
  sales: [],
};

const postedGoal = (name: string, qty: number): OnecGoal => ({
  kind: 'document-posted',
  doc: 'receipt',
  posted: true,
  counterparty: name,
  warehouse: 'Основной',
  lines: [{ product: 'Бумага А4', qty }],
});

const steps: OnecStep[] = [
  {
    id: 'open-catalogs',
    title: 'Раздел',
    coach: 'Откройте справочники',
    expect: [{ kind: 'section', equals: 'catalogs' }],
  },
  {
    id: 'balances',
    title: 'Отчёт',
    coach: 'Откройте остатки',
    expect: [
      { kind: 'list', object: 'balances' },
      { kind: 'balance', product: 'Бумага А4', warehouse: 'Основной', qty: 10 },
    ],
  },
];

const solution: OnecCommand[] = [
  { op: 'open-section', section: 'catalogs' },
  { op: 'create-catalog', catalog: 'counterparties', name: 'ООО Ромашка' },
  { op: 'open-new-receipt' },
  { op: 'set-receipt-field', field: 'counterparty', value: 'ООО Ромашка' },
  { op: 'set-receipt-field', field: 'warehouse', value: 'Основной' },
  { op: 'add-receipt-line', product: 'Бумага А4', qty: 10, price: 100 },
  { op: 'post-receipt' },
  { op: 'open-list', object: 'balances' },
];

describe('gradeOnecSession', () => {
  it('passes hybrid mode only when every step latched and the goal holds', () => {
    const spec = {
      mode: 'hybrid' as const,
      seed,
      steps,
      goal: [
        postedGoal('ООО Ромашка', 10),
        { kind: 'balance' as const, product: 'Бумага А4', warehouse: 'Основной', qty: 10 },
      ],
    };
    expect(gradeOnecSession(spec, solution).ok).toBe(true);
    const withoutReport = solution.slice(0, -1);
    const missed = gradeOnecSession(spec, withoutReport);
    expect(missed.ok).toBe(false);
    expect(missed.steps.find((step) => step.id === 'balances')?.ok).toBe(false);
    expect(missed.goals.every((goal) => goal.ok)).toBe(true);
  });

  it('lets snapshot ignore steps and steps ignore the goal', () => {
    const goal = [postedGoal('ООО Ромашка', 10)];
    const commands = solution.slice(0, -1);
    expect(gradeOnecSession({ mode: 'snapshot', seed, steps, goal }, commands).ok).toBe(true);
    expect(gradeOnecSession({ mode: 'steps', seed, steps, goal }, solution).ok).toBe(true);
    expect(
      gradeOnecSession({ mode: 'steps', seed, steps, goal: [postedGoal('чужой', 1)] }, solution).ok,
    ).toBe(true);
  });
});
