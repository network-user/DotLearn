import type { z } from 'zod';

import type {
  DesignerCatalogMeta,
  DesignerCommand,
  DesignerDimension,
  DesignerDocumentMeta,
  DesignerField,
  DesignerGuard,
  DesignerMovement,
  DesignerRegisterMeta,
  DesignerValue,
} from '@dotlearn/contracts';
import { DesignerSeed, type DesignerScreen } from '@dotlearn/contracts';

import { DesignerCommandError } from './errors';

const NAME = 'Наименование';
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export interface ItemRow {
  id: string;
  catalog: string;
  name: string;
  values: Record<string, DesignerValue>;
}

export interface DocRow {
  id: string;
  document: string;
  number: string;
  posted: boolean;
  values: Record<string, DesignerValue>;
}

export interface Draft {
  kind: 'item' | 'doc';
  object: string;
  name: string;
  number: string;
  values: Record<string, DesignerValue>;
  persistedId: string | null;
}

export interface DesignerUi {
  mode: DesignerScreen;
  list: string | null;
  draft: Draft | null;
}

export interface DesignerState {
  today: string;
  catalogs: DesignerCatalogMeta[];
  documents: DesignerDocumentMeta[];
  registers: DesignerRegisterMeta[];
  items: ItemRow[];
  docs: DocRow[];
  ui: DesignerUi;
}

export interface BalanceLine {
  register: string;
  dims: { name: string; value: string }[];
  qty: number;
}

const same = (left: string, right: string): boolean =>
  left.trim().toLowerCase() === right.trim().toLowerCase();

const close = (left: number, right: number): boolean => Math.abs(left - right) < 1e-9;

const codeOf = (index: number): string => String(index + 1).padStart(6, '0');

function fail(code: string, message: string): never {
  throw new DesignerCommandError(code, message);
}

const blank = (today: string): DesignerState => ({
  today,
  catalogs: [],
  documents: [],
  registers: [],
  items: [],
  docs: [],
  ui: { mode: 'designer', list: null, draft: null },
});

const findCatalog = (state: DesignerState, name: string): DesignerCatalogMeta | undefined =>
  state.catalogs.find((item) => same(item.name, name));

const findDocument = (state: DesignerState, name: string): DesignerDocumentMeta | undefined =>
  state.documents.find((item) => same(item.name, name));

const findRegister = (state: DesignerState, name: string): DesignerRegisterMeta | undefined =>
  state.registers.find((item) => same(item.name, name));

const objectTaken = (state: DesignerState, name: string): boolean =>
  Boolean(findCatalog(state, name) || findDocument(state, name) || findRegister(state, name));

const fieldsOf = (state: DesignerState, objectName: string): DesignerField[] | undefined => {
  const catalog = findCatalog(state, objectName);
  if (catalog) return catalog.fields;
  return findDocument(state, objectName)?.fields;
};

const withDraft = (state: DesignerState, draft: Draft): DesignerState => ({
  ...state,
  ui: { mode: 'enterprise', list: draft.object, draft },
});

const clearDraft = (state: DesignerState, list: string): DesignerState => ({
  ...state,
  ui: { mode: 'enterprise', list, draft: null },
});

const requireDraft = (state: DesignerState): Draft => {
  if (!state.ui.draft) fail('no-draft', 'Сначала создайте элемент или документ');
  return state.ui.draft;
};

const fieldByName = (fields: readonly DesignerField[], name: string): DesignerField | undefined =>
  fields.find((field) => same(field.name, name));

const canonicalEnum = (field: DesignerField, raw: string): string => {
  const found = field.enumValues?.find((item) => same(item, raw));
  if (!found) fail('bad-enum', `«${field.name}» не принимает значение «${raw}»`);
  return found;
};

const canonicalRef = (state: DesignerState, field: DesignerField, raw: string): string => {
  const catalog = field.ref ? findCatalog(state, field.ref) : undefined;
  if (!catalog || !field.ref) fail('bad-ref', `Реквизит «${field.name}» никуда не ссылается`);
  const item = state.items.find((row) => same(row.catalog, catalog.name) && same(row.name, raw));
  if (!item) fail('missing-ref', `В «${catalog.name}» нет «${raw}»`);
  return item.name;
};

