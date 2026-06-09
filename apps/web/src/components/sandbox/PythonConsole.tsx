import { useEffect, useMemo, useRef, useState } from 'react';

import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';

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
}

const toneClass: Record<ConsoleLineTone, string> = {
  system: 'text-fg-subtle',
  prompt: 'text-accent-2',
  stdout: 'text-fg',
  pass: 'text-emerald-300',
  fail: 'text-rose-300',
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
  loading: 'text-amber-300',
  running: 'text-accent-2 dl-anim-breathe',
  pass: 'text-emerald-300',
  fail: 'text-rose-300',
  error: 'text-amber-300',
};

export const PythonConsole = ({ lines, status = 'idle', emptyMessage }: PythonConsoleProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div className="rounded-xl border border-border-base bg-black/85 overflow-hidden text-[13px] font-mono shadow-card">
      <header className="flex items-center justify-between gap-3 px-3 py-2 border-b border-white/8 bg-black/40">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-rose-400/80" />
          <span className="size-2.5 rounded-full bg-amber-400/80" />
          <span className="size-2.5 rounded-full bg-emerald-400/80" />
        </div>
        <span className="text-[10.5px] uppercase tracking-widest text-zinc-400">python · pyodide</span>
        <span className={cx('text-[10.5px] uppercase tracking-widest tabular-nums', statusTint[status])}>
          {statusLabel[status]}
        </span>
      </header>
      <div
        ref={scrollRef}
        className="px-3 py-3 max-h-[260px] overflow-y-auto whitespace-pre-wrap text-zinc-200 [scrollbar-width:thin]"
      >
        {lines.length === 0 ? (
          <p className="text-zinc-500 italic text-[12px]">{emptyMessage}</p>
        ) : (
          lines.map((line) => <ConsoleRow key={line.id} line={line} />)
        )}
      </div>
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
      {line.tone === 'prompt' && <span className="select-none text-zinc-500">{'>>> '}</span>}
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
            'rounded-xl border px-3 py-2 transition-colors duration-fast text-[12.5px] font-mono',
            test.status === 'pending' && 'border-border-base bg-surface/40',
            test.status === 'pass' && 'border-emerald-500/30 bg-emerald-500/8',
            test.status === 'fail' && 'border-rose-500/30 bg-rose-500/8',
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cx(
                'grid place-items-center size-5 rounded-md shrink-0',
                test.status === 'pending' && 'bg-surface-2/80 text-fg-subtle',
                test.status === 'pass' && 'bg-emerald-500/20 text-emerald-300',
                test.status === 'fail' && 'bg-rose-500/20 text-rose-300',
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
                <p className="text-rose-200">
                  {t('python.raised')} <code>{test.thrown.type}: {test.thrown.message}</code>
                </p>
              ) : (
                <>
                  <p className="text-fg-muted">
                    {t('python.expected')}{' '}
                    <code className="text-emerald-300">{formatValue(test.expected)}</code>
                  </p>
                  <p className="text-fg-muted">
                    {t('python.got')}{' '}
                    <code className="text-rose-300">{formatValue(test.actual)}</code>
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
