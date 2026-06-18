export interface SplitSource {
  body: string;
  echoExpression?: string;
}

const STATEMENT_KEYWORDS = [
  'import',
  'from',
  'def',
  'class',
  'return',
  'pass',
  'break',
  'continue',
  'raise',
  'assert',
  'global',
  'nonlocal',
  'del',
  'yield',
  'with',
  'for',
  'while',
  'if',
  'elif',
  'else',
  'try',
  'except',
  'finally',
  'async',
  'await',
  'print',
];

const isAssignment = (line: string): boolean => {
  let depth = 0;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '(' || char === '[' || char === '{') depth += 1;
    else if (char === ')' || char === ']' || char === '}') depth -= 1;
    else if (depth === 0 && char === '=') {
      const prev = line[index - 1];
      const next = line[index + 1];
      if (prev === '=' || prev === '!' || prev === '<' || prev === '>') continue;
      if (next === '=') continue;
      return true;
    }
    else if (depth === 0 && char === ':' && line[index + 1] === '=') return true;
    else if (char === '#') break;
  }
  return false;
};

const startsWithStatementKeyword = (line: string): boolean => {
  const match = /^([A-Za-z_]\w*)/.exec(line);
  if (!match) return false;
  return STATEMENT_KEYWORDS.includes(match[1] as string);
};

const bracketBalance = (text: string): number => {
  let depth = 0;
  let quote: string | undefined;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === '\\') {
        index += 1;
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '(' || char === '[' || char === '{') {
      depth += 1;
    } else if (char === ')' || char === ']' || char === '}') {
      depth -= 1;
    } else if (char === '#') {
      break;
    }
  }
  return depth;
};

export const splitTrailingExpression = (source: string): SplitSource => {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  let lastIndex = lines.length - 1;
  while (lastIndex >= 0 && lines[lastIndex]?.trim() === '') {
    lastIndex -= 1;
  }
  if (lastIndex < 0) {
    return { body: source };
  }
  const candidate = lines[lastIndex] as string;
  if (/^\s/.test(candidate)) {
    return { body: source };
  }
  const trimmed = candidate.replace(/#.*$/, '').trim();
  if (trimmed.length === 0) {
    return { body: source };
  }
  if (startsWithStatementKeyword(trimmed)) {
    return { body: source };
  }
  if (isAssignment(trimmed)) {
    return { body: source };
  }
  if (trimmed.endsWith(':') || trimmed.endsWith('\\')) {
    return { body: source };
  }
  if (/^[)\]}]/.test(trimmed)) {
    return { body: source };
  }
  if (bracketBalance(candidate) !== 0) {
    return { body: source };
  }
  const body = lines.slice(0, lastIndex).join('\n');
  if (bracketBalance(body) !== 0) {
    return { body: source };
  }
  return { body, echoExpression: trimmed };
};

const isPlainObject = (value: object): boolean => {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

export const formatReplValue = (value: unknown): string => {
  if (value === null || value === undefined) return 'None';
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (Array.isArray(value)) {
    return `[${value.map((item) => formatReplValue(item)).join(', ')}]`;
  }
  if (value instanceof Map) {
    const entries = Array.from(value.entries())
      .map(([key, item]) => `${formatReplValue(key)}: ${formatReplValue(item)}`)
      .join(', ');
    return `{${entries}}`;
  }
  if (typeof value === 'object') {
    if (isPlainObject(value)) {
      const entries = Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => `${formatReplValue(key)}: ${formatReplValue(item)}`)
        .join(', ');
      return `{${entries}}`;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const MODULE_NOT_FOUND = /ModuleNotFoundError|No module named ['"]?([\w.]+)['"]?/;

export interface FriendlyThrown {
  type: string;
  message: string;
  hint?: string;
}

export const moduleNameFromError = (type: string, message: string): string | undefined => {
  if (type !== 'ModuleNotFoundError' && type !== 'ImportError') return undefined;
  const match = MODULE_NOT_FOUND.exec(message);
  return match?.[1]?.split('.')[0];
};

export const PYODIDE_PACKAGES = [
  'numpy',
  'pandas',
  'matplotlib',
  'scipy',
  'scikit-learn',
  'sympy',
  'networkx',
  'pillow',
  'requests',
  'beautifulsoup4',
  'regex',
  'pytz',
  'python-dateutil',
] as const;

const PACKAGE_IMPORT_NAMES = new Set<string>([
  'numpy',
  'pandas',
  'matplotlib',
  'scipy',
  'sklearn',
  'sympy',
  'networkx',
  'PIL',
  'requests',
  'bs4',
  'regex',
  'pytz',
  'dateutil',
]);

export const isKnownPyodidePackage = (moduleName: string): boolean =>
  PACKAGE_IMPORT_NAMES.has(moduleName);

const TOP_LEVEL_IMPORT = /^(?:from\s+([\w.]+)|import\s+([\w.,\s]+))/;

export const importedModules = (source: string): string[] => {
  const found = new Set<string>();
  for (const rawLine of source.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim();
    const match = TOP_LEVEL_IMPORT.exec(line);
    if (!match) continue;
    if (match[1]) {
      found.add(match[1].split('.')[0] as string);
    } else if (match[2]) {
      for (const part of match[2].split(',')) {
        const name = part.trim().split(/\s+as\s+/)[0]?.split('.')[0];
        if (name) found.add(name);
      }
    }
  }
  return Array.from(found);
};

export const importedPyodidePackages = (source: string): string[] =>
  importedModules(source).filter((name) => isKnownPyodidePackage(name));
