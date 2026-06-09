import { createSqlJsRuntime, type SqlJsRuntime } from '@dotlearn/sandbox';
import SqlWorker from '@dotlearn/sandbox/sql/worker?worker';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

let cached: SqlJsRuntime | undefined;

export const getSqlRuntime = (): SqlJsRuntime => {
  if (!cached) {
    cached = createSqlJsRuntime({ worker: new SqlWorker(), wasmUrl: sqlWasmUrl });
  }
  return cached;
};
