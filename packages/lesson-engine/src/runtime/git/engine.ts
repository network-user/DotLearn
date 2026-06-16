import { GitError } from './errors';
import { parseCommand, ParseError } from './parser';

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface CommitSnapshot {
  id: string;
  message: string;
  parents: string[];
}

export interface HeadSnapshot {
  detached: boolean;
  branch?: string;
  commit?: string;
}

export interface StatusSnapshot {
  staged: string[];
  modified: string[];
  untracked: string[];
  clean: boolean;
}

export interface RepoSnapshot {
  head: HeadSnapshot;
  branches: { name: string; commit: string }[];
  tags: { name: string; commit: string }[];
  commits: CommitSnapshot[];
  workingTree: Record<string, string>;
  index: Record<string, string>;
  status: StatusSnapshot;
}

export type FileLocation = 'worktree' | 'head';

interface Commit {
  id: string;
  message: string;
  parents: string[];
  tree: Record<string, string>;
  seq: number;
}

interface Stash {
  message: string;
  tree: Record<string, string>;
  index: Record<string, string>;
}

const BASE_CLOCK = 1_000_000_000;
const CLOCK_STEP = 60;

const hashId = (input: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  let second = 0x9e3779b1 ^ hash;
  for (let index = input.length - 1; index >= 0; index -= 1) {
    second ^= input.charCodeAt(index);
    second = Math.imul(second, 0x85ebca6b) >>> 0;
  }
  const left = hash.toString(16).padStart(8, '0');
  const right = second.toString(16).padStart(8, '0');
  return (left + right).slice(0, 12);
};

const cloneTree = (tree: Record<string, string>): Record<string, string> => ({ ...tree });

const treesEqual = (a: Record<string, string>, b: Record<string, string>): boolean => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
};

export class GitRepo {
  private commits = new Map<string, Commit>();
  private branches = new Map<string, string>();
  private tags = new Map<string, string>();
  private head: HeadSnapshot = { detached: false, branch: 'main' };
  private index: Record<string, string> = {};
  private workingTree: Record<string, string> = {};
  private stashes: Stash[] = [];
  private reflog: string[] = [];
  private remotes = new Map<string, string>();
  private initialized = false;
  private sequence = 0;
  private defaultBranch = 'main';

  exec(line: string): ExecResult {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      return this.ok('');
    }
    let parsed;
    try {
      parsed = parseCommand(trimmed);
    } catch (error) {
      if (error instanceof ParseError) {
        return this.err(`parse error: ${error.message}`);
      }
      throw error;
    }
    const [command, ...args] = parsed.tokens;
    if (command === undefined) {
      return this.ok('');
    }
    try {
      switch (command) {
        case 'git':
          return this.runGit(args);
        case 'echo':
          return this.shellEcho(args, parsed.redirect);
        case 'cat':
          return this.shellCat(args);
        case 'ls':
          return this.shellLs(args);
        case 'rm':
          return this.shellRm(args);
        case 'touch':
          return this.shellTouch(args);
        case 'mkdir':
          return this.ok('');
        case 'pwd':
          return this.ok('/repo');
        default:
          return this.err(`command not found: ${command}`);
      }
    } catch (error) {
      if (error instanceof GitError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      return this.err(message);
    }
  }

  private ok(stdout: string): ExecResult {
    return { stdout, stderr: '', code: 0 };
  }

  private err(stderr: string, code = 1): ExecResult {
    return { stdout: '', stderr, code };
  }

  private shellEcho(args: string[], redirect?: { target: string; append: boolean }): ExecResult {
    const text = args.join(' ');
    if (redirect) {
      const existing = redirect.append ? this.workingTree[redirect.target] ?? '' : '';
      this.workingTree[redirect.target] = `${existing}${text}\n`;
      return this.ok('');
    }
    return this.ok(`${text}\n`);
  }

  private shellCat(args: string[]): ExecResult {
    const path = args[0];
    if (path === undefined) {
      return this.err('cat: missing operand');
    }
    const content = this.workingTree[path];
    if (content === undefined) {
      return this.err(`cat: ${path}: No such file or directory`);
    }
    return this.ok(content.endsWith('\n') ? content : `${content}\n`);
  }

  private shellLs(args: string[]): ExecResult {
    const filtered = args.filter((arg) => !arg.startsWith('-'));
    const paths = Object.keys(this.workingTree).sort();
    if (filtered.length > 0) {
      const target = filtered[0];
      const matches = paths.filter((path) => path === target || path.startsWith(`${target}/`));
      if (matches.length === 0) {
        return this.err(`ls: cannot access '${target}': No such file or directory`);
      }
      return this.ok(`${matches.join('\n')}\n`);
    }
    return this.ok(paths.length > 0 ? `${paths.join('\n')}\n` : '');
  }

  private shellRm(args: string[]): ExecResult {
    const paths = args.filter((arg) => !arg.startsWith('-'));
    for (const path of paths) {
      if (this.workingTree[path] === undefined) {
        if (args.includes('-f')) {
          continue;
        }
        return this.err(`rm: cannot remove '${path}': No such file or directory`);
      }
      delete this.workingTree[path];
    }
    return this.ok('');
  }