const coerce = (
  state: DesignerState,
  field: DesignerField,
  value: DesignerValue,
): DesignerValue => {
  if (field.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      fail('bad-number', `«${field.name}» должно быть числом`);
    }
    if (value < 0) fail('bad-number', `«${field.name}» не может быть отрицательным`);
    return value;
  }
  if (typeof value !== 'string') fail('bad-value', `«${field.name}» должно быть строкой`);
  const text = value.trim();
  if (text === '') fail('empty', `Заполните «${field.name}»`);
  if (field.type === 'datetime') {
    if (!TIME.test(text))
      fail('bad-time', `«${field.name}» ждёт дату и время, например 2024-06-03T08:00`);
    return text;
  }
  if (field.type === 'enum') return canonicalEnum(field, text);
  if (field.type === 'ref') return canonicalRef(state, field, text);
  return text;
};

const requireComplete = (state: DesignerState, draft: Draft): Record<string, DesignerValue> => {
  const fields = fieldsOf(state, draft.object);
  if (!fields) fail('missing-object', 'Объект не найден');
  const values: Record<string, DesignerValue> = {};
  for (const field of fields) {
    const raw = draft.values[field.name];
    if (raw === undefined) fail('empty', `Заполните «${field.name}»`);
    values[field.name] = coerce(state, field, raw);
  }
  return values;
};

const minutesBetween = (start: string, end: string): number => {
  if (!TIME.test(start) || !TIME.test(end))
    fail('bad-time', 'В условии проведения нет даты и времени');
  return (Date.parse(end) - Date.parse(start)) / 60000;
};

const linkedDoc = (state: DesignerState, draft: Draft, guard: DesignerGuard): DocRow => {
  if (guard.kind === 'equals' || guard.kind === 'probe-count') {
    fail('bad-guard', 'Это условие не ищет другой документ');
  }
  const key = draft.values[guard.linkField];
  const found = state.docs.filter(
    (doc) =>
      doc.posted &&
      same(doc.document, guard.document) &&
      same(String(doc.values[guard.keyField] ?? ''), String(key ?? '')),
  );
  const last = found[found.length - 1];
  if (!last) fail('no-link', guard.message);
  return last;
};

const runGuard = (state: DesignerState, draft: Draft, guard: DesignerGuard): void => {
  if (guard.kind === 'equals') {
    const actual = draft.values[guard.field];
    if (!same(String(actual ?? ''), guard.value)) fail('guard', guard.message);
    return;
  }
  if (guard.kind === 'probe-count') {
    const standard = String(draft.values[guard.standardField] ?? '');
    const count = draft.values[guard.countField];
    const rule = guard.rules.find((item) => same(item.standard, standard));
    if (!rule || typeof count !== 'number' || !close(count, rule.count))
      fail('guard', guard.message);
    return;
  }
  const linked = linkedDoc(state, draft, guard);
  if (guard.kind === 'linked-status') {
    if (!same(String(linked.values[guard.statusField] ?? ''), guard.value))
      fail('guard', guard.message);
    return;
  }
  const elapsed = minutesBetween(
    String(linked.values[guard.timeField] ?? ''),
    String(draft.values[guard.nowField] ?? ''),
  );
  if (guard.kind === 'linked-min-minutes' && elapsed + 1e-9 < guard.minutes)
    fail('guard', guard.message);
  if (guard.kind === 'linked-max-minutes' && elapsed - 1e-9 > guard.minutes)
    fail('guard', guard.message);
};

const balanceKey = (register: string, dims: { name: string; value: string }[]): string => {
  const ordered = [...dims].sort((left, right) => left.name.localeCompare(right.name, 'ru'));
  return JSON.stringify([register, ordered]);
};

const movementDelta = (
  document: DesignerDocumentMeta,
  values: Record<string, DesignerValue>,
): Map<string, { register: string; dims: { name: string; value: string }[]; qty: number }> => {
  const deltas = new Map<
    string,
    { register: string; dims: { name: string; value: string }[]; qty: number }
  >();
  for (const movement of document.movements) {
    const qty = values[movement.qtyField];
    if (typeof qty !== 'number' || !(qty > 0)) {
      fail('bad-qty', `«${movement.qtyField}» должно быть больше нуля`);
    }
    const dims = movement.dimensions.map((map) => {
      const value = values[map.field];
      if (typeof value !== 'string') fail('bad-move', `Движение не видит «${map.field}»`);
      return { name: map.dimension, value };
    });
    const key = balanceKey(movement.register, dims);
    const signed = movement.direction === 'in' ? qty : -qty;
    const current = deltas.get(key);
    if (current) current.qty += signed;
    else deltas.set(key, { register: movement.register, dims, qty: signed });
  }
  return deltas;
};

