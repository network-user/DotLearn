import {
  db,
  type PlaygroundRecord,
  type PlaygroundSnippetRecord,
} from '@/lib/progress-db';

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

export type PersistedConsoleTone = 'system' | 'stdout' | 'pass' | 'fail' | 'meta';

export interface PersistedConsoleLine {
  tone: PersistedConsoleTone;
  text: string;
}

export interface PythonPlaygroundState {
  templateId: string;
  code: string;
  view: PlaygroundView;
  lastLines?: PersistedConsoleLine[];
  activeSnippetId?: string;
}

export interface SandboxIncoming {
  tab: PlaygroundTab;
  code: string;
}

const ACTIVE_TAB_KEY = 'playground:active-tab';
const SQL_STATE_KEY = 'playground:sql';
const PYTHON_STATE_KEY = 'playground:python';
const INCOMING_KEY = 'playground:incoming';

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

const PERSISTED_TONES: PersistedConsoleTone[] = ['system', 'stdout', 'pass', 'fail', 'meta'];

const MAX_PERSISTED_LINES = 200;

const sanitizeLastLines = (value: unknown): PersistedConsoleLine[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const lines: PersistedConsoleLine[] = [];
  for (const entry of value) {
    if (
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as PersistedConsoleLine).text === 'string' &&
      PERSISTED_TONES.includes((entry as PersistedConsoleLine).tone)
    ) {
      lines.push({
        tone: (entry as PersistedConsoleLine).tone,
        text: (entry as PersistedConsoleLine).text,
      });
    }
  }
  return lines.length > 0 ? lines.slice(-MAX_PERSISTED_LINES) : undefined;
};

export const loadPythonState = async (): Promise<PythonPlaygroundState | undefined> => {
  const record = await readRecord(PYTHON_STATE_KEY);
  if (!record) return undefined;
  try {
    const parsed = parseState(record.value, isPythonState);
    const lastLines = sanitizeLastLines((parsed as PythonPlaygroundState).lastLines);
    const activeSnippetId =
      typeof (parsed as PythonPlaygroundState).activeSnippetId === 'string'
        ? (parsed as PythonPlaygroundState).activeSnippetId
        : undefined;
    return {
      templateId: parsed.templateId,
      code: parsed.code,
      view: normalizeView(parsed.view),
      ...(lastLines ? { lastLines } : {}),
      ...(activeSnippetId ? { activeSnippetId } : {}),
    };
  } catch {
    return undefined;
  }
};

export const savePythonState = async (state: PythonPlaygroundState): Promise<void> => {
  const payload: PythonPlaygroundState = {
    templateId: state.templateId,
    code: state.code,
    view: state.view,
    ...(state.lastLines && state.lastLines.length > 0
      ? { lastLines: state.lastLines.slice(-MAX_PERSISTED_LINES) }
      : {}),
    ...(state.activeSnippetId ? { activeSnippetId: state.activeSnippetId } : {}),
  };
  await writeRecord(PYTHON_STATE_KEY, JSON.stringify(payload));
};

const newSnippetId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `snip-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;

export interface PlaygroundSnippet {
  id: string;
  name: string;
  code: string;
  updatedAt: string;
}

const toSnippet = (record: PlaygroundSnippetRecord): PlaygroundSnippet => ({
  id: record.id,
  name: record.name,
  code: record.code,
  updatedAt: record.updatedAt,
});

export const listPythonSnippets = async (): Promise<PlaygroundSnippet[]> => {
  const records = await db.playgroundSnippets.where('language').equals('python').toArray();
  return records
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(toSnippet);
};

export const createPythonSnippet = async (
  name: string,
  code: string,
): Promise<PlaygroundSnippet> => {
  const record: PlaygroundSnippetRecord = {
    id: newSnippetId(),
    language: 'python',
    name: name.trim() || 'Сниппет',
    code,
    updatedAt: new Date().toISOString(),
  };
  await db.playgroundSnippets.put(record);
  return toSnippet(record);
};

export const updatePythonSnippetCode = async (id: string, code: string): Promise<void> => {
  const record = await db.playgroundSnippets.get(id);
  if (!record) return;
  await db.playgroundSnippets.put({ ...record, code, updatedAt: new Date().toISOString() });
};

export const renamePythonSnippet = async (id: string, name: string): Promise<void> => {
  const record = await db.playgroundSnippets.get(id);
  if (!record) return;
  const trimmed = name.trim();
  if (trimmed.length === 0) return;
  await db.playgroundSnippets.put({ ...record, name: trimmed, updatedAt: new Date().toISOString() });
};

export const deletePythonSnippet = async (id: string): Promise<void> => {
  await db.playgroundSnippets.delete(id);
};

const isSandboxIncoming = (value: unknown): value is SandboxIncoming =>
  typeof value === 'object' &&
  value !== null &&
  ((value as SandboxIncoming).tab === 'sql' || (value as SandboxIncoming).tab === 'python') &&
  typeof (value as SandboxIncoming).code === 'string';

export const stashSandboxIncoming = async (incoming: SandboxIncoming): Promise<void> => {
  await writeRecord(INCOMING_KEY, JSON.stringify(incoming));
};

export const takeSandboxIncoming = async (): Promise<SandboxIncoming | undefined> => {
  const record = await readRecord(INCOMING_KEY);
  if (!record) return undefined;
  await db.playground.delete(INCOMING_KEY);
  try {
    return parseState(record.value, isSandboxIncoming);
  } catch {
    return undefined;
  }
};
