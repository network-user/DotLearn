import { useEffect, useMemo, useRef, useState } from 'react';

import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';
import {
  subscribePythonInitProgress,
  getLatestPythonInitProgress,
  type PyodideInitProgress,
} from '@/lib/python-runtime';

export type ConsoleLineTone = 'system' | 'prompt' | 'stdout' | 'pass' | 'fail' | 'meta';

export interface ConsoleLine {
  id: string;
  tone: ConsoleLineTone;
  text: string;
}

interface PythonConsoleProps {
  lines: ConsoleLine[];
  status?: 'idle' | 'loading' | 'running' | 'pass' | 'fail' | 'error';
  emptyMessage: string;
  showInitProgress?: boolean;
}

export const usePythonInitProgress = (active: boolean): PyodideInitProgress | undefined => {
  const [progress, setProgress] = useState<PyodideInitProgress | undefined>(() =>
    active ? getLatestPythonInitProgress() : undefined,
  );
  useEffect(() => {
    if (!active) return;
    setProgress(getLatestPythonInitProgress());
    return subscribePythonInitProgress(setProgress);
  }, [active]);
  return active ? progress : undefined;
};

const toneClass: Record<ConsoleLineTone, string> = {
  system: 'text-fg-subtle',
  prompt: 'text-accent-2',
  stdout: 'text-fg',
  pass: 'text-ok',
  fail: 'text-err',
  meta: 'text-fg-muted italic',
};

const statusLabel: Record<NonNullable<PythonConsoleProps['status']>, string> = {
  idle: '⏺',
  loading: 'loading',
  running: 'running',
  pass: 'ok',
  fail: 'fail',
  error: 'error',
};

const statusTint: Record<NonNullable<PythonConsoleProps['status']>, string> = {
  idle: 'text-fg-subtle',
  loading: 'text-warn',
  running: 'text-accent-2 dl-anim-breathe',
  pass: 'text-ok',
  fail: 'text-err',
  error: 'text-warn',
};

export const PythonConsole = ({
  lines,
  status = 'idle',
  emptyMessage,
  showInitProgress = true,
}: PythonConsoleProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const progress = usePythonInitProgress(showInitProgress && status === 'loading');

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div className="rounded-lg border border-border-base bg-surface overflow-hidden text-[13px] font-mono shadow-card">
      <header className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border-base bg-surface-2/60">
        <span className="eyebrow">python · pyodide</span>
        <span
          className={cx('text-[10.5px] uppercase tracking-widest tabular-nums', statusTint[status])}
        >
          {statusLabel[status]}
        </span>
      </header>
      {status === 'loading' && <PythonInitProgress progress={progress} />}
      <div
        ref={scrollRef}
        className="px-3 py-3 min-h-[120px] max-h-[80dvh] resize-y overflow-auto whitespace-pre-wrap bg-code-bg text-fg [scrollbar-width:thin]"
      >
        {lines.length === 0 ? (
          <p className="text-fg-subtle italic text-[12px]">{emptyMessage}</p>
        ) : (
          lines.map((line) => <ConsoleRow key={line.id} line={line} />)
        )}
      </div>
    </div>
  );
};

const formatMb = (bytes: number): string => (bytes / 1_048_576).toFixed(1);