  private shellTouch(args: string[]): ExecResult {
    for (const path of args) {
      if (this.workingTree[path] === undefined) {
        this.workingTree[path] = '';
      }
    }
    return this.ok('');
  }

  private runGit(args: string[]): ExecResult {
    const [subcommand, ...rest] = args;
    if (subcommand === undefined) {
      return this.err('usage: git <command>');
    }
    if (subcommand !== 'init' && subcommand !== 'config' && !this.initialized) {
      return this.err('fatal: not a git repository (run git init first)');
    }
    switch (subcommand) {
      case 'init':
        return this.gitInit(rest);
      case 'config':
        return this.ok('');
      case 'add':
        return this.gitAdd(rest);
      case 'rm':
        return this.gitRm(rest);
      case 'status':
        return this.gitStatus(rest);
      case 'commit':
        return this.gitCommit(rest);
      case 'log':
        return this.gitLog(rest);
      case 'diff':
        return this.gitDiff(rest);
      case 'branch':
        return this.gitBranch(rest);
      case 'checkout':
        return this.gitCheckout(rest);
      case 'switch':
        return this.gitSwitch(rest);
      case 'merge':
        return this.gitMerge(rest);
      case 'reset':
        return this.gitReset(rest);
      case 'revert':
        return this.gitRevert(rest);
      case 'restore':
        return this.gitRestore(rest);
      case 'stash':
        return this.gitStash(rest);
      case 'cherry-pick':
        return this.gitCherryPick(rest);
      case 'rebase':
        return this.gitRebase(rest);
      case 'tag':
        return this.gitTag(rest);
      case 'reflog':
        return this.gitReflog(rest);
      case 'remote':
        return this.gitRemote(rest);
      case 'fetch':
        return this.ok('');
      case 'pull':
        return this.ok('Already up to date.\n');
      case 'push':
        return this.gitPush(rest);
      default:
        return this.err(`git: '${subcommand}' is not a supported command`);
    }
  }

  private gitInit(args: string[]): ExecResult {
    if (this.initialized) {
      return this.ok('Reinitialized existing Git repository\n');
    }
    this.initialized = true;
    const branchFlagIndex = args.indexOf('-b');
    const requestedBranch = branchFlagIndex >= 0 ? args[branchFlagIndex + 1] : undefined;
    const initialBranch = requestedBranch ?? this.defaultBranch;
    this.defaultBranch = initialBranch;
    this.head = { detached: false, branch: initialBranch };
    return this.ok(`Initialized empty Git repository on branch ${initialBranch}\n`);
  }

  private nextSequence(): number {
    this.sequence += 1;
    return this.sequence;
  }

  private createCommit(message: string, parents: string[], tree: Record<string, string>): string {
    const seq = this.nextSequence();
    const id = hashId(`${seq}\0${message}\0${parents.join(',')}`);
    this.commits.set(id, { id, message, parents, tree: cloneTree(tree), seq });
    return id;
  }

  private authorClock(seq: number): number {
    return BASE_CLOCK + seq * CLOCK_STEP;
  }

  private headCommitId(): string | undefined {
    if (this.head.detached) {
      return this.head.commit;
    }
    if (this.head.branch === undefined) {
      return undefined;
    }
    return this.branches.get(this.head.branch);
  }

  private headTree(): Record<string, string> {
    const id = this.headCommitId();
    if (id === undefined) {
      return {};
    }
    return cloneTree(this.commits.get(id)?.tree ?? {});
  }

  private gitAdd(args: string[]): ExecResult {
    const all = args.includes('.') || args.includes('-A') || args.includes('--all');
    if (all) {
      this.index = cloneTree(this.workingTree);
      return this.ok('');
    }
    const paths = args.filter((arg) => !arg.startsWith('-'));
    if (paths.length === 0) {
      return this.err('Nothing specified, nothing added.');
    }
    for (const path of paths) {
      const content = this.workingTree[path];
      if (content === undefined) {
        return this.err(`fatal: pathspec '${path}' did not match any files`);
      }
      this.index[path] = content;
    }
    return this.ok('');
  }

  private gitRm(args: string[]): ExecResult {
    const cached = args.includes('--cached');
    const paths = args.filter((arg) => !arg.startsWith('-'));
    if (paths.length === 0) {
      return this.err('fatal: No pathspec was given.');
    }
    for (const path of paths) {
      if (this.index[path] === undefined && this.headTree()[path] === undefined) {
        return this.err(`fatal: pathspec '${path}' did not match any files`);
      }
      delete this.index[path];
      if (!cached) {
        delete this.workingTree[path];
      }
    }
    return this.ok('');
  }

