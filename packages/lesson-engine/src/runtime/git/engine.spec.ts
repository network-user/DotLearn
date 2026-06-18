import { describe, expect, it } from 'vitest';

import { createGitRepo } from './engine';

const run = (repo: ReturnType<typeof createGitRepo>, commands: string[]): void => {
  for (const command of commands) {
    const result = repo.exec(command);
    expect(result.code, `command "${command}" failed: ${result.stderr}`).toBe(0);
  }
};

describe('git engine', () => {
  it('counts one commit after add and commit', () => {
    const repo = createGitRepo({ files: { 'a.txt': 'hello\n' }, commands: ['git init'] });
    run(repo, ['git add a.txt', 'git commit -m "init"']);
    expect(repo.getCommitCount('HEAD')).toBe(1);
    expect(repo.isTracked('a.txt')).toBe(true);
    expect(repo.isClean()).toBe(true);
  });

  it('is deterministic across two identical repos', () => {
    const build = () => {
      const repo = createGitRepo({ files: { 'a.txt': 'x\n' }, commands: ['git init'] });
      run(repo, ['git add a.txt', 'git commit -m "init"']);
      return repo.snapshot().commits[0]?.id;
    };
    expect(build()).toBe(build());
  });

  it('fast-forward merges a branch into main', () => {
    const repo = createGitRepo({ files: { 'a.txt': '1\n' }, commands: ['git init'] });
    run(repo, [
      'git add a.txt',
      'git commit -m "base"',
      'git checkout -b feature',
      'echo two > b.txt',
      'git add b.txt',
      'git commit -m "feature"',
      'git checkout main',
      'git merge feature',
    ]);
    expect(repo.isMerged('feature', 'main')).toBe(true);
    expect(repo.resolves('main', 'feature')).toBe(true);
    expect(repo.getCommitCount('HEAD')).toBe(2);
  });

  it('performs a 3-way merge with no conflict', () => {
    const repo = createGitRepo({ files: { 'a.txt': 'base\n' }, commands: ['git init'] });
    run(repo, [
      'git add a.txt',
      'git commit -m "base"',
      'git checkout -b feature',
      'echo feat > feat.txt',
      'git add feat.txt',
      'git commit -m "add feat"',
      'git checkout main',
      'echo main > main.txt',
      'git add main.txt',
      'git commit -m "add main"',
      'git merge feature',
    ]);
    expect(repo.isMerged('feature', 'main')).toBe(true);
    expect(repo.getFile('feat.txt', 'head')).toBe('feat\n');
    expect(repo.getFile('main.txt', 'head')).toBe('main\n');
    const head = repo.snapshot().commits.find((commit) => commit.parents.length === 2);
    expect(head).toBeDefined();
  });

  it('surfaces a merge conflict with a non-zero code', () => {
    const repo = createGitRepo({ files: { 'a.txt': 'base\n' }, commands: ['git init'] });
    run(repo, [
      'git add a.txt',
      'git commit -m "base"',
      'git checkout -b feature',
      'echo ours > a.txt',
      'git add a.txt',
      'git commit -m "feature edit"',
      'git checkout main',
      'echo theirs > a.txt',
      'git add a.txt',
      'git commit -m "main edit"',
    ]);
    const merge = repo.exec('git merge feature');
    expect(merge.code).not.toBe(0);
    expect(merge.stderr).toContain('CONFLICT');
  });

  it('reset --hard moves HEAD and rewrites the working tree', () => {
    const repo = createGitRepo({ files: { 'a.txt': '1\n' }, commands: ['git init'] });
    run(repo, [
      'git add a.txt',
      'git commit -m "first"',
      'echo two > a.txt',
      'git add a.txt',
      'git commit -m "second"',
    ]);
    expect(repo.getCommitCount('HEAD')).toBe(2);
    run(repo, ['git reset --hard HEAD~1']);
    expect(repo.getCommitCount('HEAD')).toBe(1);
    expect(repo.getFile('a.txt', 'worktree')).toBe('1\n');
    expect(repo.isClean()).toBe(true);
  });

  it('revert adds an inverse commit', () => {
    const repo = createGitRepo({ files: { 'a.txt': '1\n' }, commands: ['git init'] });
    run(repo, [
      'git add a.txt',
      'git commit -m "first"',
      'echo two > b.txt',
      'git add b.txt',
      'git commit -m "add b"',
      'git revert HEAD',
    ]);
    expect(repo.getCommitCount('HEAD')).toBe(3);
    expect(repo.getFile('b.txt', 'head')).toBeUndefined();
    expect(repo.commitMessageAt('HEAD', 0)).toContain('Revert');
  });

  it('detects an unclean working tree', () => {
    const repo = createGitRepo({ files: { 'a.txt': '1\n' }, commands: ['git init'] });
    run(repo, ['git add a.txt', 'git commit -m "first"']);
    expect(repo.isClean()).toBe(true);
    repo.exec('echo changed > a.txt');
    expect(repo.isClean()).toBe(false);
  });

  it('creates and lists a tag', () => {
    const repo = createGitRepo({ files: { 'a.txt': '1\n' }, commands: ['git init'] });
    run(repo, ['git add a.txt', 'git commit -m "first"', 'git tag v1.0.0']);
    expect(repo.tagExists('v1.0.0')).toBe(true);
    expect(repo.resolves('v1.0.0', 'HEAD')).toBe(true);
  });

  it('checkout -b creates and switches to a branch', () => {
    const repo = createGitRepo({ files: { 'a.txt': '1\n' }, commands: ['git init'] });
    run(repo, ['git add a.txt', 'git commit -m "first"', 'git checkout -b feature']);
    expect(repo.branchExists('feature')).toBe(true);
    expect(repo.headBranch()).toBe('feature');
    expect(repo.headDetached()).toBe(false);
  });

  it('detaches HEAD when checking out a commit', () => {
    const repo = createGitRepo({ files: { 'a.txt': '1\n' }, commands: ['git init'] });
    run(repo, [
      'git add a.txt',
      'git commit -m "first"',
      'echo two > a.txt',
      'git add a.txt',
      'git commit -m "second"',
    ]);
    run(repo, ['git checkout HEAD~1']);
    expect(repo.headDetached()).toBe(true);
    expect(repo.headBranch()).toBeUndefined();
  });

  it('stages a file and reports it via staged()', () => {
    const repo = createGitRepo({ files: { 'a.txt': '1\n' }, commands: ['git init'] });
    repo.exec('git add a.txt');
    expect(repo.isStaged('a.txt')).toBe(true);
    expect(repo.snapshot().status.staged).toContain('a.txt');
  });

  it('returns a non-zero code for an unknown command without throwing', () => {
    const repo = createGitRepo({ commands: ['git init'] });
    const result = repo.exec('git frobnicate');
    expect(result.code).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  it('resolves HEAD~n and short ids', () => {
    const repo = createGitRepo({ files: { 'a.txt': '1\n' }, commands: ['git init'] });
    run(repo, [
      'git add a.txt',
      'git commit -m "first"',
      'echo two > a.txt',
      'git add a.txt',
      'git commit -m "second"',
    ]);
    const snapshot = repo.snapshot();
    const firstCommitId = snapshot.commits[1]?.id ?? '';
    expect(repo.resolves('HEAD~1', firstCommitId.slice(0, 7))).toBe(true);
  });

  it('stages tracked deletions with commit -a', () => {
    const repo = createGitRepo({ files: { 'a.txt': '1\n' }, commands: ['git init'] });
    run(repo, ['git add a.txt', 'git commit -m "first"']);
    run(repo, ['rm a.txt']);
    run(repo, ['git commit -am "remove a"']);
    expect(repo.getFile('a.txt', 'head')).toBeUndefined();
    expect(repo.isClean()).toBe(true);
  });

  it('accepts commit -am"message" without a space before the message', () => {
    const repo = createGitRepo({ files: { 'a.txt': '1\n' }, commands: ['git init'] });
    run(repo, ['git add a.txt', 'git commit -am"init"']);
    expect(repo.getCommitCount('HEAD')).toBe(1);
  });

  it('keeps stash entries after apply', () => {
    const repo = createGitRepo({ files: { 'a.txt': '1\n' }, commands: ['git init'] });
    run(repo, ['git add a.txt', 'git commit -m "first"', 'echo wip > a.txt']);
    run(repo, ['git stash']);
    run(repo, ['git stash apply']);
    const list = repo.exec('git stash list');
    expect(list.code).toBe(0);
    expect(list.stdout).toContain('stash@{0}');
  });

  it('drops stash entries after pop', () => {
    const repo = createGitRepo({ files: { 'a.txt': '1\n' }, commands: ['git init'] });
    run(repo, ['git add a.txt', 'git commit -m "first"', 'echo wip > a.txt']);
    run(repo, ['git stash', 'git stash pop']);
    const list = repo.exec('git stash list');
    expect(list.stdout.trim()).toBe('');
  });

  it('refuses branch -m when the new name already exists', () => {
    const repo = createGitRepo({ files: { 'a.txt': '1\n' }, commands: ['git init'] });
    run(repo, ['git add a.txt', 'git commit -m "first"', 'git branch feature', 'git branch other']);
    const result = repo.exec('git branch -m feature other');
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('already exists');
  });

  it('blocks checkout when local changes would be overwritten', () => {
    const repo = createGitRepo({ files: { 'a.txt': '1\n' }, commands: ['git init'] });
    run(repo, [
      'git add a.txt',
      'git commit -m "first"',
      'git checkout -b feature',
      'git checkout main',
    ]);
    repo.exec('echo dirty > a.txt');
    const result = repo.exec('git checkout feature');
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('would be overwritten by checkout');
  });
});
