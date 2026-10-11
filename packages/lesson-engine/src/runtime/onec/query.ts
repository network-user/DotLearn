import { OnecCommandError } from './errors';

export type QueryValue = string | number | boolean;
export type QueryRow = Record<string, QueryValue>;

export interface QueryDoc {
  number: string;
  date: string;
  posted: boolean;
  deletionMark: boolean;
  counterpartyName: string;
  warehouseName: string;
}

export interface QueryBalance {
  productName: string;
  warehouseName: string;
  qty: number;
  sum: number;
}

export interface QuerySource {
  balances: readonly QueryBalance[];
  receipts: readonly QueryDoc[];
  sales: readonly QueryDoc[];
}

const COLUMNS = {
  Остатки: ['Номенклатура', 'Склад', 'Количество', 'Сумма'],
  Поступления: ['Номер', 'Дата', 'Контрагент', 'Склад', 'Проведен', 'Пометка'],
  Реализации: ['Номер', 'Дата', 'Контрагент', 'Склад', 'Проведен', 'Пометка'],
} as const;

type SourceName = keyof typeof COLUMNS;

const QUERY_PATTERN =
  /^\s*выбрать\s+(.+?)\s+из\s+(остатки|поступления|реализации)(?:\s+где\s+([a-zа-яё0-9_]+)\s*=\s*(?:"([^"]*)"|(-?\d+(?:\.\d+)?)|(да|нет)))?\s*$/i;

const sourceName = (raw: string): SourceName => {
  const found = (Object.keys(COLUMNS) as SourceName[]).find(
    (item) => item.toLowerCase() === raw.toLowerCase(),
  );
  if (!found) throw new OnecCommandError('bad-query', `Неизвестная таблица «${raw}»`);
  return found;
};

const docRows = (docs: readonly QueryDoc[]): QueryRow[] =>
  docs.map((doc) => ({
    Номер: doc.number,
    Дата: doc.date,
    Контрагент: doc.counterpartyName,
    Склад: doc.warehouseName,
    Проведен: doc.posted,
    Пометка: doc.deletionMark,
  }));

const sourceRows = (source: QuerySource, name: SourceName): QueryRow[] => {
  if (name === 'Остатки') {
    return source.balances.map((row) => ({
      Номенклатура: row.productName,
      Склад: row.warehouseName,
      Количество: row.qty,
      Сумма: row.sum,
    }));
  }
  return docRows(name === 'Поступления' ? source.receipts : source.sales);
};

const sameText = (left: string, right: string): boolean =>
  left.trim().toLowerCase() === right.trim().toLowerCase();

const matchesWhere = (
  row: QueryRow,
  field: string,
  expected: QueryValue,
  columns: readonly string[],
): boolean => {
  const column = columns.find((item) => item.toLowerCase() === field.toLowerCase());
  if (!column) throw new OnecCommandError('bad-query', `В таблице нет поля «${field}»`);
  const actual = row[column];
  if (typeof expected === 'number' && typeof actual === 'number') {
    return Math.abs(actual - expected) < 1e-9;
  }
  if (typeof expected === 'boolean') return actual === expected;
  return sameText(String(actual ?? ''), String(expected));
};

export const runOnecQuery = (source: QuerySource, text: string): QueryRow[] => {
  const match = QUERY_PATTERN.exec(text.trim());
  if (!match) {
    throw new OnecCommandError(
      'bad-query',
      'Запрос: ВЫБРАТЬ поля ИЗ Остатки|Поступления|Реализации [ГДЕ Поле = "текст"]',
    );
  }
  const name = sourceName(match[2] ?? '');
  const columns = COLUMNS[name];
  let rows = sourceRows(source, name);
  if (match[3]) {
    const expected: QueryValue =
      match[6] !== undefined
        ? match[6].toLowerCase() === 'да'
        : match[5] !== undefined
          ? Number(match[5])
          : (match[4] ?? '');
    rows = rows.filter((row) => matchesWhere(row, match[3] ?? '', expected, columns));
  }
  const fieldList = (match[1] ?? '').trim();
  if (fieldList === '*') return rows;
  const fields = fieldList
    .split(',')
    .map((field) => field.trim())
    .filter((field) => field.length > 0);
  if (fields.length === 0) throw new OnecCommandError('bad-query', 'Укажите поля после ВЫБРАТЬ');
  const resolved = fields.map((field) => {
    const column = columns.find((item) => item.toLowerCase() === field.toLowerCase());
    if (!column) throw new OnecCommandError('bad-query', `В таблице нет поля «${field}»`);
    return column;
  });
  return rows.map((row) => {
    const projected: QueryRow = {};
    for (const column of resolved) {
      const value = row[column];
      if (value !== undefined) projected[column] = value;
    }
    return projected;
  });
};
