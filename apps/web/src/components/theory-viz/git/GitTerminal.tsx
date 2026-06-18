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
import { GitTerminalSetupError } from './errors';

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
}

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
  const logEndRef = useRef<HTMLDivElement | null>(null);

  const [setupError, setSetupError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<RepoSnapshot | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [resetNonce, setResetNonce] = useState(0);

  useEffect(() => {
    lineCounter.current = 0;
    solvedNotified.current = false;
    setHistory([]);
    setHistoryCursor(null);
    setDraft('');
    setLog([]);
    onCommandsChange?.([]);
    try {
      const repo = buildRepo(initial);
      repoRef.current = repo;
      setSnapshot(repo.snapshot());
      setSetupError(null);
    } catch (error) {
      repoRef.current = null;
      setSnapshot(null);
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
    setLog((prev) => [...prev, { id, tone, text }]);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: 'end' });
  }, [log]);

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
      onSolved?.(history);
    }
    if (!solved) {
      solvedNotified.current = false;
    }
  }, [solved, history, onSolved]);

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
      appendLog('command', line);
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
      if (result.code !== 0) {
        setSnapshot(repo.snapshot());
        return;
      }
      const nextHistory = [...history, line];
      setHistory(nextHistory);
      setHistoryCursor(null);
      onCommandsChange?.(nextHistory);
      setSnapshot(repo.snapshot());
    },
    [appendLog, history, onCommandsChange],
  );

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    if (draft.trim() === '') {
      return;
    }
    runLine(draft);
    setDraft('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowUp') {
      if (history.length === 0) {
        return;
      }
      event.preventDefault();
      const nextCursor =
        historyCursor === null ? history.length - 1 : Math.max(0, historyCursor - 1);
      setHistoryCursor(nextCursor);
      setDraft(history[nextCursor] ?? '');
    } else if (event.key === 'ArrowDown') {
      if (historyCursor === null) {
        return;
      }
      event.preventDefault();
      const nextCursor = historyCursor + 1;
      if (nextCursor >= history.length) {
        setHistoryCursor(null);
        setDraft('');
      } else {
        setHistoryCursor(nextCursor);
        setDraft(history[nextCursor] ?? '');
      }
    }
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

  return (
    <div className={cx('space-y-3', className)}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <div className="min-w-0 space-y-3">
          <div className="overflow-hidden rounded-lg border border-border-base bg-code-bg">
            <div className="flex items-center justify-between gap-2 border-b border-border-base bg-surface-2/60 px-3 py-2">
              <span className="eyebrow font-mono">git</span>
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<RotateCcw size={13} />}
                onClick={handleReset}
                className="h-8"
              >
                {resetLabel}
              </Button>
            </div>
            <div
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
                      line.tone === 'command' && 'text-fg',
                      line.tone === 'stdout' && 'text-fg-muted',
                      line.tone === 'stderr' && 'text-err',
                      line.tone === 'system' && 'text-fg-subtle',
                    )}
                  >
                    {line.tone === 'command' ? (
                      <span>
                        <span className="text-accent select-none">$ </span>
                        {line.text}
                      </span>
                    ) : (
                      line.text
                    )}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 border-t border-border-base bg-surface-2/40 px-3 py-2"
            >
              <span className="select-none font-mono text-[15px] text-accent">$</span>
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                aria-label={placeholder}
                className="min-h-[var(--tap)] flex-1 bg-transparent font-mono text-[16px] text-fg placeholder:text-fg-subtle focus:outline-none sm:min-h-0 sm:text-[13px]"
              />
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
