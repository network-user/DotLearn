import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';

import type { GitGoalAssertion } from '@dotlearn/contracts';
import {
  createGitRepo,
  evaluateGitGoals,
  GitError,
  type GitRepo,
  type GoalResult,
  type RepoSnapshot,
} from '@dotlearn/lesson-engine';
import { Check, FileDiff, GitBranch, RotateCcw, Target, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';

import { GitGraph } from './GitGraph';
import { completeCommand } from './completions';
import { GitTerminalSetupError } from './errors';
import { shellTokenClassName, tokenizeShellCommand } from './shellHighlight';

export interface GitTerminalInit {
  files?: Record<string, string>;
  commands?: string[];
}

export interface GitTerminalLabels {
  placeholder?: string;
  reset?: string;
  goal?: string;
  solved?: string;
}

export interface GitTerminalProps {
  initial?: GitTerminalInit;
  goal?: GitGoalAssertion[];
  labels?: GitTerminalLabels;
  className?: string;
  onSolved?: (commands: string[]) => void;
  onCommandsChange?: (commands: string[]) => void;
}

type LogTone = 'command' | 'stdout' | 'stderr' | 'system';

interface LogLine {
  id: number;
  tone: LogTone;
  text: string;
  promptBranch?: string | null;
  interrupted?: boolean;
}

const PROMPT_PATH = '~/repo';

const LOG_LINE_LIMIT = 500;
const INPUT_HISTORY_LIMIT = 100;

const INIT_PATTERN = /^\s*git\s+init(\s|$)/;

const branchLabel = (snapshot: RepoSnapshot | null): string | null => {
  if (snapshot === null) {
    return null;
  }
  if (snapshot.head.detached) {
    return snapshot.head.commit !== undefined ? snapshot.head.commit.slice(0, 7) : 'detached';
  }
  return snapshot.head.branch ?? null;
};

const HELP_LINES = [
  'Available commands:',
  '  git <subcommand>  init add rm status commit log diff branch checkout switch',
  '                    merge reset revert restore stash cherry-pick rebase tag',
  '                    reflog remote fetch pull push',
  '  shell             echo cat ls rm touch mkdir pwd',
  '  clear             clear the terminal (Ctrl+L)',
  '  help              show this message',
  'Tab completes, Up/Down recall history, Ctrl+C cancels the line.',
];

const HighlightedCommand = ({ line }: { line: string }) => (
  <>
    {tokenizeShellCommand(line).map((token, index) => (
      <span key={index} className={shellTokenClassName(token.kind)}>
        {token.text}
      </span>
    ))}
  </>
);

const Prompt = ({ branch }: { branch: string | null }) => (
  <span className="select-none">
    <span className="text-fg-subtle">{PROMPT_PATH}</span>
    {branch !== null && (
      <>
        <span className="text-fg-subtle"> (</span>
        <span className="text-accent">{branch}</span>
        <span className="text-fg-subtle">)</span>
      </>
    )}
    <span className="text-fg-muted"> $ </span>
  </span>
);

const buildRepo = (initial: GitTerminalInit | undefined): GitRepo => {
  const init: GitTerminalInit = {};
  if (initial?.files !== undefined) {
    init.files = initial.files;
  }
  if (initial?.commands !== undefined) {
    init.commands = initial.commands;
  }
  try {
    return createGitRepo(init);
  } catch (error) {
    if (error instanceof GitError) {
      throw new GitTerminalSetupError(error.message);
    }
    throw error;
  }
};

const goalLabelKey = (kind: string): string => `git.goals.${kind}`;

const statusToneRow = (
  label: string,
  items: string[],
  tone: 'staged' | 'modified' | 'untracked',
) => {
  if (items.length === 0) {
    return null;
  }
  const dotClass =
    tone === 'staged' ? 'bg-ok' : tone === 'modified' ? 'bg-warn' : 'bg-fg-subtle/60';
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <span className={cx('inline-block size-1.5 rounded-full', dotClass)} />
        <span className="text-[11px] font-medium text-fg-muted">{label}</span>
      </div>
      <ul className="pl-3.5 space-y-0.5">
        {items.map((path) => (
          <li key={path} className="font-mono text-[12px] text-fg truncate">
            {path}
          </li>
        ))}
      </ul>
    </div>
  );
};

