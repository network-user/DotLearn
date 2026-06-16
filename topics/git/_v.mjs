import { createGitRepo, evaluateGitGoals } from 'file:///C:/Users/User/PycharmProjects/DotLearn/packages/lesson-engine/src/runtime/git/index.ts';
function run(label, init, solution, goals) {
  let repo;
  try { repo = createGitRepo(init); } catch (e) { console.log(`[${label}] SETUP FAILED: ${e.message}`); return; }
  for (const cmd of solution) { const t = cmd.trim(); if (t === '' || t.startsWith('#')) continue; const r = repo.exec(t); if (r.code !== 0) { console.log(`[${label}] CMD FAILED "${t}": ${r.stderr}`); return; } }
  const ev = evaluateGitGoals(repo, goals);
  if (ev.met) console.log(`[${label}] PASS`); else { console.log(`[${label}] UNMET:`); for (const res of ev.results) if (!res.ok) console.log(`    - ${res.kind}: ${res.reason}`); }
}

run('feature-cycle', { files: { 'README.md': '# Проект\n' }, commands: ['git init', 'git add README.md', 'git commit -m "init"'] },
  ['git switch -c feature/login', 'echo форма входа > login.py', 'git add login.py', 'git commit -m "add login"', 'git switch main', 'git merge feature/login'],
  [{ kind: 'head-on-branch', name: 'main' }, { kind: 'file-tracked', path: 'login.py' }, { kind: 'merged', branch: 'feature/login', into: 'HEAD' }, { kind: 'commit-count', ref: 'HEAD', equals: 2 }]);
