export interface ParsedColumn {
  name: string;
  type: string;
  notes: string[];
}

export interface ParsedTable {
  name: string;
  columns: ParsedColumn[];
}

const stripComments = (sql: string): string =>
  sql.replace(/--[^\n]*\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');

const splitColumnDefs = (body: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let buffer = '';
  for (const char of body) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(buffer.trim());
      buffer = '';
      continue;
    }
    buffer += char;
  }
  if (buffer.trim().length > 0) {
    parts.push(buffer.trim());
  }
  return parts;
};

const CREATE_TABLE_RE =
  /create\s+table\s+(?:if\s+not\s+exists\s+)?["`]?([a-zA-Z_][\w]*)["`]?\s*\(([\s\S]*?)\)\s*;/gi;

const CONSTRAINT_KEYWORDS = new Set(['primary', 'foreign', 'unique', 'check', 'constraint', 'key']);

export const parseSqlFixture = (fixture: string): ParsedTable[] => {
  const cleaned = stripComments(fixture);
  const tables: ParsedTable[] = [];
  let match: RegExpExecArray | null;
  while ((match = CREATE_TABLE_RE.exec(cleaned))) {
    const name = match[1];
    const body = match[2];
    if (!name || !body) continue;
    const defs = splitColumnDefs(body);
    const columns: ParsedColumn[] = [];
    for (const def of defs) {
      const first = def.split(/\s+/)[0]?.toLowerCase();
      if (!first || CONSTRAINT_KEYWORDS.has(first)) continue;
      const cleanedDef = def.replace(/^["`]([^"`]+)["`]/, '$1');
      const parts = cleanedDef.split(/\s+/);
      const colName = parts[0]?.replace(/[",]/g, '') ?? '';
      const type = (parts[1] ?? '').replace(/[(),]/g, '').toUpperCase();
      const upper = cleanedDef.toUpperCase();
      const notes: string[] = [];
      if (upper.includes('PRIMARY KEY')) notes.push('PK');
      if (upper.includes('NOT NULL')) notes.push('NOT NULL');
      if (upper.includes('UNIQUE')) notes.push('UNIQUE');
      if (upper.includes('REFERENCES')) notes.push('FK');
      if (upper.includes('DEFAULT')) notes.push('DEFAULT');
      if (colName) {
        columns.push({ name: colName, type: type || '?', notes });
      }
    }
    if (columns.length > 0) {
      tables.push({ name, columns });
    }
  }
  return tables;
};
