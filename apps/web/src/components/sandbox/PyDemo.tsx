import { useCallback, useState } from 'react';

import { Loader2, Play, RotateCcw } from 'lucide-react';

import { cx } from '@/components/ui/cx';
import { getPythonRuntime } from '@/lib/python-runtime';

import { PythonConsole, type ConsoleLine } from './PythonConsole';

interface PyDemoProps {
  code: string;
  title?: string;
  /** Optional final expression to evaluate and show as → value */
  call?: string;
  autoRun?: boolean;
}

type RunStatus = 'idle' | 'loading' | 'running' | 'pass' | 'fail';

const splitLines = (
  text: string,
  idPrefix: string,
  tone: 'stdout' | 'fail',
): ConsoleLine[] =>
  text
    .split('\n')
    .filter((line, index, arr) => !(index === arr.length - 1 && line === ''))
    .map((line, index) => ({ id: `${idPrefix}-${index}`, tone, text: line }));

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return 'None';
  if (typeof value === 'string') return `'${value}'`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const PyDemo = ({ code, title, call, autoRun = false }: PyDemoProps) => {
  const initialCode = code.trim();
  const [source, setSource] = useState(initialCode);
  const [status, setStatus] = useState<RunStatus>('idle');
  const [lines, setLines] = useState<ConsoleLine[]>([
    { id: 'intro', tone: 'system', text: '# python · pyodide demo' },
  ]);
  const [session, setSession] = useState(0);
  const [autoRunDone, setAutoRunDone] = useState(false);

  const run = useCallback(async () => {
    setStatus('loading');
    const sid = session + 1;
    setSession(sid);
    setLines([{ id: `s${sid}-load`, tone: 'system', text: '$ python <<demo' }]);
    try {
      const runtime = getPythonRuntime();
      await runtime.init();
      setStatus('running');
      const execution = await runtime.evaluate(source, call ?? 'None');
      const stdout = execution.stdout ?? '';
      const next: ConsoleLine[] = [];
      if (stdout) {
        next.push(...splitLines(stdout, `s${sid}-out`, 'stdout'));
      }
      if (execution.thrown) {
        next.push({
          id: `s${sid}-err`,
          tone: 'fail',
          text: `${execution.thrown.type}: ${execution.thrown.message}`,
        });
        setLines((prev) => [...prev, ...next]);
        setStatus('fail');
        return;
      }
      if (call && execution.result !== undefined && execution.result !== null) {
        next.push({
          id: `s${sid}-val`,
          tone: 'meta',
          text: `→ ${formatValue(execution.result)}`,
        });
      }
      if (next.length === 0) {
        next.push({ id: `s${sid}-ok`, tone: 'system', text: '# ok (no output)' });
      }
      setLines((prev) => [...prev, ...next]);
      setStatus('pass');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLines((prev) => [
        ...prev,
        { id: `s${sid}-thrown`, tone: 'fail', text: `[runtime] ${message}` },
      ]);
      setStatus('fail');
    }
  }, [call, session, source]);

  const reset = (): void => {
    setSource(initialCode);
    setStatus('idle');
    setLines([{ id: 'intro', tone: 'system', text: '# python · pyodide demo' }]);
  };

  if (autoRun && !autoRunDone && status === 'idle') {
    setAutoRunDone(true);
    void run();
  }

  return (
    <aside className="not-prose my-5 rounded-2xl border border-border-base bg-surface/40 backdrop-blur-soft overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-border-base bg-surface-2/40">
        <span className="text-[11px] uppercase tracking-widest text-fg-subtle">
          {title ?? 'Python demo'}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 rounded-md px-1.5 h-6 text-[11px] text-fg-muted hover:text-fg hover:bg-surface-2/60 transition-colors"
            aria-label="reset"
          >
            <RotateCcw size={11} />
          </button>
          <button
            type="button"
            onClick={run}
            disabled={status === 'loading' || status === 'running'}
            className={cx(
              'inline-flex items-center gap-1 rounded-md px-2 h-6 text-[11px] font-medium transition-colors duration-fast',
              'bg-accent/12 text-accent hover:bg-accent/20 disabled:opacity-60',
            )}
          >
            {status === 'loading' || status === 'running' ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Play size={11} />
            )}
            run
          </button>
        </div>
      </header>
      <textarea
        value={source}
        onChange={(event) => setSource(event.target.value)}
        spellCheck={false}
        className="block w-full bg-canvas/40 text-fg font-mono text-[12.5px] leading-relaxed px-3.5 py-2.5 outline-none resize-y min-h-[80px]"
        rows={Math.max(3, Math.min(12, initialCode.split('\n').length + 1))}
      />
      <div className="border-t border-border-base">
        <PythonConsole
          lines={lines}
          status={status === 'pass' ? 'pass' : status === 'fail' ? 'fail' : status}
          emptyMessage="Run to see output."
        />
      </div>
    </aside>
  );
};
