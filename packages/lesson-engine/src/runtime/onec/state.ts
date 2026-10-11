import type {
  OnecCatalog,
  OnecCommand,
  OnecList,
  OnecSection,
  OnecSeed,
} from '@dotlearn/contracts';

import { OnecCommandError } from './errors';

export interface CatalogItem {
  id: string;
  code: string;
  name: string;
}

export interface ReceiptLine {
  productName: string;
  qty: number;
  price: number;
}

export interface Receipt {
  id: string;
  number: string;
  date: string;
  posted: boolean;
  counterpartyName: string;
  warehouseName: string;
  lines: ReceiptLine[];
}

export interface ReceiptDraft {
  number: string;
  date: string;
  counterpartyName: string;
  warehouseName: string;
  lines: ReceiptLine[];
  persistedId: string | null;
}

export interface OnecUi {
  section: OnecSection;
  list: OnecList | null;
  draft: ReceiptDraft | null;
}

export interface OnecState {
  today: string;
  counterparties: CatalogItem[];
  products: CatalogItem[];
  warehouses: CatalogItem[];
  receipts: Receipt[];
  ui: OnecUi;
}

export interface BalanceRow {
  productName: string;
  warehouseName: string;
  qty: number;
  sum: number;
}

const codeOf = (index: number): string => String(index + 1).padStart(6, '0');

const sameName = (left: string, right: string): boolean =>
  left.trim().toLowerCase() === right.trim().toLowerCase();

const findNamed = (items: readonly CatalogItem[], name: string): CatalogItem | undefined =>
  items.find((item) => sameName(item.name, name));

const materialize = (prefix: string, rows: readonly { name: string }[]): CatalogItem[] =>
  rows.map((row, index) => ({
    id: `${prefix}-${index + 1}`,
    code: codeOf(index),
    name: row.name.trim(),
  }));

const sectionOfList = (object: OnecList): OnecSection => {
  if (object === 'receipts') return 'documents';
  if (object === 'balances') return 'reports';
  return 'catalogs';
};

const catalogItems = (state: OnecState, catalog: OnecCatalog): CatalogItem[] => state[catalog];

export const createOnecState = (seed: OnecSeed): OnecState => ({
  today: seed.today,
  counterparties: materialize('counterparty', seed.counterparties),
  products: materialize('product', seed.products),
  warehouses: materialize('warehouse', seed.warehouses),
  receipts: [],
  ui: { section: 'home', list: null, draft: null },
});

const requireDraft = (state: OnecState): ReceiptDraft => {
  if (!state.ui.draft) {
    throw new OnecCommandError('no-draft', 'Сначала откройте документ');
  }
  return state.ui.draft;
};

const withDraft = (state: OnecState, draft: ReceiptDraft): OnecState => ({
  ...state,
  ui: { ...state.ui, section: 'documents', list: 'receipts', draft },
});

const requireHeader = (draft: ReceiptDraft): void => {
  if (!draft.counterpartyName) {
    throw new OnecCommandError('no-counterparty', 'Укажите контрагента');
  }
  if (!draft.warehouseName) {
    throw new OnecCommandError('no-warehouse', 'Укажите склад');
  }
  if (draft.lines.length === 0) {
    throw new OnecCommandError('no-lines', 'Добавьте хотя бы одну строку товаров');
  }
};

const persistedOf = (state: OnecState, draft: ReceiptDraft): Receipt | undefined =>
  draft.persistedId
    ? state.receipts.find((receipt) => receipt.id === draft.persistedId)
    : undefined;

const writeReceipt = (state: OnecState, draft: ReceiptDraft, posted: boolean): OnecState => {
  requireHeader(draft);
  if (draft.persistedId) {
    const current = persistedOf(state, draft);
    if (current?.posted && !posted) {
      throw new OnecCommandError('still-posted', 'Сначала отмените проведение');
    }
    const next = state.receipts.map((receipt) =>
      receipt.id === draft.persistedId
        ? {
            ...receipt,
            posted,
            counterpartyName: draft.counterpartyName,
            warehouseName: draft.warehouseName,
            lines: draft.lines,
          }
        : receipt,
    );
    return { ...withDraft(state, draft), receipts: next };
  }
  const id = `receipt-${state.receipts.length + 1}`;
  const receipt: Receipt = {
    id,
    number: draft.number,
    date: draft.date,
    posted,
    counterpartyName: draft.counterpartyName,
    warehouseName: draft.warehouseName,
    lines: draft.lines,
  };
  return {
    ...withDraft(state, { ...draft, persistedId: id }),
    receipts: [...state.receipts, receipt],
  };
};

