import type {
  OnecCatalog,
  OnecCommand,
  OnecDocKind,
  OnecList,
  OnecSection,
  OnecSeed,
} from '@dotlearn/contracts';

import { OnecCommandError } from './errors';
import { runOnecQuery, type QueryRow } from './query';

export interface CatalogItem {
  id: string;
  code: string;
  name: string;
  deletionMark: boolean;
}

export interface ReceiptLine {
  productName: string;
  qty: number;
  price: number;
}

export interface Receipt {
  id: string;
  kind: OnecDocKind;
  number: string;
  date: string;
  posted: boolean;
  deletionMark: boolean;
  counterpartyName: string;
  warehouseName: string;
  lines: ReceiptLine[];
}

export interface ReceiptDraft {
  kind: OnecDocKind;
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
  sales: Receipt[];
  lastQuery: { text: string; rows: QueryRow[] } | null;
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
    deletionMark: false,
  }));

const bucket = (state: OnecState, kind: OnecDocKind): Receipt[] =>
  kind === 'sale' ? state.sales : state.receipts;

const withBucket = (state: OnecState, kind: OnecDocKind, docs: Receipt[]): OnecState =>
  kind === 'sale' ? { ...state, sales: docs } : { ...state, receipts: docs };

const requireNamed = (
  items: readonly CatalogItem[],
  name: string,
  code: string,
  message: string,
): CatalogItem => {
  const found = findNamed(items, name);
  if (!found) throw new OnecCommandError(code, message);
  return found;
};

const materializeDocs = (
  kind: OnecDocKind,
  rows: OnecSeed['receipts'],
  catalogs: Pick<OnecState, 'counterparties' | 'products' | 'warehouses'>,
  today: string,
): Receipt[] =>
  rows.map((row, index) => {
    const counterparty = requireNamed(
      catalogs.counterparties,
      row.counterparty,
      'bad-seed',
      `В начальных данных нет контрагента «${row.counterparty}»`,
    );
    const warehouse = requireNamed(
      catalogs.warehouses,
      row.warehouse,
      'bad-seed',
      `В начальных данных нет склада «${row.warehouse}»`,
    );
    const lines = row.lines.map((line) => {
      const product = requireNamed(
        catalogs.products,
        line.product,
        'bad-seed',
        `В начальных данных нет номенклатуры «${line.product}»`,
      );
      return { productName: product.name, qty: line.qty, price: line.price };
    });
    return {
      id: `${kind}-${index + 1}`,
      kind,
      number: codeOf(index),
      date: today,
      posted: row.posted,
      deletionMark: row.deletionMark,
      counterpartyName: counterparty.name,
      warehouseName: warehouse.name,
      lines,
    };
  });

const sectionOfList = (object: OnecList): OnecSection => {
  if (object === 'receipts' || object === 'sales') return 'documents';
  if (object === 'balances') return 'reports';
  return 'catalogs';
};

const catalogItems = (state: OnecState, catalog: OnecCatalog): CatalogItem[] => state[catalog];

export const createOnecState = (seed: OnecSeed): OnecState => {
  const catalogs = {
    counterparties: materialize('counterparty', seed.counterparties),
    products: materialize('product', seed.products),
    warehouses: materialize('warehouse', seed.warehouses),
  };
  return {
    today: seed.today,
    ...catalogs,
    receipts: materializeDocs('receipt', seed.receipts, catalogs, seed.today),
    sales: materializeDocs('sale', seed.sales, catalogs, seed.today),
    lastQuery: null,
    ui: { section: 'home', list: null, draft: null },
  };
};

const requireDraft = (state: OnecState, kind?: OnecDocKind): ReceiptDraft => {
  const draft = state.ui.draft;
  if (!draft || (kind !== undefined && draft.kind !== kind)) {
    throw new OnecCommandError(
      'no-draft',
      kind === 'sale' ? 'Сначала откройте реализацию' : 'Сначала откройте документ',
    );
  }
  return draft;
};

