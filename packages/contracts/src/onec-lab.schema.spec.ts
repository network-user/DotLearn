import { describe, expect, it } from 'vitest';

import { Exercise, isOnecLab, OnecCommand } from './exercise.schema';

const valid = {
  id: 'first-receipt',
  concept: 'screens',
  difficulty: 2,
  prompt: 'Проведите поступление бумаги',
  type: 'onec-lab',
  mode: 'hybrid',
  seed: {
    today: '2026-03-20',
    products: [{ name: 'Бумага А4' }],
    warehouses: [{ name: 'Основной' }],
  },
  steps: [
    {
      id: 'open-catalogs',
      title: 'Откройте справочники',
      coach: 'Панель разделов переключает области учёта.',
      focus: 'sections',
      expect: [{ kind: 'section', equals: 'catalogs' }],
    },
  ],
  goal: [
    {
      kind: 'balance',
      product: 'Бумага А4',
      warehouse: 'Основной',
      qty: 10,
    },
  ],
  solution: [{ op: 'open-section', section: 'catalogs' }, { op: 'post-receipt' }],
};

describe('OnecLabExercise schema', () => {
  it('parses a lab and fills empty catalogs', () => {
    const result = Exercise.safeParse(valid);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(isOnecLab(result.data)).toBe(true);
    if (result.data.type !== 'onec-lab') return;
    expect(result.data.seed.counterparties).toEqual([]);
  });

  it('rejects an unknown command and a lab without a goal', () => {
    expect(OnecCommand.safeParse({ op: 'drop-database' }).success).toBe(false);
    expect(Exercise.safeParse({ ...valid, goal: [] }).success).toBe(false);
    expect(Exercise.safeParse({ ...valid, mode: 'free' }).success).toBe(false);
  });
});