  private computeStatus(): StatusSnapshot {
    const headTree = this.headTree();
    const staged: string[] = [];
    const modified: string[] = [];
    const untracked: string[] = [];
    const indexPaths = new Set(Object.keys(this.index));
    const headPaths = new Set(Object.keys(headTree));
    for (const path of new Set([...indexPaths, ...headPaths])) {
      if (this.index[path] !== headTree[path]) {
        staged.push(path);
      }
    }
    for (const path of Object.keys(this.workingTree)) {
      if (!indexPaths.has(path)) {
        untracked.push(path);
      } else if (this.workingTree[path] !== this.index[path]) {
        modified.push(path);
      }
    }
    for (const path of indexPaths) {
      if (this.workingTree[path] === undefined) {
        modified.push(path);
      }
    }
    const clean = staged.length === 0 && modified.length === 0 && untracked.length === 0;
    return {
      staged: staged.sort(),
      modified: [...new Set(modified)].sort(),
      untracked: untracked.sort(),
      clean,
    };
  }

  private gitStatus(args: string[]): ExecResult {
    const status = this.computeStatus();
    if (args.includes('-s') || args.includes('--short')) {
      const lines: string[] = [];
      for (const path of status.staged) {
        lines.push(`A  ${path}`);
      }
      for (const path of status.modified) {
        lines.push(` M ${path}`);
      }
      for (const path of status.untracked) {
        lines.push(`?? ${path}`);
      }
      return this.ok(lines.length > 0 ? `${lines.join('\n')}\n` : '');
    }
    const branchLine = this.head.detached
      ? `HEAD detached at ${(this.head.commit ?? '').slice(0, 7)}`
      : `On branch ${this.head.branch}`;
    const lines = [branchLine];
    if (status.clean) {
      lines.push('nothing to commit, working tree clean');
    } else {
      if (status.staged.length > 0) {
        lines.push('Changes to be committed:');
        for (const path of status.staged) {
          lines.push(`\tmodified:   ${path}`);
        }
      }
      if (status.modified.length > 0) {
        lines.push('Changes not staged for commit:');
        for (const path of status.modified) {
          lines.push(`\tmodified:   ${path}`);
        }
      }
      if (status.untracked.length > 0) {
        lines.push('Untracked files:');
        for (const path of status.untracked) {
          lines.push(`\t${path}`);
        }
      }
    }
    return this.ok(`${lines.join('\n')}\n`);
  }

  private setBranchHead(commit: string): void {
    if (this.head.detached) {
      this.head.commit = commit;
    } else if (this.head.branch !== undefined) {
      this.branches.set(this.head.branch, commit);
    }
  }

  private expandCombinedFlags(args: string[]): string[] {
    const expanded: string[] = [];
    for (const arg of args) {
      if (arg.startsWith('--')) {
        expanded.push(arg);
        continue;
      }
      if (arg.startsWith('-') && arg.length > 2) {
        const flagChars = arg.slice(1).replace(/[^a-zA-Z].*$/, '');
        const rest = arg.slice(1 + flagChars.length);
        if (flagChars.length > 1) {
          for (const char of flagChars) {
            expanded.push(`-${char}`);
          }
          if (rest.length > 0) {
            expanded.push(rest);
          }
          continue;
        }
      }
      expanded.push(arg);
    }
    return expanded;
  }

  private gitCommit(args: string[]): ExecResult {
    const expanded = this.expandCombinedFlags(args);
    const amend = expanded.includes('--amend');
    const includeAll = expanded.includes('-a');
    const message = this.extractMessage(expanded);
    if (includeAll) {
      const headTree = this.headTree();
      for (const path of Object.keys(this.index)) {
        const working = this.workingTree[path];
        if (working !== undefined) {
          this.index[path] = working;
        }
      }
      for (const [path, working] of Object.entries(this.workingTree)) {
        if (headTree[path] !== undefined) {
          this.index[path] = working;
        }
      }
      for (const path of Object.keys(this.index)) {
        if (headTree[path] !== undefined && this.workingTree[path] === undefined) {
          delete this.index[path];
        }
      }
    }
    if (amend) {
      const current = this.headCommitId();
      if (current === undefined) {
        return this.err('fatal: You have nothing to amend.');
      }
      const existing = this.commits.get(current);
      if (existing === undefined) {
        return this.err('fatal: cannot amend, commit missing');
      }
      const newMessage = message ?? existing.message;
      const id = this.createCommit(newMessage, existing.parents, cloneTree(this.index));
      this.setBranchHead(id);
      this.reflog.unshift(`${id.slice(0, 7)} HEAD@{commit (amend): ${newMessage}}`);
      return this.ok(`[${this.head.branch ?? 'detached'} ${id.slice(0, 7)}] ${newMessage}\n`);
    }
    if (message === undefined) {
      return this.err('Aborting commit due to empty commit message.');
    }
    const status = this.computeStatus();
    if (status.staged.length === 0) {
      return this.err('nothing to commit, working tree clean');
    }
    const parentId = this.headCommitId();
    const parents = parentId === undefined ? [] : [parentId];
    const id = this.createCommit(message, parents, cloneTree(this.index));
    this.setBranchHead(id);
    this.reflog.unshift(`${id.slice(0, 7)} HEAD@{commit: ${message}}`);
    return this.ok(`[${this.head.branch ?? 'detached'} ${id.slice(0, 7)}] ${message}\n`);
  }