export const GitTerminal = ({
  initial,
  goal,
  labels,
  className,
  onSolved,
  onCommandsChange,
}: GitTerminalProps) => {
  const { t } = useTranslation('runners');

  const repoRef = useRef<GitRepo | null>(null);
  const lineCounter = useRef(0);
  const solvedNotified = useRef(false);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const tabArmed = useRef(false);

  const [setupError, setSetupError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<RepoSnapshot | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [inputCursor, setInputCursor] = useState<number | null>(null);
  const [acceptedCommands, setAcceptedCommands] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [draft, setDraft] = useState('');
  const [resetNonce, setResetNonce] = useState(0);

  useEffect(() => {
    lineCounter.current = 0;
    solvedNotified.current = false;
    tabArmed.current = false;
    setInputHistory([]);
    setInputCursor(null);
    setAcceptedCommands([]);
    setDraft('');
    setLog([]);
    onCommandsChange?.([]);
    try {
      const repo = buildRepo(initial);
      repoRef.current = repo;
      setSnapshot(repo.snapshot());
      setInitialized((initial?.commands ?? []).some((command) => INIT_PATTERN.test(command)));
      setSetupError(null);
    } catch (error) {
      repoRef.current = null;
      setSnapshot(null);
      setInitialized(false);
      setSetupError(
        error instanceof GitTerminalSetupError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error),
      );
    }
  }, [initial, resetNonce, onCommandsChange]);

  const appendLog = useCallback((tone: LogTone, text: string): void => {
    lineCounter.current += 1;
    const id = lineCounter.current;
    setLog((prev) => [...prev, { id, tone, text }].slice(-LOG_LINE_LIMIT));
  }, []);

  useEffect(() => {
    const container = logContainerRef.current;
    if (container !== null) {
      container.scrollTop = container.scrollHeight;
    }
  }, [log]);

  useEffect(() => {
    const input = inputRef.current;
    const overlay = overlayRef.current;
    if (input !== null && overlay !== null) {
      overlay.scrollLeft = input.scrollLeft;
    }
  }, [draft]);

  const goalEvaluation = useMemo(() => {
    if (goal === undefined || goal.length === 0 || repoRef.current === null || snapshot === null) {
      return null;
    }
    return evaluateGitGoals(repoRef.current, goal);
  }, [goal, snapshot]);

  const solved = goalEvaluation?.met ?? false;

  useEffect(() => {
    if (solved && !solvedNotified.current) {
      solvedNotified.current = true;
      onSolved?.(acceptedCommands);
    }
    if (!solved) {
      solvedNotified.current = false;
    }
  }, [solved, acceptedCommands, onSolved]);

  const appendCommandLine = useCallback(
    (text: string, promptBranch: string | null, interrupted = false): void => {
      lineCounter.current += 1;
      const id = lineCounter.current;
      const nextLine: LogLine = { id, tone: 'command', text, promptBranch, interrupted };
      setLog((prev) => [...prev, nextLine].slice(-LOG_LINE_LIMIT));
    },
    [],
  );

  const runLine = useCallback(
    (rawLine: string): void => {
      const repo = repoRef.current;
      if (repo === null) {
        return;
      }
      const line = rawLine.trim();
      if (line === '') {
        return;
      }
      setInputHistory((prev) =>
        prev[prev.length - 1] === line ? prev : [...prev, line].slice(-INPUT_HISTORY_LIMIT),
      );
      setInputCursor(null);
      if (line === 'clear') {
        setLog([]);
        return;
      }
      const promptBranch = initialized ? branchLabel(repo.snapshot()) : null;
      appendCommandLine(line, promptBranch);
      if (line === 'help') {
        for (const helpLine of HELP_LINES) {
          appendLog('system', helpLine);
        }
        return;
      }
      const result = repo.exec(line);
      if (result.stdout !== '') {
        for (const outLine of result.stdout.replace(/\n$/, '').split('\n')) {
          appendLog('stdout', outLine);
        }
      }
      if (result.stderr !== '') {
        for (const errLine of result.stderr.replace(/\n$/, '').split('\n')) {
          appendLog('stderr', errLine);
        }
      }
      if (result.code === 0 && INIT_PATTERN.test(line)) {
        setInitialized(true);
      }
      if (result.code !== 0) {
        setSnapshot(repo.snapshot());
        return;
      }
      const nextCommands = [...acceptedCommands, line];
      setAcceptedCommands(nextCommands);
      onCommandsChange?.(nextCommands);
      setSnapshot(repo.snapshot());
    },
    [appendCommandLine, appendLog, acceptedCommands, initialized, onCommandsChange],
  );

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    if (draft.trim() === '') {
      return;
    }
    runLine(draft);
    setDraft('');
  };

  const handleTab = (): void => {
    const result = completeCommand(draft, snapshot);
    if (result.completed !== undefined) {
      setDraft(result.completed);
      tabArmed.current = result.candidates.length > 1;
      return;
    }
    if (result.candidates.length > 1) {
      if (tabArmed.current) {
        appendLog('system', result.candidates.join('  '));
      }
      tabArmed.current = true;
    }
  };

  const interruptLine = (): void => {
    const repo = repoRef.current;
    const branch = initialized && repo !== null ? branchLabel(repo.snapshot()) : null;
    appendCommandLine(draft, branch, true);
    setDraft('');
    setInputCursor(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Tab') {
      tabArmed.current = false;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      handleTab();
      return;
    }
    if (event.ctrlKey && (event.key === 'l' || event.key === 'L')) {
      event.preventDefault();
      setLog([]);
      return;
    }
    if (event.ctrlKey && (event.key === 'c' || event.key === 'C')) {
      const selection = window.getSelection();
      if (selection !== null && !selection.isCollapsed) {
        return;
      }
      event.preventDefault();
      interruptLine();
      return;
    }
    if (event.key === 'ArrowUp') {
      if (inputHistory.length === 0) {
        return;
      }
      event.preventDefault();
      const nextCursor =
        inputCursor === null ? inputHistory.length - 1 : Math.max(0, inputCursor - 1);
      setInputCursor(nextCursor);
      setDraft(inputHistory[nextCursor] ?? '');
    } else if (event.key === 'ArrowDown') {
      if (inputCursor === null) {
        return;
      }
      event.preventDefault();
      const nextCursor = inputCursor + 1;
      if (nextCursor >= inputHistory.length) {
        setInputCursor(null);
        setDraft('');
      } else {
        setInputCursor(nextCursor);
        setDraft(inputHistory[nextCursor] ?? '');
      }
    }
  };

  const handleLogClick = (): void => {
    const selection = window.getSelection();
    if (selection !== null && !selection.isCollapsed) {
      return;
    }
    inputRef.current?.focus();
  };

  const handleReset = (): void => {
    setResetNonce((value) => value + 1);
  };

  const placeholder =
    labels?.placeholder ?? t('git.placeholder', { defaultValue: 'введите команду git…' });
  const resetLabel = labels?.reset ?? t('git.reset', { defaultValue: 'Сбросить' });
  const goalLabel = labels?.goal ?? t('git.goal', { defaultValue: 'Цель' });
  const solvedLabel = labels?.solved ?? t('git.solved', { defaultValue: 'Решено' });

  if (setupError !== null) {
    return (
      <div
        className={cx(
          'rounded-lg border border-err/30 bg-err/8 px-4 py-3 text-[13px] text-err',
          className,
        )}
      >
        {t('git.setupError', {
          message: setupError,
          defaultValue: 'Ошибка подготовки: {{message}}',
        })}
      </div>
    );
  }

  const status = snapshot?.status;
  const liveBranch = initialized ? branchLabel(snapshot) : null;
  const terminalTitle = t('git.terminalTitle', { defaultValue: 'learner@dotlearn: ~/repo' });
  const terminalLabel = t('git.terminalLabel', { defaultValue: 'терминал git' });

  return (
    <div className={cx('space-y-3', className)}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <div className="min-w-0 space-y-3">
          <div
            className="overflow-hidden rounded-lg border border-border-base bg-code-bg"
            role="group"
            aria-label={terminalLabel}
          >
            <div className="flex items-center gap-2 border-b border-border-base bg-surface-2/60 px-3 py-2">
              <div className="flex shrink-0 items-center gap-1.5" aria-hidden>
                <span className="size-2.5 rounded-full bg-err/60" />
                <span className="size-2.5 rounded-full bg-warn/60" />
                <span className="size-2.5 rounded-full bg-ok/60" />
              </div>
              <span className="min-w-0 flex-1 select-none truncate font-mono text-[12px] text-fg-muted">
                {terminalTitle}
              </span>
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<RotateCcw size={13} />}
                onClick={handleReset}
                className="h-8 shrink-0"
              >
                {resetLabel}
              </Button>
            </div>
            <div
              ref={logContainerRef}
              onClick={handleLogClick}
              className="max-h-[280px] min-h-[160px] overflow-y-auto px-3 py-2.5 font-mono text-[13px] leading-relaxed"
              role="log"
              aria-live="polite"
            >
              {log.length === 0 ? (
                <p className="text-fg-subtle">
                  {t('git.emptyLog', {
                    defaultValue: 'Запускайте команды git и наблюдайте за графом.',
                  })}
                </p>
              ) : (
                log.map((line) => (
                  <div
                    key={line.id}
                    className={cx(
                      'whitespace-pre-wrap break-words',
                      line.tone === 'stdout' && 'text-fg-muted',
                      line.tone === 'stderr' && 'text-err',
                      line.tone === 'system' && 'text-fg-subtle',
                    )}
                  >
                    {line.tone === 'command' ? (
                      <span>
                        <Prompt branch={line.promptBranch ?? null} />
                        <HighlightedCommand line={line.text} />
                        {line.interrupted === true && (
                          <span className="select-none text-fg-muted">^C</span>
                        )}
                      </span>
                    ) : (
                      line.text
                    )}
                  </div>
                ))
              )}
            </div>
            <form
              onSubmit={handleSubmit}
              className="flex items-center border-t border-border-base bg-surface-2/40 px-3 py-2"
            >
              <span className="shrink-0 font-mono text-[16px] leading-[24px] sm:text-[13px]">
                <Prompt branch={liveBranch} />
              </span>
              <div className="relative min-h-[var(--tap)] min-w-0 flex-1 sm:min-h-0">
                <div
                  ref={overlayRef}
                  aria-hidden
                  className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre font-mono text-[16px] leading-[var(--tap)] text-fg-muted sm:text-[13px] sm:leading-[24px]"
                >
                  <HighlightedCommand line={draft} />
                </div>
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => {
                    tabArmed.current = false;
                    setDraft(event.target.value);
                  }}
                  onKeyDown={handleKeyDown}
                  onScroll={() => {
                    const overlay = overlayRef.current;
                    if (overlay !== null && inputRef.current !== null) {
                      overlay.scrollLeft = inputRef.current.scrollLeft;
                    }
                  }}
                  placeholder={placeholder}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoComplete="off"
                  aria-label={placeholder}
                  className="relative min-h-[var(--tap)] w-full bg-transparent font-mono text-[16px] leading-[24px] text-transparent caret-fg placeholder:text-fg-subtle focus:outline-none sm:min-h-0 sm:text-[13px]"
                />
              </div>
            </form>
          </div>

          {status !== undefined && (
            <div className="rounded-lg border border-border-base bg-surface px-3 py-2.5">
              <div className="mb-2 flex items-center gap-1.5">
                <FileDiff size={13} className="text-fg-muted" />
                <span className="eyebrow">{t('git.status.title', { defaultValue: 'Статус' })}</span>
                {status.clean && (
                  <Badge tone="success" variant="soft" className="ml-auto">
                    {t('git.status.clean', { defaultValue: 'чисто' })}
                  </Badge>
                )}
              </div>
              {status.clean ? (
                <p className="text-[12px] text-fg-subtle">
                  {t('git.status.nothing', { defaultValue: 'Рабочее дерево чистое.' })}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {statusToneRow(
                    t('git.status.staged', { defaultValue: 'в индексе' }),
                    status.staged,
                    'staged',
                  )}
                  {statusToneRow(
                    t('git.status.modified', { defaultValue: 'изменено' }),
                    status.modified,
                    'modified',
                  )}
                  {statusToneRow(
                    t('git.status.untracked', { defaultValue: 'не отслеживается' }),
                    status.untracked,
                    'untracked',
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-1.5">
            <GitBranch size={13} className="text-fg-muted" />
            <span className="eyebrow">
              {t('git.graph.title', { defaultValue: 'Граф коммитов' })}
            </span>
          </div>
          {snapshot !== null && <GitGraph snapshot={snapshot} className="max-h-[360px]" />}

          {goalEvaluation !== null && (
            <div
              className={cx(
                'rounded-lg border px-3 py-2.5 transition-colors',
                solved ? 'border-ok/40 bg-ok/8' : 'border-border-base bg-surface',
              )}
            >
              <div className="mb-2 flex items-center gap-1.5">
                <Target size={13} className={solved ? 'text-ok' : 'text-fg-muted'} />
                <span className="eyebrow">{goalLabel}</span>
                {solved && (
                  <Badge tone="success" variant="soft" className="ml-auto">
                    <Check size={11} />
                    {solvedLabel}
                  </Badge>
                )}
              </div>
              <ul className="space-y-1.5">
                {goalEvaluation.results.map((result, index) => (
                  <GoalRow key={`${result.kind}-${index}`} result={result} />
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const GoalRow = ({ result }: { result: GoalResult }) => {
  const { t } = useTranslation('runners');
  const label = t(goalLabelKey(result.kind), { defaultValue: result.kind });
  return (
    <li className="flex items-start gap-2 text-[12.5px]">
      <span
        className={cx(
          'mt-[1px] grid size-4 shrink-0 place-items-center rounded-full',
          result.ok ? 'bg-ok/15 text-ok' : 'bg-fg-subtle/15 text-fg-subtle',
        )}
      >
        {result.ok ? <Check size={11} /> : <X size={11} />}
      </span>
      <span className={cx('min-w-0', result.ok ? 'text-fg' : 'text-fg-muted')}>
        {label}
        {!result.ok && result.reason !== undefined && (
          <span className="block text-[11px] text-fg-subtle">{result.reason}</span>
        )}
      </span>
    </li>
  );
};