const PythonInitProgress = ({ progress }: { progress: PyodideInitProgress | undefined }) => {
  const { t } = useTranslation('runners');
  const downloading = progress?.phase === 'download' && progress.totalBytes > 0;
  const ratio = downloading
    ? Math.min(1, progress.loadedBytes / progress.totalBytes)
    : progress && progress.phase !== 'download'
      ? 1
      : 0;
  const percent = Math.round(ratio * 100);
  const phaseLabel = progress
    ? progress.phase === 'download'
      ? t('python.init.downloading')
      : progress.phase === 'packages'
        ? t('python.init.packages')
        : t('python.init.starting')
    : t('python.init.starting');
  return (
    <div
      className="px-3 py-2 border-b border-border-base/60 bg-surface-2/40 space-y-1.5"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={t('python.init.aria')}
    >
      <div className="flex items-center justify-between gap-3 text-[11px] text-fg-muted">
        <span className="normal-case tracking-normal">{phaseLabel}</span>
        {downloading ? (
          <span className="tabular-nums text-fg-subtle">
            {formatMb(progress.loadedBytes)} / {formatMb(progress.totalBytes)} MB
          </span>
        ) : (
          <span className="tabular-nums text-fg-subtle">{percent}%</span>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-border-base overflow-hidden">
        <div
          className={cx(
            'h-full rounded-full bg-accent',
            downloading ? 'transition-[width] duration-fast' : 'dl-anim-breathe',
          )}
          style={{ width: downloading ? `${percent}%` : '100%' }}
        />
      </div>
      <p className="text-[10.5px] text-fg-subtle normal-case tracking-normal leading-snug">
        {t('python.init.note')}
      </p>
    </div>
  );
};

const ConsoleRow = ({ line }: { line: ConsoleLine }) => {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div
      className={cx(
        'leading-6 transition-opacity duration-fast',
        toneClass[line.tone],
        shown ? 'opacity-100' : 'opacity-0',
      )}
    >
      {line.tone === 'prompt' && <span className="select-none text-fg-subtle">{'>>> '}</span>}
      {line.text}
    </div>
  );
};

export interface TestCardData {
  id: string;
  call: string;
  status: 'pending' | 'pass' | 'fail';
  expected?: unknown;
  actual?: unknown;
  thrown?: { type: string; message: string };
}

interface TestListProps {
  cases: TestCardData[];
}

const formatValue = (value: unknown): string => {
  if (value === null) return 'None';
  if (value === undefined) return '—';
  if (typeof value === 'string') return JSON.stringify(value);
  return JSON.stringify(value);
};

export const TestList = ({ cases }: TestListProps) => {
  const { t } = useTranslation('runners');
  return (
    <ul className="space-y-2">
      {cases.map((test) => (
        <li
          key={test.id}
          className={cx(
            'rounded-lg border px-3 py-2 transition-colors duration-fast text-[12.5px] font-mono',
            test.status === 'pending' && 'border-border-base bg-surface',
            test.status === 'pass' && 'border-ok/30 bg-ok/8',
            test.status === 'fail' && 'border-err/30 bg-err/8',
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cx(
                'grid place-items-center size-5 rounded-md shrink-0',
                test.status === 'pending' && 'bg-surface-2/80 text-fg-subtle',
                test.status === 'pass' && 'bg-ok/15 text-ok',
                test.status === 'fail' && 'bg-err/15 text-err',
              )}
            >
              {test.status === 'pass' ? (
                <Check size={11} />
              ) : test.status === 'fail' ? (
                <X size={11} />
              ) : (
                <span className="text-[9.5px] opacity-70">⋯</span>
              )}
            </span>
            <code className="text-fg truncate">{test.call}</code>
          </div>
          {test.status === 'fail' && (
            <div className="mt-1.5 pl-7 space-y-0.5 text-[11.5px]">
              {test.thrown ? (
                <p className="text-err">
                  {t('python.raised')}{' '}
                  <code>
                    {test.thrown.type}: {test.thrown.message}
                  </code>
                </p>
              ) : (
                <>
                  <p className="text-fg-muted">
                    {t('python.expected')}{' '}
                    <code className="text-ok">{formatValue(test.expected)}</code>
                  </p>
                  <p className="text-fg-muted">
                    {t('python.got')} <code className="text-err">{formatValue(test.actual)}</code>
                  </p>
                </>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
};

export const buildIdleLines = (intro: string): ConsoleLine[] => [
  { id: 'sys-intro', tone: 'system', text: intro },
];

export const linesForRunStart = (sessionId: number): ConsoleLine[] => [
  {
    id: `s-${sessionId}-start`,
    tone: 'system',
    text: '$ python -m runner',
  },
];

export const useStableId = (): string => useMemo(() => Math.random().toString(36).slice(2, 8), []);
