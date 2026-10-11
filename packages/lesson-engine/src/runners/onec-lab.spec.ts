import { describe, expect, it } from 'vitest';
import type { OnecLabExercise } from '@dotlearn/contracts';

import { runOnecLab } from './onec-lab';

const exercise = (): OnecLabExercise => ({
  id: 'first-receipt',
  concept: 'screens',
  type: 'onec-lab',
  difficulty: 2,
  prompt: 'Проведите поступление и откройте остатки',
  mode: 'hybrid',
  seed: {
    today: '2026-03-20',
    counterparties: [],
    products: [{ name: 'Бумага А4' }],
    warehouses: [{ name: 'Основной' }],
  },
  steps: [
    {
      id: 'open-catalogs',
      title: 'Раздел',
      coach: 'Откройте справочники',
      expect: [{ kind: 'section', equals: 'catalogs' }],
    },
  ],
  goal: [
    {
      kind: 'document-posted',
      counterparty: 'ООО Ромашка',
      warehouse: 'Основной',
      lines: [{ product: 'Бумага А4', qty: 10 }],
    },
  ],
  solution: [
    { op: 'open-section', section: 'catalogs' },
    { op: 'create-catalog', catalog: 'counterparties', name: 'ООО Ромашка' },
    { op: 'open-new-receipt' },
    { op: 'set-receipt-field', field: 'counterparty', value: 'ООО Ромашка' },
    { op: 'set-receipt-field', field: 'warehouse', value: 'Основной' },
    { op: 'add-receipt-line', product: 'Бумага А4', qty: 10, price: 100 },
    { op: 'post-receipt' },
  ],
});

describe('runOnecLab', () => {
  it('accepts the gold command list', () => {
    const task = exercise();
    const result = runOnecLab(task, task.solution);
    expect(result.ok).toBe(true);
  });

  it('fails a hybrid task that never opened the section', () => {
    const task = exercise();
    const result = runOnecLab(task, task.solution.slice(1));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('onec-check-unmet');
  });

  it('rejects a command the engine cannot apply', () => {
    const result = runOnecLab(exercise(), [{ op: 'post-receipt' }]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('onec-command-error');
  });

  it('rejects an answer that is not a command list', () => {
    const result = runOnecLab(exercise(), 'post');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('invalid-answer');
  });
});