export const designerBalances = (state: DesignerState): BalanceLine[] => {
  const totals = new Map<string, BalanceLine>();
  for (const doc of state.docs) {
    if (!doc.posted) continue;
    const meta = findDocument(state, doc.document);
    if (!meta) continue;
    for (const [key, delta] of movementDelta(meta, doc.values)) {
      const current = totals.get(key);
      if (current) current.qty += delta.qty;
      else totals.set(key, { register: delta.register, dims: delta.dims, qty: delta.qty });
    }
  }
  return [...totals.values()].filter((line) => Math.abs(line.qty) > 1e-9);
};

const assertStock = (
  state: DesignerState,
  document: DesignerDocumentMeta,
  values: Record<string, DesignerValue>,
): void => {
  const base = new Map<string, number>();
  for (const line of designerBalances(state)) {
    base.set(balanceKey(line.register, line.dims), line.qty);
  }
  for (const delta of movementDelta(document, values).values()) {
    const key = balanceKey(delta.register, delta.dims);
    const next = (base.get(key) ?? 0) + delta.qty;
    if (next < -1e-9) {
      const label = delta.dims.map((dim) => dim.value).join(' / ');
      fail('negative-stock', `Не хватает «${label}». В наличии ${base.get(key) ?? 0}`);
    }
  }
};

const addObjectName = (state: DesignerState, name: string): string => {
  const trimmed = name.trim();
  if (trimmed === '') fail('empty-name', 'Заполните имя');
  if (objectTaken(state, trimmed)) fail('duplicate-name', `«${trimmed}» уже есть в конфигурации`);
  return trimmed;
};

const requireFieldShape = (
  field: Pick<DesignerField, 'type' | 'ref' | 'enumValues' | 'name'>,
): void => {
  if (same(field.name, NAME))
    fail('reserved', 'Наименование уже есть у каждого элемента справочника');
  if (field.type === 'enum' && !field.enumValues)
    fail('bad-field', 'Для перечисления нужны значения');
  if (field.type !== 'enum' && field.enumValues)
    fail('bad-field', 'Список значений только у перечисления');
  if (field.type === 'ref' && !field.ref) fail('bad-field', 'Укажите справочник ссылки');
  if (field.type !== 'ref' && field.ref) fail('bad-field', 'Справочник ссылки только у ссылки');
};

const pushField = (
  state: DesignerState,
  objectName: string,
  field: DesignerField,
): DesignerState => {
  requireFieldShape(field);
  const trimmed = field.name.trim();
  const catalog = findCatalog(state, objectName);
  const document = findDocument(state, objectName);
  const host = catalog ?? document;
  if (!host) fail('missing-object', 'Реквизит добавляют справочнику или документу');
  if (host.fields.length >= 16) fail('too-many', 'Слишком много реквизитов');
  if (fieldByName(host.fields, trimmed)) fail('duplicate-field', `Реквизит «${trimmed}» уже есть`);
  if (field.type === 'ref') {
    const target = field.ref ? findCatalog(state, field.ref) : undefined;
    if (!target) fail('missing-ref', 'Ссылка ведёт на несуществующий справочник');
    field = { ...field, name: trimmed, ref: target.name };
  } else {
    field = { ...field, name: trimmed };
  }
  if (catalog) {
    return {
      ...state,
      catalogs: state.catalogs.map((item) =>
        item === catalog ? { ...item, fields: [...item.fields, field] } : item,
      ),
    };
  }
  return {
    ...state,
    documents: state.documents.map((item) =>
      item === document ? { ...item, fields: [...item.fields, field] } : item,
    ),
  };
};

