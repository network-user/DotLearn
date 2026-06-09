/// <reference lib="webworker" />

import initSqlJs, { type SqlJsStatic } from 'sql.js';

import type { SqlWorkerRequest, SqlWorkerResponse } from './protocol';

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

let sqlPromise: Promise<SqlJsStatic> | undefined;

const ensureSql = (wasmUrl?: string): Promise<SqlJsStatic> => {
  if (!sqlPromise) {
    sqlPromise = wasmUrl ? initSqlJs({ locateFile: () => wasmUrl }) : initSqlJs();
  }
  return sqlPromise;
};

const post = (response: SqlWorkerResponse): void => {
  workerScope.postMessage(response);
};

const toRow = (
  columns: string[],
  values: ReadonlyArray<unknown>,
): Record<string, unknown> => {
  const row: Record<string, unknown> = {};
  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index];
    if (column !== undefined) {
      row[column] = values[index] ?? null;
    }
  }
  return row;
};

const runExecute = async (id: string, sql: string, fixture: string | undefined): Promise<void> => {
  try {
    const SQL = await ensureSql();
    const db = new SQL.Database();
    if (fixture) {
      db.exec(fixture);
    }
    const results = db.exec(sql);
    const last = results[results.length - 1];
    if (!last) {
      db.close();
      post({ id, type: 'result', columns: [], rows: [] });
      return;
    }
    const columns = [...last.columns];
    const rows = last.values.map((row) => toRow(columns, row));
    db.close();
    post({ id, type: 'result', columns, rows });
  } catch (error) {
    post({ id, type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};

workerScope.addEventListener('message', (event: MessageEvent<SqlWorkerRequest>) => {
  const request = event.data;
  if (request.type === 'init') {
    ensureSql(request.wasmUrl)
      .then(() => post({ id: request.id, type: 'ready' }))
      .catch((error: unknown) =>
        post({
          id: request.id,
          type: 'error',
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    return;
  }
  if (request.type === 'execute') {
    void runExecute(request.id, request.sql, request.fixture);
  }
});
