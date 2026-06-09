import { useEffect, useState } from 'react';

import { Database, Loader2, Play } from 'lucide-react';

import { cx } from '@/components/ui/cx';
import { getSqlRuntime } from '@/lib/sql-runtime';

import { ResultGrid } from './ResultGrid';
import { SqlVisualizer } from './SqlVisualizer';

interface SideSqlProps {
  fixture: string;
  query?: string;
  title?: string;
  schema?: boolean;
  autoRun?: boolean;
}

interface RunState {
  status: 'idle' | 'running' | 'pass' | 'fail';
  columns: string[];
  rows: Record<string, unknown>[];
  error?: string;
}

export const SideSql = ({
  fixture,
  query,
  title,
  schema = true,
  autoRun = true,
}: SideSqlProps) => {
  const [state, setState] = useState<RunState>({ status: 'idle', columns: [], rows: [] });

  const run = async (): Promise<void> => {
    if (!query) return;
    setState((prev) => ({ ...prev, status: 'running' }));
    try {
      const runtime = getSqlRuntime();
      const exec = await runtime.execute(query, fixture);
      setState({ status: 'pass', columns: exec.columns, rows: exec.rows });
    } catch (error) {
      setState({
        status: 'fail',
        columns: [],
        rows: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  useEffect(() => {
    if (autoRun && query) {
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, fixture, query]);

  if (schema && !query) {
    return (
      <aside className="not-prose my-5 rounded-2xl border border-border-base bg-surface/40 backdrop-blur-soft p-3">
        {title && (
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-fg-subtle mb-2">
            <Database size={12} className="text-accent" />
            {title}
          </div>
        )}
        <SqlVisualizer fixture={fixture} initialTab="schema" />
      </aside>
    );
  }

  return (
    <aside className="not-prose my-5 rounded-2xl border border-border-base bg-surface/40 backdrop-blur-soft overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-border-base bg-surface-2/40">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-fg-subtle min-w-0">
          <Database size={12} className="text-accent shrink-0" />
          <span className="truncate">{title ?? 'SQL'}</span>
        </div>
        {query && (
          <button
            type="button"
            onClick={run}
            disabled={state.status === 'running'}
            className={cx(
              'inline-flex items-center gap-1 rounded-md px-2 h-6 text-[11px] font-medium transition-colors duration-fast',
              'bg-accent/12 text-accent hover:bg-accent/20 disabled:opacity-60',
            )}
          >
            {state.status === 'running' ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Play size={11} />
            )}
            run
          </button>
        )}
      </header>
      {query && (
        <pre className="px-3.5 py-2 text-[12px] font-mono leading-relaxed text-fg whitespace-pre-wrap border-b border-border-base/60 bg-canvas/40 overflow-x-auto">
          {query.trim()}
        </pre>
      )}
      <div className="p-3">
        {state.status === 'idle' && (
          <p className="text-[12px] text-fg-subtle italic">Click run to execute.</p>
        )}
        {state.status === 'running' && (
          <p className="text-[12px] text-fg-subtle flex items-center gap-1.5">
            <Loader2 size={11} className="animate-spin" />
            running…
          </p>
        )}
        {state.status === 'pass' && (
          <ResultGrid columns={state.columns} rows={state.rows} highlight="pass" compact />
        )}
        {state.status === 'fail' && (
          <p className="text-[12px] text-rose-300 font-mono whitespace-pre-wrap">
            {state.error}
          </p>
        )}
      </div>
    </aside>
  );
};
