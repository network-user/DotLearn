import type { EditorProps } from '@monaco-editor/react';

import { parseSqlFixture } from '@/components/sandbox/parseSqlFixture';

type MonacoApi = Parameters<NonNullable<EditorProps['beforeMount']>>[0];

export const SQL_KEYWORDS: readonly string[] = [
  'SELECT',
  'FROM',
  'WHERE',
  'GROUP BY',
  'HAVING',
  'ORDER BY',
  'LIMIT',
  'OFFSET',
  'DISTINCT',
  'AS',
  'ON',
  'USING',
  'JOIN',
  'INNER JOIN',
  'LEFT JOIN',
  'RIGHT JOIN',
  'FULL JOIN',
  'CROSS JOIN',
  'UNION',
  'UNION ALL',
  'INTERSECT',
  'EXCEPT',
  'AND',
  'OR',
  'NOT',
  'IN',
  'LIKE',
  'BETWEEN',
  'IS NULL',
  'IS NOT NULL',
  'NULL',
  'ASC',
  'DESC',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
  'EXISTS',
  'WITH',
  'INSERT INTO',
  'VALUES',
  'UPDATE',
  'SET',
  'DELETE FROM',
  'CREATE TABLE',
  'PRIMARY KEY',
  'FOREIGN KEY',
  'REFERENCES',
  'DEFAULT',
];

export const SQL_FUNCTIONS: readonly string[] = [
  'COUNT',
  'SUM',
  'AVG',
  'MIN',
  'MAX',
  'TOTAL',
  'ROUND',
  'ABS',
  'COALESCE',
  'IFNULL',
  'NULLIF',
  'LENGTH',
  'LOWER',
  'UPPER',
  'SUBSTR',
  'TRIM',
  'REPLACE',
  'CAST',
];

interface SqlSchema {
  tables: string[];
  columns: string[];
}

const schemaByModel = new WeakMap<object, SqlSchema>();

const unique = (values: string[]): string[] => [...new Set(values)];

export const setSqlSchema = (model: object, fixture: string): void => {
  const tables = parseSqlFixture(fixture);
  if (tables.length === 0) {
    schemaByModel.delete(model);
    return;
  }
  schemaByModel.set(model, {
    tables: unique(tables.map((table) => table.name)),
    columns: unique(tables.flatMap((table) => table.columns.map((column) => column.name))),
  });
};

export const clearSqlSchema = (model: object): void => {
  schemaByModel.delete(model);
};

const registered = new WeakSet<object>();

export const registerSqlCompletion = (monaco: MonacoApi): void => {
  if (registered.has(monaco)) return;
  registered.add(monaco);

  const { CompletionItemKind, CompletionItemInsertTextRule } = monaco.languages;

  monaco.languages.registerCompletionItemProvider('sql', {
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const schema = schemaByModel.get(model);

      const tableItems = (schema?.tables ?? []).map((name) => ({
        label: name,
        kind: CompletionItemKind.Struct,
        insertText: name,
        sortText: `1_${name}`,
        range,
      }));

      const columnItems = (schema?.columns ?? []).map((name) => ({
        label: name,
        kind: CompletionItemKind.Field,
        insertText: name,
        sortText: `2_${name}`,
        range,
      }));

      const keywordItems = SQL_KEYWORDS.map((keyword) => ({
        label: keyword,
        kind: CompletionItemKind.Keyword,
        insertText: keyword,
        sortText: `3_${keyword}`,
        range,
      }));

      const functionItems = SQL_FUNCTIONS.map((fn) => ({
        label: fn,
        kind: CompletionItemKind.Function,
        insertText: `${fn}($1)`,
        insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
        sortText: `4_${fn}`,
        range,
      }));

      return { suggestions: [...tableItems, ...columnItems, ...keywordItems, ...functionItems] };
    },
  });
};
