/// <reference lib="webworker" />

import initSqlJs, { type SqlJsStatic } from 'sql.js';

import { hardenWorkerScope } from '../harden-worker-scope';
import type { SqlWorkerRequest, SqlWorkerResponse } from './protocol';

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

// Capture postMessage before hardenWorkerScope neuters it, then reply through this reference
// (mirrors the Python worker), so responses keep working after the escape globals are removed.
const rawPostMessage = workerScope.postMessage.bind(workerScope);

let sqlPromise: Promise<SqlJsStatic> | undefined;

const ensureSql = (wasmUrl?: string): Promise<SqlJsStatic> => {
  if (!sqlPromise) {
    sqlPromise = (wasmUrl ? initSqlJs({ locateFile: () => wasmUrl }) : initSqlJs()).then((SQL) => {
      hardenWorkerScope(workerScope);
      return SQL;
    });
  }
  return sqlPromise;
};

const post = (response: SqlWorkerResponse): void => {
  rawPostMessage(response);
};

const toRow = (columns: string[], values: ReadonlyArray<unknown>): Record<string, unknown> => {
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
    try {
      if (fixture) {
        db.exec(fixture);
      }
      const results = db.exec(sql);
      const last = results[results.length - 1];
      if (!last) {
        post({ id, type: 'result', columns: [], rows: [] });
        return;
      }
      const columns = [...last.columns];
      const rows = last.values.map((row) => toRow(columns, row));
      post({ id, type: 'result', columns, rows });
    } finally {
      db.close();
    }
  } catch (error) {
    post({ id, type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};

const isWorkerRequest = (data: unknown): data is SqlWorkerRequest => {
  if (typeof data !== 'object' || data === null) return false;
  const request = data as Record<string, unknown>;
  if (typeof request.id !== 'string') return false;
  if (request.type === 'init') {
    return request.wasmUrl === undefined || typeof request.wasmUrl === 'string';
  }
  if (request.type === 'execute') {
    return (
      typeof request.sql === 'string' &&
      (request.fixture === undefined || typeof request.fixture === 'string')
    );
  }
  return false;
};

workerScope.addEventListener('message', (event: MessageEvent<SqlWorkerRequest>) => {
  const request = event.data;
  if (!isWorkerRequest(request)) {
    return;
  }
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