const withDraft = (state: OnecState, draft: ReceiptDraft): OnecState => ({
  ...state,
  ui: {
    ...state.ui,
    section: 'documents',
    list: draft.kind === 'sale' ? 'sales' : 'receipts',
    draft,
  },
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
    ? bucket(state, draft.kind).find((doc) => doc.id === draft.persistedId)
    : undefined;

const ensureUsable = (item: CatalogItem, label: string): void => {
  if (item.deletionMark) {
    throw new OnecCommandError('marked', `${label} «${item.name}» помечен на удаление`);
  }
};

const stockWithout = (state: OnecState, ignoreId: string | null): BalanceRow[] => {
  const shadow: OnecState = {
    ...state,
    sales: state.sales.map((doc) => (doc.id === ignoreId ? { ...doc, posted: false } : doc)),
    receipts: state.receipts.map((doc) => (doc.id === ignoreId ? { ...doc, posted: false } : doc)),
  };
  return onecBalances(shadow);
};

const assertStock = (state: OnecState, draft: ReceiptDraft): void => {
  if (draft.kind !== 'sale') return;
  const available = stockWithout(state, draft.persistedId);
  const needed = new Map<string, number>();
  for (const line of draft.lines) {
    const key = `${line.productName}\0${draft.warehouseName}`;
    needed.set(key, (needed.get(key) ?? 0) + line.qty);
  }
  for (const [key, qty] of needed) {
    const [productName, warehouseName] = key.split('\0');
    const row = available.find(
      (item) => item.productName === productName && item.warehouseName === warehouseName,
    );
    if ((row?.qty ?? 0) + 1e-9 < qty) {
      throw new OnecCommandError(
        'negative-stock',
        `Не хватает «${productName}» на складе «${warehouseName}». В наличии ${row?.qty ?? 0}`,
      );
    }
  }
};

const writeDoc = (state: OnecState, draft: ReceiptDraft, posted: boolean): OnecState => {
  requireHeader(draft);
  const counterparty = requireNamed(
    state.counterparties,
    draft.counterpartyName,
    'unknown-counterparty',
    'Нет такого контрагента',
  );
  const warehouse = requireNamed(
    state.warehouses,
    draft.warehouseName,
    'unknown-warehouse',
    'Нет такого склада',
  );
  if (posted) {
    ensureUsable(counterparty, 'Контрагент');
    ensureUsable(warehouse, 'Склад');
    for (const line of draft.lines) {
      const product = requireNamed(
        state.products,
        line.productName,
        'unknown-product',
        'Нет такой номенклатуры',
      );
      ensureUsable(product, 'Номенклатура');
    }
    assertStock(state, draft);
  }
  const docs = bucket(state, draft.kind);
  if (draft.persistedId) {
    const current = persistedOf(state, draft);
    if (current?.posted && !posted) {
      throw new OnecCommandError('still-posted', 'Сначала отмените проведение');
    }
    const next = docs.map((doc) =>
      doc.id === draft.persistedId
        ? {
            ...doc,
            posted,
            counterpartyName: draft.counterpartyName,
            warehouseName: draft.warehouseName,
            lines: draft.lines,
          }
        : doc,
    );
    return withDraft(withBucket(state, draft.kind, next), draft);
  }
  const id = `${draft.kind}-${docs.length + 1}`;
  const doc: Receipt = {
    id,
    kind: draft.kind,
    number: draft.number,
    date: draft.date,
    posted,
    deletionMark: false,
    counterpartyName: draft.counterpartyName,
    warehouseName: draft.warehouseName,
    lines: draft.lines,
  };
  return withDraft(withBucket(state, draft.kind, [...docs, doc]), { ...draft, persistedId: id });
};

const openNew = (state: OnecState, kind: OnecDocKind): OnecState => {
  if (state.ui.draft && state.ui.draft.persistedId === null) {
    throw new OnecCommandError('draft-open', 'Сначала запишите или закройте текущий документ');
  }
  return withDraft(state, {
    kind,
    number: codeOf(bucket(state, kind).length),
    date: state.today,
    counterpartyName: '',
    warehouseName: '',
    lines: [],
    persistedId: null,
  });
};

const openExisting = (state: OnecState, kind: OnecDocKind, id: string): OnecState => {
  const doc = bucket(state, kind).find((item) => item.id === id);
  if (!doc) throw new OnecCommandError('missing-receipt', 'Документ не найден');
  return withDraft(state, {
    kind,
    number: doc.number,
    date: doc.date,
    counterpartyName: doc.counterpartyName,
    warehouseName: doc.warehouseName,
    lines: doc.lines,
    persistedId: doc.id,
  });
};

const setField = (
  state: OnecState,
  kind: OnecDocKind,
  field: 'counterparty' | 'warehouse',
  raw: string,
): OnecState => {
  const draft = requireDraft(state, kind);
  const value = raw.trim();
  if (field === 'counterparty') {
    const found = requireNamed(
      state.counterparties,
      value,
      'unknown-counterparty',
      'Нет такого контрагента',
    );
    return withDraft(state, { ...draft, counterpartyName: found.name });
  }
  const found = requireNamed(state.warehouses, value, 'unknown-warehouse', 'Нет такого склада');
  return withDraft(state, { ...draft, warehouseName: found.name });
};

const addLine = (
  state: OnecState,
  kind: OnecDocKind,
  productName: string,
  qty: number,
  price: number,
): OnecState => {
  const draft = requireDraft(state, kind);
  const product = requireNamed(
    state.products,
    productName,
    'unknown-product',
    'Нет такой номенклатуры',
  );
  if (!(qty > 0)) throw new OnecCommandError('bad-qty', 'Количество должно быть больше нуля');
  if (price < 0) throw new OnecCommandError('bad-price', 'Цена не может быть отрицательной');
  return withDraft(state, {
    ...draft,
    lines: [...draft.lines, { productName: product.name, qty, price }],
  });
};

const removeLine = (state: OnecState, kind: OnecDocKind, index: number): OnecState => {
  const draft = requireDraft(state, kind);
  if (index >= draft.lines.length) {
    throw new OnecCommandError('bad-index', 'Нет строки с таким номером');
  }
  return withDraft(state, {
    ...draft,
    lines: draft.lines.filter((_, lineIndex) => lineIndex !== index),
  });
};

const unpost = (state: OnecState, kind: OnecDocKind): OnecState => {
  const draft = requireDraft(state, kind);
  const current = persistedOf(state, draft);
  if (!current) throw new OnecCommandError('not-saved', 'Документ ещё не записан');
  if (!current.posted) throw new OnecCommandError('not-posted', 'Документ не проведён');
  const next = bucket(state, kind).map((doc) =>
    doc.id === current.id ? { ...doc, posted: false } : doc,
  );
  return withDraft(withBucket(state, kind, next), draft);
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
      if (name === '') throw new OnecCommandError('empty-name', 'Заполните наименование');
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
        deletionMark: false,
      };
      return { ...state, [command.catalog]: [...items, created] };
    }
    case 'toggle-mark-catalog': {
      const items = catalogItems(state, command.catalog);
      const found = findNamed(items, command.name);
      if (!found) throw new OnecCommandError('missing-item', 'Элемент не найден');
      return {
        ...state,
        [command.catalog]: items.map((item) =>
          item.id === found.id ? { ...item, deletionMark: !item.deletionMark } : item,
        ),
      };
    }
    case 'toggle-mark-doc': {
      const draft = requireDraft(state);
      const current = persistedOf(state, draft);
      if (!current) throw new OnecCommandError('not-saved', 'Документ ещё не записан');
      const next = bucket(state, draft.kind).map((doc) =>
        doc.id === current.id ? { ...doc, deletionMark: !doc.deletionMark } : doc,
      );
      return withDraft(withBucket(state, draft.kind, next), draft);
    }
    case 'open-new-receipt':
      return openNew(state, 'receipt');
    case 'open-new-sale':
      return openNew(state, 'sale');
    case 'open-receipt':
      return openExisting(state, 'receipt', command.id);
    case 'open-sale':
      return openExisting(state, 'sale', command.id);
    case 'set-receipt-field':
      return setField(state, 'receipt', command.field, command.value);
    case 'set-sale-field':
      return setField(state, 'sale', command.field, command.value);
    case 'add-receipt-line':
      return addLine(state, 'receipt', command.product, command.qty, command.price);
    case 'add-sale-line':
      return addLine(state, 'sale', command.product, command.qty, command.price);
    case 'remove-receipt-line':
      return removeLine(state, 'receipt', command.index);
    case 'remove-sale-line':
      return removeLine(state, 'sale', command.index);
    case 'save-receipt':
      return writeDoc(state, requireDraft(state, 'receipt'), false);
    case 'save-sale':
      return writeDoc(state, requireDraft(state, 'sale'), false);
    case 'post-receipt':
      return writeDoc(state, requireDraft(state, 'receipt'), true);
    case 'post-sale':
      return writeDoc(state, requireDraft(state, 'sale'), true);
    case 'unpost-receipt':
      return unpost(state, 'receipt');
    case 'unpost-sale':
      return unpost(state, 'sale');
    case 'run-query':
      return {
        ...state,
        lastQuery: {
          text: command.text,
          rows: runOnecQuery(
            { balances: onecBalances(state), receipts: state.receipts, sales: state.sales },
            command.text,
          ),
        },
      };
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

const addMovement = (
  rows: Map<string, BalanceRow>,
  productName: string,
  warehouseName: string,
  qty: number,
  sum: number,
): void => {
  const key = `${productName}\0${warehouseName}`;
  const current = rows.get(key) ?? { productName, warehouseName, qty: 0, sum: 0 };
  current.qty += qty;
  current.sum += sum;
  if (Math.abs(current.qty) < 1e-9 && Math.abs(current.sum) < 1e-9) rows.delete(key);
  else rows.set(key, current);
};

export const onecBalances = (state: OnecState): BalanceRow[] => {
  const rows = new Map<string, BalanceRow>();
  for (const doc of state.receipts) {
    if (!doc.posted) continue;
    for (const line of doc.lines) {
      addMovement(rows, line.productName, doc.warehouseName, line.qty, line.qty * line.price);
    }
  }
  for (const doc of state.sales) {
    if (!doc.posted) continue;
    for (const line of doc.lines) {
      addMovement(rows, line.productName, doc.warehouseName, -line.qty, -line.qty * line.price);
    }
  }
  return [...rows.values()];
};

export const draftReceipt = (state: OnecState): Receipt | null => {
  const id = state.ui.draft?.persistedId;
  const kind = state.ui.draft?.kind;
  if (!id || !kind) return null;
  return bucket(state, kind).find((doc) => doc.id === id) ?? null;
};
