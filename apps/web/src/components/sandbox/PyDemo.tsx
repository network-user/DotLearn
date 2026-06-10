import { useCallback, useMemo, useState } from 'react';

import { Loader2, Play, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { BarChart } from '@/components/article/charts/BarChart';
import { LineChart } from '@/components/article/charts/LineChart';
import { cx } from '@/components/ui/cx';
import { getPythonRuntime } from '@/lib/python-runtime';

import { PythonConsole, type ConsoleLine } from './PythonConsole';

interface PyDemoChart {
  type: 'bar' | 'line';
  label?: string;
}

interface PyDemoProps {
  code: string;
  title?: string;
  call?: string;
  autoRun?: boolean;
  chart?: PyDemoChart;
}

type RunStatus = 'idle' | 'loading' | 'running' | 'pass' | 'fail';

const splitLines = (text: string, idPrefix: string, tone: 'stdout' | 'fail'): ConsoleLine[] =>
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

const toChartData = (value: unknown): { label: string; value: number }[] | null => {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (value.every((item) => typeof item === 'number')) {
    return (value as number[]).map((item, index) => ({ label: `${index}`, value: item }));
  }
  if (
    value.every(
      (item) =>
        Array.isArray(item) &&
        item.length === 2 &&
        (typeof item[0] === 'string' || typeof item[0] === 'number') &&
        typeof item[1] === 'number',
    )
  ) {
    return (value as [string | number, number][]).map(([label, item]) => ({
      label: String(label),
      value: item,
    }));
  }
  return null;
};

export const PyDemo = ({ code, title, call, autoRun = false, chart }: PyDemoProps) => {
  const { t } = useTranslation('viz');
  const initialCode = code.trim();
  const [source, setSource] = useState(initialCode);
  const [lastRanSource, setLastRanSource] = useState<string | null>(null);
  const [status, setStatus] = useState<RunStatus>('idle');
  const [resultValue, setResultValue] = useState<unknown>(undefined);
  const [lines, setLines] = useState<ConsoleLine[]>([
    { id: 'intro', tone: 'system', text: '# python · pyodide' },
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
      setLastRanSource(source);
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
        setResultValue(undefined);
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
      setResultValue(execution.result);
      setStatus('pass');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLines((prev) => [
        ...prev,
        { id: `s${sid}-thrown`, tone: 'fail', text: `[runtime] ${message}` },
      ]);
      setResultValue(undefined);
      setStatus('fail');
    }
  }, [call, session, source]);

  const reset = (): void => {
    setSource(initialCode);
    setLastRanSource(null);
    setResultValue(undefined);
    setStatus('idle');
    setLines([{ id: 'intro', tone: 'system', text: '# python · pyodide' }]);
  };

  if (autoRun && !autoRunDone && status === 'idle') {
    setAutoRunDone(true);
    void run();
  }

  const modified = lastRanSource !== null && source !== lastRanSource;
  const chartData = useMemo(() => (chart ? toChartData(resultValue) : null), [chart, resultValue]);

  return (
    <aside className="not-prose my-6 rounded-lg border border-border-base bg-surface overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-border-base bg-surface-2/60">
        <span className="eyebrow flex items-center gap-2 min-w-0">
          <span className="truncate">{title ?? 'Python'}</span>
          {modified && (
            <span className="normal-case tracking-normal font-medium text-[10px] text-warn">
              {t('sandbox.modified', { defaultValue: 'изменено — запусти снова' })}
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 rounded-sm px-1.5 h-6 text-[11px] text-fg-muted hover:text-fg hover:bg-surface-2/60 transition-colors"
            aria-label={t('sandbox.reset', { defaultValue: 'сбросить' })}
          >
            <RotateCcw size={11} />
          </button>
          <button
            type="button"
            onClick={run}
            disabled={status === 'loading' || status === 'running'}
            className={cx(
              'inline-flex items-center gap-1 rounded-sm px-2 h-6 text-[11px] font-medium transition-colors duration-fast',
              modified
                ? 'bg-warn/15 text-warn hover:bg-warn/25'
                : 'bg-accent/10 text-accent hover:bg-accent/20',
              'disabled:opacity-60',
            )}
          >
            {status === 'loading' || status === 'running' ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Play size={11} />
            )}
            {t('sandbox.run', { defaultValue: 'выполнить' })}
          </button>
        </div>
      </header>
      <textarea
        value={source}
        onChange={(event) => setSource(event.target.value)}
        spellCheck={false}
        aria-label={title ?? 'Python'}
        className="block w-full bg-code-bg text-fg font-mono text-[16px] sm:text-[12.5px] leading-relaxed px-3.5 py-2.5 outline-none resize-y min-h-[80px]"
        rows={Math.max(3, Math.min(12, initialCode.split('\n').length + 1))}
      />
      {status === 'loading' && (
        <div className="px-3.5 py-1.5 border-t border-border-base/60 text-[11px] text-fg-subtle flex items-center gap-1.5">
          <Loader2 size={11} className="animate-spin" />
          {t('sandbox.loadingRuntime', { defaultValue: 'загружается Python-рантайм…' })}
        </div>
      )}
      <div className="border-t border-border-base">
        <PythonConsole
          lines={lines}
          status={status === 'pass' ? 'pass' : status === 'fail' ? 'fail' : status}
          emptyMessage={t('sandbox.emptyConsole', { defaultValue: 'Запусти, чтобы увидеть вывод.' })}
        />
      </div>
      {chartData && chartData.length > 0 && (
        <div className="border-t border-border-base px-3 py-2">
          {chart?.type === 'line' ? (
            <LineChart
              series={[
                {
                  name: chart.label ?? 'y',
                  points: chartData.map((point, index) => ({ x: index, y: point.value })),
                },
              ]}
              title={chart.label ?? 'chart'}
            />
          ) : (
            <BarChart data={chartData} title={chart?.label ?? 'chart'} />
          )}
        </div>
      )}
    </aside>
  );
};
