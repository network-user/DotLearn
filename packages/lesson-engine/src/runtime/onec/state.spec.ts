import { describe, expect, it } from 'vitest';
import type { OnecSeed } from '@dotlearn/contracts';

import { OnecCommandError } from './errors';
import { applyOnecCommand, createOnecState, onecBalances, replayOnec } from './state';

const seed = (): OnecSeed => ({
  today: '2026-03-20',
  counterparties: [],
  products: [{ name: 'Бумага А4' }],
  warehouses: [{ name: 'Основной' }],
  receipts: [],
  sales: [],
});

const posted = () => {
  const state = replayOnec(seed(), [
    { op: 'create-catalog', catalog: 'counterparties', name: 'ООО Ромашка' },
    { op: 'open-new-receipt' },
    { op: 'set-receipt-field', field: 'counterparty', value: 'ООО Ромашка' },
    { op: 'set-receipt-field', field: 'warehouse', value: 'основной' },
    { op: 'add-receipt-line', product: 'бумага а4', qty: 10, price: 100 },
    { op: 'post-receipt' },
  ]);
  return state;
};

describe('onec state', () => {
  it('seeds catalogs and starts on the home section', () => {
    const state = createOnecState(seed());
    expect(state.ui.section).toBe('home');
    expect(state.products[0]?.code).toBe('000001');
    expect(state.receipts).toEqual([]);
  });

  it('posts a receipt and keeps the balance until unpost', () => {
    const state = posted();
    expect(state.receipts[0]?.posted).toBe(true);
    expect(state.receipts[0]?.number).toBe('000001');
    expect(onecBalances(state)).toEqual([
      { productName: 'Бумага А4', warehouseName: 'Основной', qty: 10, sum: 1000 },
    ]);
    const cleared = applyOnecCommand(state, { op: 'unpost-receipt' });
    expect(onecBalances(cleared)).toEqual([]);
    expect(cleared.receipts[0]?.posted).toBe(false);
  });

  it('refuses a second catalog item with the same name and an empty document', () => {
    const withItem = applyOnecCommand(createOnecState(seed()), {
      op: 'create-catalog',
      catalog: 'counterparties',
      name: '  ООО Ромашка ',
    });
    expect(() =>
      applyOnecCommand(withItem, {
        op: 'create-catalog',
        catalog: 'counterparties',
        name: 'ооо ромашка',
      }),
    ).toThrow(OnecCommandError);
    const opened = applyOnecCommand(withItem, { op: 'open-new-receipt' });
    expect(() => applyOnecCommand(opened, { op: 'post-receipt' })).toThrow(OnecCommandError);
    expect(() => applyOnecCommand(opened, { op: 'open-new-receipt' })).toThrow(OnecCommandError);
  });

  it('rejects unknown refs, a save of a posted document, and a missing row', () => {
    const opened = applyOnecCommand(createOnecState(seed()), { op: 'open-new-receipt' });
    expect(() =>
      applyOnecCommand(opened, { op: 'set-receipt-field', field: 'counterparty', value: 'нет' }),
    ).toThrow(OnecCommandError);
    expect(() =>
      applyOnecCommand(opened, { op: 'add-receipt-line', product: 'нет', qty: 1, price: 1 }),
    ).toThrow(OnecCommandError);
    expect(() => applyOnecCommand(opened, { op: 'remove-receipt-line', index: 3 })).toThrow(
      OnecCommandError,
    );
    expect(() => applyOnecCommand(createOnecState(seed()), { op: 'save-receipt' })).toThrow(
      OnecCommandError,
    );
    const state = posted();
    expect(() => applyOnecCommand(state, { op: 'save-receipt' })).toThrow(OnecCommandError);
    const saved = replayOnec(seed(), [
      { op: 'create-catalog', catalog: 'counterparties', name: 'ООО Ромашка' },
      { op: 'open-new-receipt' },
      { op: 'set-receipt-field', field: 'counterparty', value: 'ООО Ромашка' },
      { op: 'set-receipt-field', field: 'warehouse', value: 'Основной' },
      { op: 'add-receipt-line', product: 'Бумага А4', qty: 2, price: 5 },
      { op: 'save-receipt' },
    ]);
    expect(saved.receipts[0]?.posted).toBe(false);
    expect(() => applyOnecCommand(saved, { op: 'unpost-receipt' })).toThrow(OnecCommandError);
    expect(() => applyOnecCommand(saved, { op: 'open-receipt', id: 'missing' })).toThrow(
      OnecCommandError,
    );
  });

  it('refuses a sale that exceeds stock and keeps a deletion mark on a posted receipt', () => {
    const base = replayOnec(seed(), [
      { op: 'create-catalog', catalog: 'counterparties', name: 'ООО Ромашка' },
      { op: 'open-new-receipt' },
      { op: 'set-receipt-field', field: 'counterparty', value: 'ООО Ромашка' },
      { op: 'set-receipt-field', field: 'warehouse', value: 'Основной' },
      { op: 'add-receipt-line', product: 'Бумага А4', qty: 10, price: 100 },
      { op: 'post-receipt' },
    ]);
    const opened = applyOnecCommand(base, { op: 'open-new-sale' });
    const filled = replayOnec(seed(), [
      { op: 'create-catalog', catalog: 'counterparties', name: 'ООО Ромашка' },
      { op: 'open-new-receipt' },
      { op: 'set-receipt-field', field: 'counterparty', value: 'ООО Ромашка' },
      { op: 'set-receipt-field', field: 'warehouse', value: 'Основной' },
      { op: 'add-receipt-line', product: 'Бумага А4', qty: 10, price: 100 },
      { op: 'post-receipt' },
      { op: 'open-new-sale' },
      { op: 'set-sale-field', field: 'counterparty', value: 'ООО Ромашка' },
      { op: 'set-sale-field', field: 'warehouse', value: 'Основной' },
      { op: 'add-sale-line', product: 'Бумага А4', qty: 15, price: 100 },
    ]);
    expect(opened.ui.draft?.kind).toBe('sale');
    expect(() => applyOnecCommand(filled, { op: 'post-sale' })).toThrow(OnecCommandError);
    const sold = replayOnec(seed(), [
      { op: 'create-catalog', catalog: 'counterparties', name: 'ООО Ромашка' },
      { op: 'open-new-receipt' },
      { op: 'set-receipt-field', field: 'counterparty', value: 'ООО Ромашка' },
      { op: 'set-receipt-field', field: 'warehouse', value: 'Основной' },
      { op: 'add-receipt-line', product: 'Бумага А4', qty: 10, price: 100 },
      { op: 'post-receipt' },
      { op: 'open-new-sale' },
      { op: 'set-sale-field', field: 'counterparty', value: 'ООО Ромашка' },
      { op: 'set-sale-field', field: 'warehouse', value: 'Основной' },
      { op: 'add-sale-line', product: 'Бумага А4', qty: 4, price: 100 },
      { op: 'post-sale' },
    ]);
    expect(onecBalances(sold)).toEqual([
      { productName: 'Бумага А4', warehouseName: 'Основной', qty: 6, sum: 600 },
    ]);
    const marked = applyOnecCommand(
      applyOnecCommand(base, { op: 'open-receipt', id: 'receipt-1' }),
      {
        op: 'toggle-mark-doc',
      },
    );
    expect(marked.receipts[0]?.deletionMark).toBe(true);
    expect(marked.receipts[0]?.posted).toBe(true);
    expect(onecBalances(marked)[0]?.qty).toBe(10);
    const queried = applyOnecCommand(sold, {
      op: 'run-query',
      text: 'ВЫБРАТЬ Номенклатура, Количество ИЗ Остатки ГДЕ Склад = "Основной"',
    });
    expect(queried.lastQuery?.rows).toEqual([{ Номенклатура: 'Бумага А4', Количество: 6 }]);
  });

  it('drops an unsaved draft when the section changes and removes a line', () => {
    const opened = applyOnecCommand(createOnecState(seed()), { op: 'open-new-receipt' });
    const withLine = applyOnecCommand(opened, {
      op: 'add-receipt-line',
      product: 'Бумага А4',
      qty: 1,
      price: 0,
    });
    const removed = applyOnecCommand(withLine, { op: 'remove-receipt-line', index: 0 });
    expect(removed.ui.draft?.lines).toEqual([]);
    const closed = applyOnecCommand(removed, { op: 'close-form' });
    expect(closed.ui.draft).toBeNull();
    const home = applyOnecCommand(withLine, { op: 'open-section', section: 'home' });
    expect(home.ui.draft).toBeNull();
    expect(home.receipts).toEqual([]);
  });
});