const validateMovement = (
  state: DesignerState,
  document: DesignerDocumentMeta,
  movement: DesignerMovement,
): DesignerMovement => {
  const register = findRegister(state, movement.register);
  if (!register) fail('missing-object', 'Нет такого регистра');
  if (register.dimensions.length === 0)
    fail('no-dimensions', 'Сначала добавьте измерения регистра');
  const qty = fieldByName(document.fields, movement.qtyField);
  if (!qty || qty.type !== 'number')
    fail('bad-move', 'Количество движения берётся из числового реквизита');
  if (movement.dimensions.length !== register.dimensions.length) {
    fail('bad-move', 'В движении должны быть все измерения регистра');
  }
  const dimensions = register.dimensions.map((dimension) => {
    const mapped = movement.dimensions.find((item) => same(item.dimension, dimension.name));
    if (!mapped) fail('bad-move', `Нет измерения «${dimension.name}»`);
    const field = fieldByName(document.fields, mapped.field);
    if (!field || field.type !== 'ref' || !field.ref || !same(field.ref, dimension.catalog)) {
      fail('bad-move', `«${mapped.field}» должен ссылаться на «${dimension.catalog}»`);
    }
    return { dimension: dimension.name, field: field.name };
  });
  return { register: register.name, direction: movement.direction, qtyField: qty.name, dimensions };
};

const validateGuard = (
  state: DesignerState,
  document: DesignerDocumentMeta,
  guard: DesignerGuard,
): DesignerGuard => {
  const requireField = (name: string, types: DesignerField['type'][]): DesignerField => {
    const field = fieldByName(document.fields, name);
    if (!field || !types.includes(field.type)) {
      fail('bad-guard', `Условие не находит реквизит «${name}»`);
    }
    return field;
  };
  if (guard.kind === 'equals') {
    requireField(guard.field, ['string', 'enum', 'ref', 'datetime']);
    return guard;
  }
  if (guard.kind === 'probe-count') {
    const standard = requireField(guard.standardField, ['enum']);
    requireField(guard.countField, ['number']);
    for (const rule of guard.rules) {
      if (!standard.enumValues?.some((item) => same(item, rule.standard))) {
        fail('bad-guard', `В перечислении нет стандарта «${rule.standard}»`);
      }
    }
    return guard;
  }
  const other = findDocument(state, guard.document);
  if (!other) fail('bad-guard', 'Условие ссылается на несуществующий документ');
  if (same(other.name, document.name))
    fail('bad-guard', 'Условие не может ссылаться на тот же документ');
  const link = requireField(guard.linkField, ['string', 'enum', 'ref']);
  const key = fieldByName(other.fields, guard.keyField);
  if (!key || key.type !== link.type) fail('bad-guard', 'Ключ связанного документа другого типа');
  if (guard.kind === 'linked-status') {
    const status = fieldByName(other.fields, guard.statusField);
    if (!status || (status.type !== 'enum' && status.type !== 'string')) {
      fail('bad-guard', 'Поле статуса не найдено');
    }
    return {
      ...guard,
      document: other.name,
      linkField: link.name,
      keyField: key.name,
      statusField: status.name,
    };
  }
  requireField(guard.nowField, ['datetime']);
  const time = fieldByName(other.fields, guard.timeField);
  if (!time || time.type !== 'datetime') fail('bad-guard', 'В связанном документе нет даты');
  return {
    ...guard,
    document: other.name,
    linkField: link.name,
    keyField: key.name,
    timeField: time.name,
    nowField: fieldByName(document.fields, guard.nowField)?.name ?? guard.nowField,
  };
};

const writeItem = (state: DesignerState, draft: Draft): DesignerState => {
  const catalog = findCatalog(state, draft.object);
  if (!catalog || draft.kind !== 'item') fail('no-draft', 'Это не элемент справочника');
  const name = draft.name.trim();
  if (name === '') fail('empty', 'Заполните наименование');
  const duplicate = state.items.some(
    (item) =>
      same(item.catalog, catalog.name) && same(item.name, name) && item.id !== draft.persistedId,
  );
  if (duplicate) fail('duplicate-name', 'Элемент с таким наименованием уже есть');
  const values = requireComplete(state, draft);
  if (draft.persistedId) {
    return clearDraft(
      {
        ...state,
        items: state.items.map((item) =>
          item.id === draft.persistedId ? { ...item, name, values } : item,
        ),
      },
      catalog.name,
    );
  }
  const created: ItemRow = {
    id: `item-${state.items.length + 1}`,
    catalog: catalog.name,
    name,
    values,
  };
  return clearDraft({ ...state, items: [...state.items, created] }, catalog.name);
};

