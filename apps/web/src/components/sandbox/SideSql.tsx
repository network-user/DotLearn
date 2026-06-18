import { useEffect, useMemo, useRef, useState } from 'react';

import { Database, Loader2, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { BarChart } from '@/components/article/charts/BarChart';
import { LineChart } from '@/components/article/charts/LineChart';
import { cx } from '@/components/ui/cx';
import { getSqlRuntime } from '@/lib/sql-runtime';
import { useDebouncedValue } from '@/lib/use-debounced-value';

import { ResultGrid } from './ResultGrid';
import { SqlVisualizer } from './SqlVisualizer';

interface SideSqlChart {
  type: 'bar' | 'line';
  x: string;
  y: string;
}

interface SideSqlProps {
  fixture: string;
  query?: string;
  title?: string;
  schema?: boolean;
  autoRun?: boolean;
  editable?: boolean;
  live?: boolean;
  chart?: SideSqlChart;
}

interface SqlResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

const toNumber = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const SideSql = ({
  fixture,
  query,
  title,
  schema = true,
  autoRun = true,
  editable = false,
  live = false,
  chart,
}: SideSqlProps) => {
  const { t } = useTranslation('viz');
  const isEditable = editable || live;
  const [source, setSource] = useState((query ?? '').trim());
  const debouncedSource = useDebouncedValue(source, 350);
  const [result, setResult] = useState<SqlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const runCounter = useRef(0);

  const execute = async (sql: string): Promise<void> => {
    if (!sql.trim()) return;
    const runId = ++runCounter.current;
    setRunning(true);
    try {
      const runtime = getSqlRuntime();
      const exec = await runtime.execute(sql, fixture);
      if (runId !== runCounter.current) return;
      setResult({ columns: exec.columns, rows: exec.rows });
      setError(null);
    } catch (caught) {
      if (runId !== runCounter.current) return;
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (runId === runCounter.current) {
        setRunning(false);
      }
    }
  };

  useEffect(() => {
    if (autoRun && query) {
      setStarted(true);
      void execute((query ?? '').trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (live && started) {
      void execute(debouncedSource);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSource, live, started]);

  const chartData = useMemo(() => {
    if (!chart || !result) return null;
    if (!result.columns.includes(chart.x) || !result.columns.includes(chart.y)) return null;
    return result.rows.map((row) => ({
      label: String(row[chart.x] ?? ''),
      value: toNumber(row[chart.y]),
    }));
  }, [chart, result]);

  if (schema && !query) {
    return (
      <aside className="not-prose my-6 rounded-lg border border-border-base bg-surface p-3">
        {title && (
          <div className="flex items-center gap-1.5 eyebrow mb-2">
            <Database size={12} className="text-accent" />
            {title}
          </div>
        )}
        <SqlVisualizer fixture={fixture} initialTab="schema" />
      </aside>
    );
  }

  const manualRun = (): void => {
    setStarted(true);
    void execute(source);
  };

  return (
    <aside className="not-prose my-6 rounded-lg border border-border-base bg-surface overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-border-base bg-surface-2/60">
        <div className="flex items-center gap-1.5 eyebrow min-w-0">
          <Database size={12} className="text-accent shrink-0" />
          <span className="truncate">{title ?? 'SQL'}</span>
          {live && (
            <span className="ml-1 inline-flex items-center gap-1 normal-case tracking-normal font-medium text-[10px] text-ok">
              <span className={cx('size-1.5 rounded-full bg-ok', running && 'dl-anim-breathe')} />
              {t('sandbox.live', { defaultValue: 'live' })}
            </span>
          )}
        </div>
        {!live && (
          <button
            type="button"
            onClick={manualRun}
            disabled={running}
            className={cx(
              'inline-flex items-center gap-1 rounded-sm px-2 h-6 text-[11px] font-medium transition-colors duration-fast',
              'bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-60',
            )}
          >
            {running ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
            {t('sandbox.run', { defaultValue: 'выполнить' })}
          </button>
        )}
      </header>
      {isEditable ? (
        <textarea
          value={source}
          onChange={(event) => {
            setSource(event.target.value);
            if (live) setStarted(true);
          }}
          spellCheck={false}
          aria-label={title ?? 'SQL'}
          className="block w-full bg-code-bg text-fg font-mono text-[16px] sm:text-[12.5px] leading-relaxed px-3.5 py-2.5 outline-none resize-y min-h-[64px] border-b border-border-base/60"
          rows={Math.max(2, Math.min(10, source.split('\n').length + 1))}
        />
      ) : (
        <pre className="px-3.5 py-2 text-[12px] font-mono leading-relaxed text-fg whitespace-pre-wrap border-b border-border-base/60 bg-code-bg overflow-x-auto">
          {source}
        </pre>
      )}
      <div className="p-3 space-y-3">
        {!started && !result && (
          <p className="text-[12px] text-fg-subtle italic">
            {t('sandbox.clickRun', { defaultValue: 'Нажми «выполнить», чтобы запустить запрос.' })}
          </p>
        )}
        {running && !result && (
          <p className="text-[12px] text-fg-subtle flex items-center gap-1.5">
            <Loader2 size={11} className="animate-spin" />
            {t('sandbox.running', { defaultValue: 'выполняется…' })}
          </p>
        )}
        {result && (
          <div className={cx(error && 'opacity-50 transition-opacity')}>
            <ResultGrid columns={result.columns} rows={result.rows} highlight="pass" compact />
          </div>
        )}
        {chartData && chartData.length > 0 && !error && (
          <div className="pt-1 border-t border-border-base/60">
            {chart?.type === 'line' ? (
              <LineChart
                series={[
                  {
                    name: chart.y,
                    points: chartData.map((point, index) => ({ x: index, y: point.value })),
                  },
                ]}
                title={`${chart.y} / ${chart.x}`}
              />
            ) : (
              <BarChart data={chartData} title={`${chart!.y} / ${chart!.x}`} />
            )}
          </div>
        )}
        {error && <p className="text-[12px] text-err font-mono whitespace-pre-wrap">{error}</p>}
      </div>
    </aside>
  );
};