  private extractMessage(args: string[]): string | undefined {
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      if (arg === undefined) {
        continue;
      }
      if (arg === '-m') {
        return args[index + 1];
      }
      if (arg.startsWith('--message=')) {
        return arg.slice('--message='.length);
      }
      if (arg.startsWith('-m') && arg.length > 2) {
        return arg.slice(2);
      }
    }
    return undefined;
  }

  private commitChain(startId: string | undefined): Commit[] {
    const chain: Commit[] = [];
    let cursor = startId;
    const visited = new Set<string>();
    while (cursor !== undefined && !visited.has(cursor)) {
      visited.add(cursor);
      const commit = this.commits.get(cursor);
      if (commit === undefined) {
        break;
      }
      chain.push(commit);
      cursor = commit.parents[0];
    }
    return chain;
  }

  private gitLog(args: string[]): ExecResult {
    const oneline = args.includes('--oneline');
    const refArg = args.find((arg) => !arg.startsWith('-'));
    const startId = refArg ? this.resolveRef(refArg) : this.headCommitId();
    if (startId === undefined) {
      return this.err('fatal: your current branch does not have any commits yet');
    }
    const chain = this.commitChain(startId);
    if (oneline) {
      const lines = chain.map((commit) => `${commit.id.slice(0, 7)} ${commit.message}`);
      return this.ok(`${lines.join('\n')}\n`);
    }
    const lines: string[] = [];
    for (const commit of chain) {
      lines.push(`commit ${commit.id}`);
      lines.push(`Date: ${this.authorClock(commit.seq)}`);
      lines.push('');
      lines.push(`    ${commit.message}`);
      lines.push('');
    }
    return this.ok(`${lines.join('\n')}\n`);
  }

  private gitDiff(_args: string[]): ExecResult {
    const status = this.computeStatus();
    const lines: string[] = [];
    for (const path of status.modified) {
      lines.push(`diff --git a/${path} b/${path}`);
    }
    return this.ok(lines.length > 0 ? `${lines.join('\n')}\n` : '');
  }

  private gitBranch(args: string[]): ExecResult {
    if (args.length === 0 || args.every((arg) => arg.startsWith('-') && arg !== '-d' && arg !== '-D' && arg !== '-m')) {
      const names = [...this.branches.keys()].sort();
      const lines = names.map((name) =>
        !this.head.detached && name === this.head.branch ? `* ${name}` : `  ${name}`,
      );
      return this.ok(`${lines.join('\n')}\n`);
    }
    if (args[0] === '-d' || args[0] === '-D') {
      const name = args[1];
      if (name === undefined) {
        return this.err('fatal: branch name required');
      }
      if (!this.branches.has(name)) {
        return this.err(`error: branch '${name}' not found.`);
      }
      if (!this.head.detached && name === this.head.branch) {
        return this.err(`error: cannot delete branch '${name}' checked out`);
      }
      this.branches.delete(name);
      return this.ok(`Deleted branch ${name}\n`);
    }
    if (args[0] === '-m') {
      const oldName = args[1];
      const newName = args[2];
      if (oldName === undefined || newName === undefined) {
        return this.err('fatal: branch rename requires old and new names');
      }
      const commit = this.branches.get(oldName);
      if (commit === undefined) {
        return this.err(`error: refname ${oldName} not found`);
      }
      if (this.branches.has(newName)) {
        return this.err(`fatal: a branch named '${newName}' already exists.`);
      }
      this.branches.delete(oldName);
      this.branches.set(newName, commit);
      if (!this.head.detached && this.head.branch === oldName) {
        this.head.branch = newName;
      }
      return this.ok('');
    }
    const name = args.find((arg) => !arg.startsWith('-'));
    if (name === undefined) {
      return this.err('fatal: branch name required');
    }
    if (this.branches.has(name)) {
      return this.err(`fatal: a branch named '${name}' already exists.`);
    }
    const target = this.headCommitId();
    if (target === undefined) {
      return this.err('fatal: not a valid object name: HEAD');
    }
    this.branches.set(name, target);
    return this.ok('');
  }

  private gitCheckout(args: string[]): ExecResult {
    if (args[0] === '-b') {
      const name = args[1];
      if (name === undefined) {
        return this.err('fatal: branch name required');
      }
      if (this.branches.has(name)) {
        return this.err(`fatal: a branch named '${name}' already exists.`);
      }
      const target = this.headCommitId();
      if (target === undefined) {
        return this.err('fatal: cannot create branch without a commit');
      }
      this.branches.set(name, target);
      this.head = { detached: false, branch: name };
      return this.ok(`Switched to a new branch '${name}'\n`);
    }
    const dashDash = args.indexOf('--');
    if (dashDash >= 0) {
      const paths = args.slice(dashDash + 1);
      const headTree = this.headTree();
      for (const path of paths) {
        const source = this.index[path] ?? headTree[path];
        if (source === undefined) {
          return this.err(`error: pathspec '${path}' did not match any file(s)`);
        }
        this.workingTree[path] = source;
      }
      return this.ok('');
    }
    const ref = args.find((arg) => !arg.startsWith('-'));
    if (ref === undefined) {
      return this.err('fatal: checkout target required');
    }
    if (this.branches.has(ref)) {
      const blocked = this.checkoutBlockedByLocalChanges();
      if (blocked !== null) {
        return blocked;
      }
      const commit = this.branches.get(ref);
      this.head = { detached: false, branch: ref };
      this.restoreTreeFromCommit(commit);
      return this.ok(`Switched to branch '${ref}'\n`);
    }
    const resolved = this.resolveRef(ref);
    if (resolved === undefined) {
      return this.err(`error: pathspec '${ref}' did not match any file(s) known to git`);
    }
    const blocked = this.checkoutBlockedByLocalChanges();
    if (blocked !== null) {
      return blocked;
    }
    this.head = { detached: true, commit: resolved };
    this.restoreTreeFromCommit(resolved);
    return this.ok(`Note: switching to '${ref}'. HEAD is now detached.\n`);
  }

  private gitSwitch(args: string[]): ExecResult {
    if (args[0] === '-c' || args[0] === '-C') {
      return this.gitCheckout(['-b', ...args.slice(1)]);
    }
    const ref = args.find((arg) => !arg.startsWith('-'));
    if (ref === undefined) {
      return this.err('fatal: switch target required');
    }
    if (this.branches.has(ref)) {
      return this.gitCheckout([ref]);
    }
    return this.err(`fatal: invalid reference: ${ref}`);
  }

  private checkoutBlockedByLocalChanges(): ExecResult | null {
    const status = this.computeStatus();
    if (status.clean) {
      return null;
    }
    const paths = [...new Set([...status.staged, ...status.modified])];
    const listing = paths.map((path) => `\t${path}`).join('\n');
    return this.err(
      `error: Your local changes to the following files would be overwritten by checkout:\n${listing}\nPlease commit your changes or stash them before you switch branches.`,
    );
  }

  private restoreTreeFromCommit(commitId: string | undefined): void {
    const tree = commitId === undefined ? {} : cloneTree(this.commits.get(commitId)?.tree ?? {});
    this.workingTree = cloneTree(tree);
    this.index = cloneTree(tree);
  }

  private isAncestor(ancestorId: string, descendantId: string): boolean {
    const stack = [descendantId];
    const visited = new Set<string>();
    while (stack.length > 0) {
      const current = stack.pop();
      if (current === undefined || visited.has(current)) {
        continue;
      }
      if (current === ancestorId) {
        return true;
      }
      visited.add(current);
      const commit = this.commits.get(current);
      if (commit) {
        stack.push(...commit.parents);
      }
    }
    return false;
  }

  private findMergeBase(a: string, b: string): string | undefined {
    const ancestorsOfA = new Set<string>();
    const stack = [a];
    while (stack.length > 0) {
      const current = stack.pop();
      if (current === undefined || ancestorsOfA.has(current)) {
        continue;
      }
      ancestorsOfA.add(current);
      const commit = this.commits.get(current);
      if (commit) {
        stack.push(...commit.parents);
      }
    }
    const queue = [b];
    const seen = new Set<string>();
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined || seen.has(current)) {
        continue;
      }
      seen.add(current);
      if (ancestorsOfA.has(current)) {
        return current;
      }
      const commit = this.commits.get(current);
      if (commit) {
        queue.push(...commit.parents);
      }
    }
    return undefined;
  }

  private threeWayMerge(
    base: Record<string, string>,
    ours: Record<string, string>,
    theirs: Record<string, string>,
  ): { tree: Record<string, string>; conflicts: string[] } {
    const conflicts: string[] = [];
    const tree: Record<string, string> = cloneTree(ours);
    const paths = new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)]);
    for (const path of paths) {
      const baseValue = base[path];
      const ourValue = ours[path];
      const theirValue = theirs[path];
      if (ourValue === theirValue) {
        continue;
      }
      if (ourValue === baseValue) {
        if (theirValue === undefined) {
          delete tree[path];
        } else {
          tree[path] = theirValue;
        }
        continue;
      }
      if (theirValue === baseValue) {
        continue;
      }
      conflicts.push(path);
      tree[path] = `<<<<<<< HEAD\n${ourValue ?? ''}=======\n${theirValue ?? ''}>>>>>>> incoming\n`;
    }
    return { tree, conflicts };
  }

  private gitMerge(args: string[]): ExecResult {
    const noFf = args.includes('--no-ff');
    const branchName = args.find((arg) => !arg.startsWith('-'));
    if (branchName === undefined) {
      return this.err('fatal: no merge target specified');
    }
    const theirId = this.resolveRef(branchName);
    if (theirId === undefined) {
      return this.err(`merge: ${branchName} - not something we can merge`);
    }
    const ourId = this.headCommitId();
    if (ourId === undefined) {
      return this.err('fatal: no commits on current branch');
    }
    if (this.isAncestor(theirId, ourId)) {
      return this.ok('Already up to date.\n');
    }
    if (!noFf && this.isAncestor(ourId, theirId)) {
      this.setBranchHead(theirId);
      this.restoreTreeFromCommit(theirId);
      return this.ok(`Fast-forward to ${theirId.slice(0, 7)}\n`);
    }
    const baseId = this.findMergeBase(ourId, theirId);
    const baseTree = baseId === undefined ? {} : this.commits.get(baseId)?.tree ?? {};
    const ourTree = this.commits.get(ourId)?.tree ?? {};
    const theirTree = this.commits.get(theirId)?.tree ?? {};
    const merged = this.threeWayMerge(baseTree, ourTree, theirTree);
    if (merged.conflicts.length > 0) {
      this.workingTree = cloneTree(merged.tree);
      return this.err(
        `CONFLICT (content): Merge conflict in ${merged.conflicts.join(', ')}\nAutomatic merge failed; fix conflicts and then commit the result.`,
      );
    }
    const message = `Merge branch '${branchName}'`;
    const id = this.createCommit(message, [ourId, theirId], merged.tree);
    this.setBranchHead(id);
    this.workingTree = cloneTree(merged.tree);
    this.index = cloneTree(merged.tree);
    return this.ok(`Merge made by the 'recursive' strategy.\n`);
  }

  private gitReset(args: string[]): ExecResult {
    let mode: 'soft' | 'mixed' | 'hard' = 'mixed';
    let ref: string | undefined;
    for (const arg of args) {
      if (arg === '--soft') mode = 'soft';
      else if (arg === '--mixed') mode = 'mixed';
      else if (arg === '--hard') mode = 'hard';
      else if (!arg.startsWith('-')) ref = arg;
    }
    const targetId = ref ? this.resolveRef(ref) : this.headCommitId();
    if (targetId === undefined) {
      return this.err(`fatal: ambiguous argument '${ref ?? 'HEAD'}': unknown revision`);
    }
    this.setBranchHead(targetId);
    const targetTree = cloneTree(this.commits.get(targetId)?.tree ?? {});
    if (mode === 'mixed' || mode === 'hard') {
      this.index = cloneTree(targetTree);
    }
    if (mode === 'hard') {
      this.workingTree = cloneTree(targetTree);
    }
    return this.ok('');
  }

  private gitRevert(args: string[]): ExecResult {
    const ref = args.find((arg) => !arg.startsWith('-'));
    if (ref === undefined) {
      return this.err('fatal: revert target required');
    }
    const targetId = this.resolveRef(ref);
    if (targetId === undefined) {
      return this.err(`fatal: bad revision '${ref}'`);
    }
    const target = this.commits.get(targetId);
    if (target === undefined) {
      return this.err('fatal: commit not found');
    }
    const parentId = target.parents[0];
    const parentTree = parentId === undefined ? {} : this.commits.get(parentId)?.tree ?? {};
    const ourId = this.headCommitId();
    if (ourId === undefined) {
      return this.err('fatal: no commits to revert onto');
    }
    const ourTree = this.commits.get(ourId)?.tree ?? {};
    const merged = this.threeWayMerge(target.tree, ourTree, parentTree);
    if (merged.conflicts.length > 0) {
      return this.err(`error: could not revert ${targetId.slice(0, 7)}`);
    }
    const message = `Revert "${target.message}"`;
    const id = this.createCommit(message, [ourId], merged.tree);
    this.setBranchHead(id);
    this.workingTree = cloneTree(merged.tree);
    this.index = cloneTree(merged.tree);
    return this.ok(`[${this.head.branch ?? 'detached'} ${id.slice(0, 7)}] ${message}\n`);
  }

  private gitRestore(args: string[]): ExecResult {
    const staged = args.includes('--staged');
    const paths = args.filter((arg) => !arg.startsWith('-'));
    const headTree = this.headTree();
    for (const path of paths) {
      if (staged) {
        if (headTree[path] === undefined) {
          delete this.index[path];
        } else {
          this.index[path] = headTree[path];
        }
      } else {
        const source = this.index[path] ?? headTree[path];
        if (source === undefined) {
          delete this.workingTree[path];
        } else {
          this.workingTree[path] = source;
        }
      }
    }
    return this.ok('');
  }

  private gitStash(args: string[]): ExecResult {
    const action = args[0] ?? 'push';
    if (action === 'list') {
      const lines = this.stashes.map((stash, index) => `stash@{${index}}: ${stash.message}`);
      return this.ok(lines.length > 0 ? `${lines.join('\n')}\n` : '');
    }
    if (action === 'pop') {
      const stash = this.stashes.shift();
      if (stash === undefined) {
        return this.err('No stash entries found.');
      }
      this.workingTree = cloneTree(stash.tree);
      this.index = cloneTree(stash.index);
      return this.ok(`Dropped ${stash.message}\n`);
    }
    if (action === 'apply') {
      const stash = this.stashes[0];
      if (stash === undefined) {
        return this.err('No stash entries found.');
      }
      this.workingTree = cloneTree(stash.tree);
      this.index = cloneTree(stash.index);
      return this.ok(`Applied ${stash.message}\n`);
    }
    const status = this.computeStatus();
    if (status.clean) {
      return this.ok('No local changes to save\n');
    }
    this.stashes.unshift({
      message: `WIP on ${this.head.branch ?? 'detached'}`,
      tree: cloneTree(this.workingTree),
      index: cloneTree(this.index),
    });
    const headTree = this.headTree();
    this.workingTree = cloneTree(headTree);
    this.index = cloneTree(headTree);
    return this.ok('Saved working directory and index state\n');
  }

  private gitCherryPick(args: string[]): ExecResult {
    const ref = args.find((arg) => !arg.startsWith('-'));
    if (ref === undefined) {
      return this.err('fatal: cherry-pick target required');
    }
    const targetId = this.resolveRef(ref);
    if (targetId === undefined) {
      return this.err(`fatal: bad revision '${ref}'`);
    }
    const target = this.commits.get(targetId);
    if (target === undefined) {
      return this.err('fatal: commit not found');
    }
    const parentId = target.parents[0];
    const parentTree = parentId === undefined ? {} : this.commits.get(parentId)?.tree ?? {};
    const ourId = this.headCommitId();
    if (ourId === undefined) {
      return this.err('fatal: no commits to cherry-pick onto');
    }
    const ourTree = this.commits.get(ourId)?.tree ?? {};
    const merged = this.threeWayMerge(parentTree, ourTree, target.tree);
    if (merged.conflicts.length > 0) {
      return this.err(`error: could not apply ${targetId.slice(0, 7)}... ${target.message}`);
    }
    const id = this.createCommit(target.message, [ourId], merged.tree);
    this.setBranchHead(id);
    this.workingTree = cloneTree(merged.tree);
    this.index = cloneTree(merged.tree);
    return this.ok('');
  }

  private gitRebase(args: string[]): ExecResult {
    const upstream = args.find((arg) => !arg.startsWith('-'));
    if (upstream === undefined) {
      return this.err('fatal: rebase target required');
    }
    const upstreamId = this.resolveRef(upstream);
    if (upstreamId === undefined) {
      return this.err(`fatal: invalid upstream '${upstream}'`);
    }
    const ourId = this.headCommitId();
    if (ourId === undefined) {
      return this.err('fatal: no commits to rebase');
    }
    if (this.isAncestor(ourId, upstreamId)) {
      this.setBranchHead(upstreamId);
      this.restoreTreeFromCommit(upstreamId);
      return this.ok(`Fast-forwarded to ${upstreamId.slice(0, 7)}\n`);
    }
    const baseId = this.findMergeBase(ourId, upstreamId);
    const ourChain = this.commitChain(ourId);
    const toReplay: Commit[] = [];
    for (const commit of ourChain) {
      if (commit.id === baseId) {
        break;
      }
      toReplay.unshift(commit);
    }
    let cursor = upstreamId;
    let cursorTree = cloneTree(this.commits.get(upstreamId)?.tree ?? {});
    for (const commit of toReplay) {
      const parentId = commit.parents[0];
      const parentTree = parentId === undefined ? {} : this.commits.get(parentId)?.tree ?? {};
      const merged = this.threeWayMerge(parentTree, cursorTree, commit.tree);
      if (merged.conflicts.length > 0) {
        return this.err(`error: could not apply ${commit.id.slice(0, 7)}... ${commit.message}`);
      }
      cursor = this.createCommit(commit.message, [cursor], merged.tree);
      cursorTree = cloneTree(merged.tree);
    }
    this.setBranchHead(cursor);
    this.workingTree = cloneTree(cursorTree);
    this.index = cloneTree(cursorTree);
    return this.ok(`Successfully rebased onto ${upstreamId.slice(0, 7)}\n`);
  }

  private gitTag(args: string[]): ExecResult {
    if (args.length === 0) {
      const names = [...this.tags.keys()].sort();
      return this.ok(names.length > 0 ? `${names.join('\n')}\n` : '');
    }
    const annotated = args.includes('-a');
    const name = args.find((arg) => !arg.startsWith('-') && arg !== this.extractMessage(args));
    const positional = args.filter((arg) => !arg.startsWith('-'));
    const tagName = annotated ? positional[0] : positional[0] ?? name;
    if (tagName === undefined) {
      return this.err('fatal: tag name required');
    }
    if (this.tags.has(tagName)) {
      return this.err(`fatal: tag '${tagName}' already exists`);
    }
    const targetRef = positional[1];
    const targetId = targetRef ? this.resolveRef(targetRef) : this.headCommitId();
    if (targetId === undefined) {
      return this.err('fatal: cannot tag without a commit');
    }
    this.tags.set(tagName, targetId);
    return this.ok('');
  }

  private gitReflog(_args: string[]): ExecResult {
    return this.ok(this.reflog.length > 0 ? `${this.reflog.join('\n')}\n` : '');
  }

  private gitRemote(args: string[]): ExecResult {
    if (args[0] === 'add') {
      const name = args[1];
      const url = args[2];
      if (name === undefined || url === undefined) {
        return this.err('usage: git remote add <name> <url>');
      }
      this.remotes.set(name, url);
      return this.ok('');
    }
    if (args.length === 0 || args[0] === '-v') {
      const lines: string[] = [];
      for (const [name, url] of this.remotes) {
        lines.push(`${name}\t${url}`);
      }
      return this.ok(lines.length > 0 ? `${lines.join('\n')}\n` : '');
    }
    return this.ok('');
  }

  private gitPush(_args: string[]): ExecResult {
    if (this.remotes.size === 0) {
      return this.err('fatal: No configured push destination.');
    }
    return this.ok('Everything up-to-date\n');
  }

  resolveRef(ref: string): string | undefined {
    if (ref === 'HEAD' || ref === '@') {
      return this.headCommitId();
    }
    const suffixMatch = /^(.+?)([~^].*)$/.exec(ref);
    if (suffixMatch) {
      const baseRef = suffixMatch[1] ?? '';
      const suffix = suffixMatch[2] ?? '';
      let cursor = this.resolveRef(baseRef);
      let pointer = 0;
      while (pointer < suffix.length && cursor !== undefined) {
        const char = suffix[pointer];
        if (char === '^') {
          pointer += 1;
          let digits = '';
          while (pointer < suffix.length && /\d/.test(suffix[pointer] ?? '')) {
            digits += suffix[pointer];
            pointer += 1;
          }
          const parentIndex = digits === '' ? 0 : Number.parseInt(digits, 10) - 1;
          cursor = this.commits.get(cursor)?.parents[parentIndex];
        } else if (char === '~') {
          pointer += 1;
          let digits = '';
          while (pointer < suffix.length && /\d/.test(suffix[pointer] ?? '')) {
            digits += suffix[pointer];
            pointer += 1;
          }
          const steps = digits === '' ? 1 : Number.parseInt(digits, 10);
          for (let step = 0; step < steps && cursor !== undefined; step += 1) {
            cursor = this.commits.get(cursor)?.parents[0];
          }
        } else {
          pointer += 1;
        }
      }
      return cursor;
    }
    if (this.branches.has(ref)) {
      return this.branches.get(ref);
    }
    if (this.tags.has(ref)) {
      return this.tags.get(ref);
    }
    if (this.commits.has(ref)) {
      return ref;
    }
    for (const id of this.commits.keys()) {
      if (id.startsWith(ref)) {
        return id;
      }
    }
    return undefined;
  }

  snapshot(): RepoSnapshot {
    const allCommits = [...this.commits.values()]
      .sort((a, b) => b.seq - a.seq)
      .map((commit) => ({ id: commit.id, message: commit.message, parents: [...commit.parents] }));
    return {
      head: { ...this.head },
      branches: [...this.branches.entries()]
        .map(([name, commit]) => ({ name, commit }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      tags: [...this.tags.entries()]
        .map(([name, commit]) => ({ name, commit }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      commits: allCommits,
      workingTree: cloneTree(this.workingTree),
      index: cloneTree(this.index),
      status: this.computeStatus(),
    };
  }

  getCommitCount(ref = 'HEAD'): number {
    const startId = this.resolveRef(ref);
    if (startId === undefined) {
      return 0;
    }
    const reachable = new Set<string>();
    const stack = [startId];
    while (stack.length > 0) {
      const current = stack.pop();
      if (current === undefined || reachable.has(current)) {
        continue;
      }
      reachable.add(current);
      const commit = this.commits.get(current);
      if (commit) {
        stack.push(...commit.parents);
      }
    }
    return reachable.size;
  }

  getFile(path: string, where: FileLocation = 'worktree'): string | undefined {
    if (where === 'head') {
      return this.headTree()[path];
    }
    return this.workingTree[path];
  }

  isTracked(path: string): boolean {
    return this.headTree()[path] !== undefined;
  }

  isStaged(path: string): boolean {
    return this.computeStatus().staged.includes(path);
  }

  branchExists(name: string): boolean {
    return this.branches.has(name);
  }

  headBranch(): string | undefined {
    return this.head.detached ? undefined : this.head.branch;
  }

  headDetached(): boolean {
    return this.head.detached;
  }

  resolves(refA: string, refB: string): boolean {
    const a = this.resolveRef(refA);
    const b = this.resolveRef(refB);
    return a !== undefined && a === b;
  }

  isClean(): boolean {
    return this.computeStatus().clean;
  }

  isMerged(branch: string, into = 'HEAD'): boolean {
    const branchId = this.resolveRef(branch);
    const intoId = this.resolveRef(into);
    if (branchId === undefined || intoId === undefined) {
      return false;
    }
    return this.isAncestor(branchId, intoId);
  }

  commitMessageAt(ref: string, index: number): string | undefined {
    const startId = this.resolveRef(ref);
    if (startId === undefined) {
      return undefined;
    }
    const chain = this.commitChain(startId);
    return chain[index]?.message;
  }

  tagExists(name: string): boolean {
    return this.tags.has(name);
  }

  treeMatchesHead(): boolean {
    return treesEqual(this.workingTree, this.headTree());
  }

  seedWorkingFile(path: string, content: string): void {
    this.workingTree[path] = content;
  }
}

export interface GitRepoInit {
  files?: Record<string, string>;
  commands?: string[];
}

export const createGitRepo = (initial: GitRepoInit = {}): GitRepo => {
  const repo = new GitRepo();
  if (initial.files) {
    for (const [path, content] of Object.entries(initial.files)) {
      repo.seedWorkingFile(path, content);
    }
  }
  if (initial.commands) {
    for (const command of initial.commands) {
      const result = repo.exec(command);
      if (result.code !== 0) {
        throw new GitError(`setup command failed: "${command}" -> ${result.stderr}`);
      }
    }
  }
  return repo;
};