const writeDoc = (state: DesignerState, draft: Draft, posted: boolean): DesignerState => {
  const document = findDocument(state, draft.object);
  if (!document || draft.kind !== 'doc') fail('no-draft', 'Это не документ');
  const values = requireComplete(state, draft);
  if (posted) {
    for (const guard of document.guards) runGuard(state, { ...draft, values }, guard);
    assertStock(state, document, values);
  }
  if (draft.persistedId) {
    const current = state.docs.find((doc) => doc.id === draft.persistedId);
    if (current?.posted) fail('still-posted', 'Документ уже проведён');
    return clearDraft(
      {
        ...state,
        docs: state.docs.map((doc) =>
          doc.id === draft.persistedId ? { ...doc, posted, values } : doc,
        ),
      },
      document.name,
    );
  }
  const created: DocRow = {
    id: `doc-${state.docs.length + 1}`,
    document: document.name,
    number: draft.number,
    posted,
    values,
  };
  return clearDraft({ ...state, docs: [...state.docs, created] }, document.name);
};

export const applyDesignerCommand = (
  state: DesignerState,
  command: DesignerCommand,
): DesignerState => {
  switch (command.op) {
    case 'open-mode':
      return { ...state, ui: { mode: command.mode, list: null, draft: null } };
    case 'add-catalog': {
      const name = addObjectName(state, command.name);
      return { ...state, catalogs: [...state.catalogs, { name, fields: [] }] };
    }
    case 'add-document': {
      const name = addObjectName(state, command.name);
      return {
        ...state,
        documents: [...state.documents, { name, fields: [], movements: [], guards: [] }],
      };
    }
    case 'add-register': {
      const name = addObjectName(state, command.name);
      return { ...state, registers: [...state.registers, { name, dimensions: [] }] };
    }
    case 'add-dimension': {
      const register = findRegister(state, command.register);
      if (!register) fail('missing-object', 'Нет такого регистра');
      const catalog = findCatalog(state, command.catalog);
      if (!catalog) fail('missing-object', 'Измерение ссылается на несуществующий справочник');
      const name = command.name.trim();
      if (register.dimensions.some((item) => same(item.name, name))) {
        fail('duplicate-field', 'Такое измерение уже есть');
      }
      if (register.dimensions.length >= 4) fail('too-many', 'Слишком много измерений');
      const dimension: DesignerDimension = { name, catalog: catalog.name };
      return {
        ...state,
        registers: state.registers.map((item) =>
          item === register ? { ...item, dimensions: [...item.dimensions, dimension] } : item,
        ),
      };
    }
    case 'add-field':
      return pushField(state, command.object, {
        name: command.name,
        type: command.type,
        ...(command.ref ? { ref: command.ref } : {}),
        ...(command.enumValues ? { enumValues: command.enumValues } : {}),
      });
    case 'add-movement': {
      const document = findDocument(state, command.document);
      if (!document) fail('missing-object', 'Нет такого документа');
      if (document.movements.length >= 4) fail('too-many', 'Слишком много движений');
      const movement = validateMovement(state, document, {
        register: command.register,
        direction: command.direction,
        qtyField: command.qtyField,
        dimensions: command.dimensions,
      });
      return {
        ...state,
        documents: state.documents.map((item) =>
          item === document ? { ...item, movements: [...item.movements, movement] } : item,
        ),
      };
    }
    case 'add-guard': {
      const document = findDocument(state, command.document);
      if (!document) fail('missing-object', 'Нет такого документа');
      if (document.guards.length >= 6) fail('too-many', 'Слишком много условий');
      const guard = validateGuard(state, document, command.guard);
      return {
        ...state,
        documents: state.documents.map((item) =>
          item === document ? { ...item, guards: [...item.guards, guard] } : item,
        ),
      };
    }
    case 'open-object': {
      if (findRegister(state, command.name)) {
        const register = findRegister(state, command.name) as DesignerRegisterMeta;
        return { ...state, ui: { mode: 'report', list: register.name, draft: null } };
      }
      const catalog = findCatalog(state, command.name);
      const document = findDocument(state, command.name);
      const name = catalog?.name ?? document?.name;
      if (!name) fail('missing-object', 'Нет такого объекта');
      return { ...state, ui: { mode: 'enterprise', list: name, draft: null } };
    }
    case 'open-new': {
      if (state.ui.draft?.persistedId === null)
        fail('draft-open', 'Сначала запишите или закройте текущую форму');
      const catalog = findCatalog(state, command.object);
      const document = findDocument(state, command.object);
      if (catalog) {
        return withDraft(state, {
          kind: 'item',
          object: catalog.name,
          name: '',
          number: '',
          values: {},
          persistedId: null,
        });
      }
      if (!document) fail('missing-object', 'Создавать можно справочник или документ');
      const count = state.docs.filter((doc) => same(doc.document, document.name)).length;
      return withDraft(state, {
        kind: 'doc',
        object: document.name,
        name: '',
        number: codeOf(count),
        values: {},
        persistedId: null,
      });
    }
    case 'set-value': {
      const draft = requireDraft(state);
      if (same(command.field, NAME)) {
        if (draft.kind !== 'item') fail('bad-field', 'У документа нет наименования');
        if (typeof command.value !== 'string' || command.value.trim() === '') {
          fail('empty', 'Заполните наименование');
        }
        return withDraft(state, { ...draft, name: command.value.trim() });
      }
      const fields = fieldsOf(state, draft.object) ?? fail('missing-object', 'Объект не найден');
      const field = fieldByName(fields, command.field);
      if (!field) fail('bad-field', `Нет реквизита «${command.field}»`);
      const value = coerce(state, field, command.value);
      return withDraft(state, {
        ...draft,
        values: { ...draft.values, [field.name]: value },
      });
    }
    case 'save': {
      const draft = requireDraft(state);
      return draft.kind === 'item' ? writeItem(state, draft) : writeDoc(state, draft, false);
    }
    case 'post': {
      const draft = requireDraft(state);
      if (draft.kind !== 'doc') fail('no-draft', 'Проводят только документы');
      return writeDoc(state, draft, true);
    }
    case 'close': {
      if (!state.ui.draft || !state.ui.list) fail('no-draft', 'Форма уже закрыта');
      return clearDraft(state, state.ui.list);
    }
  }
};

