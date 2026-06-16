export interface Redirection {
  target: string;
  append: boolean;
}

export interface ParsedCommand {
  tokens: string[];
  redirect?: Redirection;
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

export const tokenize = (line: string): string[] => {
  const tokens: string[] = [];
  let current = '';
  let hasToken = false;
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === undefined) {
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = null;
      } else if (char === '\\' && quote === '"' && index + 1 < line.length) {
        index += 1;
        current += line[index] ?? '';
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      hasToken = true;
      continue;
    }
    if (char === '\\' && index + 1 < line.length) {
      index += 1;
      current += line[index] ?? '';
      hasToken = true;
      continue;
    }
    if (char === ' ' || char === '\t') {
      if (hasToken) {
        tokens.push(current);
        current = '';
        hasToken = false;
      }
      continue;
    }
    current += char;
    hasToken = true;
  }
  if (quote) {
    throw new ParseError('unterminated quote');
  }
  if (hasToken) {
    tokens.push(current);
  }
  return tokens;
};

export const parseCommand = (line: string): ParsedCommand => {
  const rawTokens = tokenize(line);
  const tokens: string[] = [];
  let redirect: Redirection | undefined;
  for (let index = 0; index < rawTokens.length; index += 1) {
    const token = rawTokens[index];
    if (token === undefined) {
      continue;
    }
    if (token === '>' || token === '>>') {
      const target = rawTokens[index + 1];
      if (target === undefined) {
        throw new ParseError('redirection target missing');
      }
      redirect = { target, append: token === '>>' };
      index += 1;
      continue;
    }
    if (token.startsWith('>>') && token.length > 2) {
      redirect = { target: token.slice(2), append: true };
      continue;
    }
    if (token.startsWith('>') && token.length > 1 && !token.startsWith('>>')) {
      redirect = { target: token.slice(1), append: false };
      continue;
    }
    tokens.push(token);
  }
  return redirect === undefined ? { tokens } : { tokens, redirect };
};