export const applyOnecCommand = (state: OnecState, command: OnecCommand): OnecState => {
  switch (command.op) {
    case 'open-section':
      return { ...state, ui: { section: command.section, list: null, draft: null } };
    case 'open-list':
      return {
        ...state,
        ui: { section: sectionOfList(command.object), list: command.object, draft: null },
      };
    case 'create-catalog': {
      const name = command.name.trim();
      if (name === '') {
        throw new OnecCommandError('empty-name', 'Заполните наименование');
      }
      const items = catalogItems(state, command.catalog);
      if (items.some((item) => sameName(item.name, name))) {
        throw new OnecCommandError('duplicate-name', 'Элемент с таким наименованием уже есть');
      }
      const prefix =
        command.catalog === 'counterparties'
          ? 'counterparty'
          : command.catalog === 'products'
            ? 'product'
            : 'warehouse';
      const created: CatalogItem = {
        id: `${prefix}-${items.length + 1}`,
        code: codeOf(items.length),
        name,
      };
      return { ...state, [command.catalog]: [...items, created] };
    }
    case 'open-new-receipt': {
      if (state.ui.draft && state.ui.draft.persistedId === null) {
        throw new OnecCommandError('draft-open', 'Сначала запишите или закройте текущий документ');
      }
      return withDraft(state, {
        number: codeOf(state.receipts.length),
        date: state.today,
        counterpartyName: '',
        warehouseName: '',
        lines: [],
        persistedId: null,
      });
    }
    case 'open-receipt': {
      const receipt = state.receipts.find((item) => item.id === command.id);
      if (!receipt) {
        throw new OnecCommandError('missing-receipt', 'Документ не найден');
      }
      return withDraft(state, {
        number: receipt.number,
        date: receipt.date,
        counterpartyName: receipt.counterpartyName,
        warehouseName: receipt.warehouseName,
        lines: receipt.lines,
        persistedId: receipt.id,
      });
    }
    case 'set-receipt-field': {
      const draft = requireDraft(state);
      const value = command.value.trim();
      if (command.field === 'counterparty') {
        const found = findNamed(state.counterparties, value);
        if (!found) {
          throw new OnecCommandError('unknown-counterparty', 'Нет такого контрагента');
        }
        return withDraft(state, { ...draft, counterpartyName: found.name });
      }
      const found = findNamed(state.warehouses, value);
      if (!found) {
        throw new OnecCommandError('unknown-warehouse', 'Нет такого склада');
      }
      return withDraft(state, { ...draft, warehouseName: found.name });
    }
    case 'add-receipt-line': {
      const draft = requireDraft(state);
      const product = findNamed(state.products, command.product);
      if (!product) {
        throw new OnecCommandError('unknown-product', 'Нет такой номенклатуры');
      }
      if (!(command.qty > 0)) {
        throw new OnecCommandError('bad-qty', 'Количество должно быть больше нуля');
      }
      if (command.price < 0) {
        throw new OnecCommandError('bad-price', 'Цена не может быть отрицательной');
      }
      return withDraft(state, {
        ...draft,
        lines: [
          ...draft.lines,
          { productName: product.name, qty: command.qty, price: command.price },
        ],
      });
    }
    case 'remove-receipt-line': {
      const draft = requireDraft(state);
      if (command.index >= draft.lines.length) {
        throw new OnecCommandError('bad-index', 'Нет строки с таким номером');
      }
      return withDraft(state, {
        ...draft,
        lines: draft.lines.filter((_, index) => index !== command.index),
      });
    }
    case 'save-receipt':
      return writeReceipt(state, requireDraft(state), false);
    case 'post-receipt':
      return writeReceipt(state, requireDraft(state), true);
    case 'unpost-receipt': {
      const draft = requireDraft(state);
      const current = persistedOf(state, draft);
      if (!current) {
        throw new OnecCommandError('not-saved', 'Документ ещё не записан');
      }
      if (!current.posted) {
        throw new OnecCommandError('not-posted', 'Документ не проведён');
      }
      return {
        ...withDraft(state, draft),
        receipts: state.receipts.map((receipt) =>
          receipt.id === current.id ? { ...receipt, posted: false } : receipt,
        ),
      };
    }
    case 'close-form':
      return { ...state, ui: { ...state.ui, draft: null } };
  }
};

export const replayOnec = (seed: OnecSeed, commands: readonly OnecCommand[]): OnecState => {
  let state = createOnecState(seed);
  for (const command of commands) {
    state = applyOnecCommand(state, command);
  }
  return state;
};

export const onecBalances = (state: OnecState): BalanceRow[] => {
  const rows = new Map<string, BalanceRow>();
  for (const receipt of state.receipts) {
    if (!receipt.posted) continue;
    for (const line of receipt.lines) {
      const key = `${line.productName}\0${receipt.warehouseName}`;
      const current = rows.get(key) ?? {
        productName: line.productName,
        warehouseName: receipt.warehouseName,
        qty: 0,
        sum: 0,
      };
      current.qty += line.qty;
      current.sum += line.qty * line.price;
      rows.set(key, current);
    }
  }
  return [...rows.values()];
};

export const draftReceipt = (state: OnecState): Receipt | null => {
  const id = state.ui.draft?.persistedId;
  if (!id) return null;
  return state.receipts.find((receipt) => receipt.id === id) ?? null;
};
