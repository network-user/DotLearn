import { db, type PlaygroundRecord } from '@/lib/progress-db';

export class PlaygroundStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlaygroundStateError';
  }
}

export type PlaygroundTab = 'sql' | 'python';

export type PlaygroundView = 'gallery' | 'workspace';

const normalizeView = (value: unknown): PlaygroundView =>
  value === 'workspace' ? 'workspace' : 'gallery';

export interface SqlPlaygroundState {
  templateId: string;
  schema: string;
  query: string;
  view: PlaygroundView;
}

export interface PythonPlaygroundState {
  templateId: string;
  code: string;
  view: PlaygroundView;
}

const ACTIVE_TAB_KEY = 'playground:active-tab';
const SQL_STATE_KEY = 'playground:sql';
const PYTHON_STATE_KEY = 'playground:python';

const writeRecord = async (id: string, value: string): Promise<void> => {
  await db.playground.put({ id, value, updatedAt: new Date().toISOString() });
};

const readRecord = async (id: string): Promise<PlaygroundRecord | undefined> =>
  db.playground.get(id);

export const loadActiveTab = async (): Promise<PlaygroundTab | undefined> => {
  const record = await readRecord(ACTIVE_TAB_KEY);
  if (record?.value === 'sql' || record?.value === 'python') {
    return record.value;
  }
  return undefined;
};

export const saveActiveTab = async (tab: PlaygroundTab): Promise<void> => {
  await writeRecord(ACTIVE_TAB_KEY, tab);
};

const parseState = <T>(raw: string, predicate: (value: unknown) => value is T): T => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new PlaygroundStateError('stored playground state is not valid JSON');
  }
  if (!predicate(parsed)) {
    throw new PlaygroundStateError('stored playground state has an unexpected shape');
  }
  return parsed;
};

const isSqlState = (value: unknown): value is SqlPlaygroundState =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as SqlPlaygroundState).templateId === 'string' &&
  typeof (value as SqlPlaygroundState).schema === 'string' &&
  typeof (value as SqlPlaygroundState).query === 'string';

const isPythonState = (value: unknown): value is PythonPlaygroundState =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as PythonPlaygroundState).templateId === 'string' &&
  typeof (value as PythonPlaygroundState).code === 'string';

export const loadSqlState = async (): Promise<SqlPlaygroundState | undefined> => {
  const record = await readRecord(SQL_STATE_KEY);
  if (!record) return undefined;
  try {
    const parsed = parseState(record.value, isSqlState);
    return { ...parsed, view: normalizeView(parsed.view) };
  } catch {
    return undefined;
  }
};

export const saveSqlState = async (state: SqlPlaygroundState): Promise<void> => {
  await writeRecord(SQL_STATE_KEY, JSON.stringify(state));
};

export const loadPythonState = async (): Promise<PythonPlaygroundState | undefined> => {
  const record = await readRecord(PYTHON_STATE_KEY);
  if (!record) return undefined;
  try {
    const parsed = parseState(record.value, isPythonState);
    return { ...parsed, view: normalizeView(parsed.view) };
  } catch {
    return undefined;
  }
};

export const savePythonState = async (state: PythonPlaygroundState): Promise<void> => {
  await writeRecord(PYTHON_STATE_KEY, JSON.stringify(state));
};
