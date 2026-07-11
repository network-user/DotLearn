import { Suspense, lazy, useEffect, useState } from 'react';

import { Database, FlaskConical, Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Skeleton } from '@/components/ui/Skeleton';
import { cx } from '@/components/ui/cx';
import { isConstrainedConnection } from '@/lib/connection';
import {
  consumeSandboxIncoming,
  loadActiveTab,
  loadPythonState,
  loadSqlState,
  saveActiveTab,
  type PlaygroundTab,
  type PythonPlaygroundState,
  type SqlPlaygroundState,
} from '@/lib/playground';
import { prewarmPythonRuntime } from '@/lib/python-runtime';
import { defaultPythonTemplate } from '@/lib/sandbox-templates/python';
import { defaultSqlTemplate } from '@/lib/sandbox-templates/sql';
import { prewarmSqlRuntime } from '@/lib/sql-runtime';

const SqlPlayground = lazy(() =>
  import('@/components/playground/SqlPlayground').then((module) => ({
    default: module.SqlPlayground,
  })),
);
const PythonPlayground = lazy(() =>
  import('@/components/playground/PythonPlayground').then((module) => ({
    default: module.PythonPlayground,
  })),
);

interface LoadedState {
  activeTab: PlaygroundTab;
  sql: SqlPlaygroundState;
  python: PythonPlaygroundState;
}

const defaultSqlState = (): SqlPlaygroundState => ({
  templateId: defaultSqlTemplate.id,
  schema: defaultSqlTemplate.schema,
  query: defaultSqlTemplate.query,
  view: 'gallery',
});

const defaultPythonState = (): PythonPlaygroundState => ({
  templateId: defaultPythonTemplate.id,
  code: defaultPythonTemplate.code,
  view: 'gallery',
});

const PanelFallback = () => (
  <div className="space-y-4" aria-hidden>
    <Skeleton rounded="lg" className="h-20" />
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Skeleton rounded="2xl" className="h-64" />
      <Skeleton rounded="2xl" className="h-64" />
    </div>
  </div>
);

export const SandboxPage = () => {
  const { t } = useTranslation('sandbox');
  const [loaded, setLoaded] = useState<LoadedState | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<PlaygroundTab>('sql');

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadActiveTab(), loadSqlState(), loadPythonState()])
      .then(async ([tab, sql, python]) => {
        const baseSql = sql ?? defaultSqlState();
        const basePython = python ?? defaultPythonState();
        const consumed = await consumeSandboxIncoming({ sql: baseSql, python: basePython });
        if (cancelled) return;
        const resolvedTab = consumed?.tab ?? tab ?? 'sql';
        setActiveTab(resolvedTab);
        setLoaded({
          activeTab: resolvedTab,
          sql: consumed?.sql ?? baseSql,
          python: consumed?.python ?? basePython,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setActiveTab('sql');
        setLoaded({
          activeTab: 'sql',
          sql: defaultSqlState(),
          python: defaultPythonState(),
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loaded === undefined) return;
    if (isConstrainedConnection()) return;
    const prewarm = activeTab === 'python' ? prewarmPythonRuntime : prewarmSqlRuntime;
    const win = window as typeof window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (typeof win.requestIdleCallback === 'function') {
      const handle = win.requestIdleCallback(() => prewarm(), { timeout: 3_000 });
      return () => win.cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(prewarm, 1_500);
    return () => window.clearTimeout(timer);
  }, [loaded, activeTab]);

  const selectTab = (tab: PlaygroundTab): void => {
    setActiveTab(tab);
    void saveActiveTab(tab);
  };

  const segments: { id: PlaygroundTab; label: string; icon: typeof Database }[] = [
    { id: 'sql', label: t('tabs.sql'), icon: Database },
    { id: 'python', label: t('tabs.python'), icon: Terminal },
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 eyebrow text-fg-subtle">
          <FlaskConical size={12} className="text-accent" />
          <span>{t('eyebrow')}</span>
        </div>
        <h1 className="font-display text-3xl tracking-tightish text-fg">{t('title')}</h1>
        <p className="max-w-prose text-sm text-fg-muted">{t('subtitle')}</p>
      </header>

      <div
        role="tablist"
        aria-label={t('tabs.label')}
        className="inline-flex w-full gap-1 rounded-xl border border-border-base bg-surface-2/50 p-1 sm:w-auto"
      >
        {segments.map((segment) => {
          const active = segment.id === activeTab;
          const Icon = segment.icon;
          return (
            <button
              key={segment.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(segment.id)}
              className={cx(
                'inline-flex min-h-[var(--tap)] flex-1 items-center justify-center gap-2 rounded-lg px-4 sm:min-h-0 sm:flex-initial sm:py-2',
                'text-[13px] font-medium tracking-snug transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                active ? 'bg-surface text-fg shadow-card' : 'text-fg-muted hover:text-fg',
              )}
            >
              <Icon size={15} aria-hidden />
              {segment.label}
            </button>
          );
        })}
      </div>

      {loaded === undefined ? (
        <PanelFallback />
      ) : (
        <Suspense fallback={<PanelFallback />}>
          <div className={cx(activeTab === 'sql' ? 'block' : 'hidden')}>
            <SqlPlayground initialState={loaded.sql} />
          </div>
          <div className={cx(activeTab === 'python' ? 'block' : 'hidden')}>
            <PythonPlayground initialState={loaded.python} />
          </div>
        </Suspense>
      )}
    </div>
  );
};
