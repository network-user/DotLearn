export type ShellTokenKind =
  | 'command'
  | 'subcommand'
  | 'flag'
  | 'string'
  | 'redirect'
  | 'arg'
  | 'space';

export interface ShellToken {
  text: string;
  kind: ShellTokenKind;
}

type RawSegmentType = 'space' | 'string' | 'redirect' | 'word';

interface RawSegment {
  text: string;
  type: RawSegmentType;
}

const KNOWN_COMMANDS = new Set([
  'git',
  'echo',
  'cat',
  'ls',
  'rm',
  'touch',
  'mkdir',
  'pwd',
  'clear',
  'help',
]);

const isSpace = (char: string): boolean => char === ' ' || char === '\t';

const segmentize = (line: string): RawSegment[] => {
  const segments: RawSegment[] = [];
  let word = '';
  const flushWord = (): void => {
    if (word !== '') {
      segments.push({ text: word, type: 'word' });
      word = '';
    }
  };
  let index = 0;
  while (index < line.length) {
    const char = line[index] ?? '';
    if (isSpace(char)) {
      flushWord();
      let run = '';
      while (index < line.length && isSpace(line[index] ?? '')) {
        run += line[index];
        index += 1;
      }
      segments.push({ text: run, type: 'space' });
      continue;
    }
    if (char === '"' || char === "'") {
      flushWord();
      const quote = char;
      let span = char;
      index += 1;
      while (index < line.length) {
        const current = line[index] ?? '';
        span += current;
        index += 1;
        if (current === quote) {
          break;
        }
      }
      segments.push({ text: span, type: 'string' });
      continue;
    }
    if (char === '>') {
      flushWord();
      let redirect = '>';
      index += 1;
      if (index < line.length && line[index] === '>') {
        redirect += '>';
        index += 1;
      }
      segments.push({ text: redirect, type: 'redirect' });
      continue;
    }
    word += char;
    index += 1;
  }
  flushWord();
  return segments;
};

export const tokenizeShellCommand = (line: string): ShellToken[] => {
  const segments = segmentize(line);
  const tokens: ShellToken[] = [];
  let wordIndex = 0;
  let firstWordText: string | null = null;
  for (const segment of segments) {
    if (segment.type === 'space') {
      tokens.push({ text: segment.text, kind: 'space' });
      continue;
    }
    if (segment.type === 'redirect') {
      tokens.push({ text: segment.text, kind: 'redirect' });
      continue;
    }
    if (segment.type === 'string') {
      tokens.push({ text: segment.text, kind: 'string' });
      wordIndex += 1;
      continue;
    }
    let kind: ShellTokenKind;
    if (segment.text.startsWith('-')) {
      kind = 'flag';
    } else if (wordIndex === 0) {
      kind = KNOWN_COMMANDS.has(segment.text) ? 'command' : 'arg';
    } else if (wordIndex === 1 && firstWordText === 'git') {
      kind = 'subcommand';
    } else {
      kind = 'arg';
    }
    if (wordIndex === 0) {
      firstWordText = segment.text;
    }
    tokens.push({ text: segment.text, kind });
    wordIndex += 1;
  }
  return tokens;
};

const KIND_CLASS: Record<ShellTokenKind, string> = {
  command: 'text-accent font-medium',
  subcommand: 'text-accent-2',
  flag: 'text-warn',
  string: 'text-ok',
  redirect: 'text-accent-3',
  arg: 'text-fg',
  space: '',
};

export const shellTokenClassName = (kind: ShellTokenKind): string => KIND_CLASS[kind];