export const createDesignerState = (input: z.input<typeof DesignerSeed>): DesignerState => {
  const seed = DesignerSeed.parse(input);
  let state = blank(seed.today);
  for (const catalog of seed.catalogs) {
    state = applyDesignerCommand(state, { op: 'add-catalog', name: catalog.name });
    for (const field of catalog.fields) {
      state = applyDesignerCommand(state, {
        op: 'add-field',
        object: catalog.name,
        name: field.name,
        type: field.type,
        ...(field.ref ? { ref: field.ref } : {}),
        ...(field.enumValues ? { enumValues: field.enumValues } : {}),
      });
    }
  }
  for (const register of seed.registers) {
    state = applyDesignerCommand(state, { op: 'add-register', name: register.name });
    for (const dimension of register.dimensions) {
      state = applyDesignerCommand(state, {
        op: 'add-dimension',
        register: register.name,
        name: dimension.name,
        catalog: dimension.catalog,
      });
    }
  }
  for (const document of seed.documents) {
    state = applyDesignerCommand(state, { op: 'add-document', name: document.name });
    for (const field of document.fields) {
      state = applyDesignerCommand(state, {
        op: 'add-field',
        object: document.name,
        name: field.name,
        type: field.type,
        ...(field.ref ? { ref: field.ref } : {}),
        ...(field.enumValues ? { enumValues: field.enumValues } : {}),
      });
    }
    for (const movement of document.movements) {
      state = applyDesignerCommand(state, {
        op: 'add-movement',
        document: document.name,
        ...movement,
      });
    }
    for (const guard of document.guards) {
      state = applyDesignerCommand(state, { op: 'add-guard', document: document.name, guard });
    }
  }
  for (const item of seed.items) {
    state = applyDesignerCommand(state, { op: 'open-new', object: item.catalog });
    state = applyDesignerCommand(state, { op: 'set-value', field: NAME, value: item.name });
    for (const [field, value] of Object.entries(item.values)) {
      state = applyDesignerCommand(state, { op: 'set-value', field, value });
    }
    state = applyDesignerCommand(state, { op: 'save' });
  }
  for (const doc of seed.docs) {
    state = applyDesignerCommand(state, { op: 'open-new', object: doc.document });
    for (const [field, value] of Object.entries(doc.values)) {
      state = applyDesignerCommand(state, { op: 'set-value', field, value });
    }
    state = applyDesignerCommand(state, { op: doc.posted ? 'post' : 'save' });
  }
  return { ...state, ui: { mode: 'designer', list: null, draft: null } };
};

export const replayDesigner = (
  seed: z.input<typeof DesignerSeed>,
  commands: readonly DesignerCommand[],
): DesignerState => {
  let state = createDesignerState(seed);
  for (const command of commands) state = applyDesignerCommand(state, command);
  return state;
};
