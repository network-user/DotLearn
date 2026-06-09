import initSqlJs, { type SqlJsStatic } from 'sql.js';

import { SqlExecutionError, type SqlExecution, type SqlRuntime } from './sql';

let cached: Promise<SqlJsStatic> | undefined;

const ensure = (): Promise<SqlJsStatic> => {
  if (!cached) {
    cached = initSqlJs();
  }
  return cached;
};

export const createSqlJsNodeRuntime = (): SqlRuntime => ({
  execute: async (sql: string, fixture?: string): Promise<SqlExecution> => {
    const SQL = await ensure();
    const db = new SQL.Database();
    try {
      if (fixture) {
        db.exec(fixture);
      }
      const results = db.exec(sql);
      const last = results[results.length - 1];
      if (!last) {
        return { columns: [], rows: [] };
      }
      const columns = [...last.columns];
      const rows = last.values.map((row) => {
        const out: Record<string, unknown> = {};
        for (let index = 0; index < columns.length; index += 1) {
          const column = columns[index];
          if (column !== undefined) {
            out[column] = row[index] ?? null;
          }
        }
        return out;
      });
      return { columns, rows };
    } catch (error) {
      throw new SqlExecutionError(
        error instanceof Error ? error.message : String(error),
        sql,
        error,
      );
    } finally {
      db.close();
    }
  },
});
