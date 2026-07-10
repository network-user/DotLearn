import type { RepoSnapshot } from '@dotlearn/lesson-engine';

export interface CompletionResult {
  completed?: string;
  candidates: string[];
}

const SHELL_BUILTINS = ['echo', 'cat', 'ls', 'rm', 'touch', 'mkdir', 'pwd'];
const UI_COMMANDS = ['clear', 'help'];
const FIRST_TOKEN = ['git', ...SHELL_BUILTINS, ...UI_COMMANDS];

const BUILTIN_FILE_COMMANDS = new Set(['cat', 'ls', 'rm', 'touch']);

const GIT_SUBCOMMANDS = [
  'init',
  'config',
  'add',
  'rm',
  'status',
  'commit',
  'log',
  'diff',
  'branch',
  'checkout',
  'switch',
  'merge',
  'reset',
  'revert',
  'restore',
  'stash',
  'cherry-pick',
  'rebase',
  'tag',
  'reflog',
  'remote',
  'fetch',
  'pull',
  'push',
];

const FLAGS_BY_SUBCOMMAND: Record<string, string[]> = {
  add: ['-A', '--all'],
  commit: ['-m', '-am', '-a', '--amend'],
  branch: ['-d', '-D', '-m'],
  checkout: ['-b'],
  switch: ['-c'],
  reset: ['--soft', '--mixed', '--hard'],
  log: ['--oneline'],
  restore: ['--staged'],
  remote: ['-v'],
  tag: ['-a'],
  init: ['-b'],
};

const ARGS_BY_SUBCOMMAND: Record<string, string[]> = {
  add: ['.'],
  remote: ['add'],
  stash: ['pop', 'apply', 'list'],
  push: ['origin'],
  pull: ['origin'],
  fetch: ['origin'],
};

const longestCommonPrefix = (items: string[]): string => {
  const first = items[0];
  if (first === undefined) {
    return '';
  }
  let prefix = first;
  for (const item of items.slice(1)) {
    let cursor = 0;
    while (cursor < prefix.length && cursor < item.length && prefix[cursor] === item[cursor]) {
      cursor += 1;
    }
    prefix = prefix.slice(0, cursor);
    if (prefix === '') {
      break;
    }
  }
  return prefix;
};

export const completeCommand = (draft: string, snapshot: RepoSnapshot | null): CompletionResult => {
  const trailingSpace = /\s$/.test(draft);
  const trimmed = draft.trim();
  const tokens = trimmed === '' ? [] : trimmed.split(/\s+/);

  const branches = snapshot ? snapshot.branches.map((branch) => branch.name) : [];
  const tags = snapshot ? snapshot.tags.map((tag) => tag.name) : [];
  const files = snapshot ? Object.keys(snapshot.workingTree) : [];

  const completingIndex = trailingSpace ? tokens.length : tokens.length - 1;

  let prefix: string;
  let pool: string[];

  if (completingIndex <= 0) {
    prefix = trailingSpace ? '' : (tokens[0] ?? '');
    pool = FIRST_TOKEN;
  } else {
    const first = tokens[0];
    prefix = trailingSpace ? '' : (tokens[completingIndex] ?? '');
    if (first === 'git') {
      if (completingIndex === 1) {
        pool = GIT_SUBCOMMANDS;
      } else {
        const subcommand = tokens[1] ?? '';
        if (prefix.startsWith('-')) {
          pool = FLAGS_BY_SUBCOMMAND[subcommand] ?? [];
        } else {
          pool = [...(ARGS_BY_SUBCOMMAND[subcommand] ?? []), ...branches, ...tags, ...files];
        }
      }
    } else if (BUILTIN_FILE_COMMANDS.has(first ?? '')) {
      pool = files;
    } else {
      pool = [];
    }
  }

  const seen = new Set<string>();
  const candidates = pool.filter((candidate) => {
    if (!candidate.startsWith(prefix) || seen.has(candidate)) {
      return false;
    }
    seen.add(candidate);
    return true;
  });

  if (candidates.length === 0) {
    return { candidates: [] };
  }

  const head = trailingSpace ? draft : draft.slice(0, draft.length - prefix.length);

  if (candidates.length === 1) {
    return { completed: `${head}${candidates[0]} `, candidates };
  }

  const common = longestCommonPrefix(candidates);
  if (common.length > prefix.length) {
    return { completed: `${head}${common}`, candidates };
  }

  return { candidates };
};
