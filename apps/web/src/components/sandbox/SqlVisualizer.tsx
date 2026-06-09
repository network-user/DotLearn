import { useEffect, useMemo, useState } from 'react';

import { Database, Key, ListChecks, Loader2, Table2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { getSqlRuntime } from '@/lib/sql-runtime';

import { parseSqlFixture, type ParsedTable } from './parseSqlFixture';
import { ResultGrid } from './ResultGrid';

export interface SqlRunResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

interface SqlVisualizerProps {
  fixture: string;
  expected?:
    | {
        kind: 'result-set' | 'scalar';
        rows?: Record<string, unknown>[];
        columns?: string[];
        value?: unknown;
      }
    | undefined;
  result?: SqlRunResult | undefined;
  resultStatus?: 'pass' | 'fail' | undefined;
  initialTab?: 'schema' | 'result' | 'expected' | undefined;
}

interface TablePreview {
  name: string;
  columns: string[];
  rows: Record<string, unknown>[];
  total: number | undefined;
  error?: string;
}

export const SqlVisualizer = ({
  fixture,
  expected,
  result,
  resultStatus,
  initialTab = 'schema',
}: SqlVisualizerProps) => {
  const { t } = useTranslation('runners');
  const tables = useMemo(() => parseSqlFixture(fixture), [fixture]);
  const [previews, setPreviews] = useState<TablePreview[] | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'schema' | 'result' | 'expected'>(initialTab);

  useEffect(() => {
    if (result) {
      setActiveTab('result');
    }
  }, [result]);

  useEffect(() => {
    let cancelled = false;
    if (tables.length === 0) {
      setPreviews([]);
      return;
    }
    const runtime = getSqlRuntime();
    void (async () => {
      const out: TablePreview[] = [];
      for (const table of tables) {
        try {
          const exec = await runtime.execute(
            `SELECT * FROM "${table.name}" LIMIT 6;`,
            fixture,
          );
          if (cancelled) return;
          const total = await runtime
            .execute(`SELECT COUNT(*) AS c FROM "${table.name}";`, fixture)
            .then((res) => Number(res.rows[0]?.['c'] ?? 0))
            .catch(() => undefined);
          out.push({
            name: table.name,
            columns: exec.columns,
            rows: exec.rows,
            total,
          });
        } catch (error) {
          out.push({
            name: table.name,
            columns: [],
            rows: [],
            total: undefined,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      if (!cancelled) {
        setPreviews(out);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fixture, tables]);

  const expectedRows = expected?.kind === 'result-set' ? (expected.rows ?? []) : [];
  const expectedColumns =
    expected?.kind === 'result-set'
      ? (expected.columns ?? Object.keys(expectedRows[0] ?? {}))
      : [];

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
      <TabsList>
        <TabsTrigger value="schema">
          <Database size={12} />
          {t('sql.tabs.schema')}
        </TabsTrigger>
        <TabsTrigger value="result">
          <Table2 size={12} />
          {t('sql.tabs.result')}
          {result && (
            <span
              className={cx(
                'ml-1 inline-block size-1.5 rounded-full',
                resultStatus === 'pass'
                  ? 'bg-emerald-400'
                  : resultStatus === 'fail'
                    ? 'bg-rose-400'
                    : 'bg-fg-subtle',
              )}
            />
          )}
        </TabsTrigger>
        {expected && expected.kind === 'result-set' && (
          <TabsTrigger value="expected">
            <ListChecks size={12} />
            {t('sql.tabs.expected')}
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="schema">
        <SchemaView tables={tables} previews={previews} />
      </TabsContent>

      <TabsContent value="result">
        {result ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-widest text-fg-subtle">
                {t('sql.yourResult')}
              </span>
              <span className="text-[11px] text-fg-subtle tabular-nums">
                {t('sql.rowsCount', { count: result.rows.length })}
              </span>
            </div>
            <ResultGrid
              columns={result.columns}
              rows={result.rows}
              highlight={resultStatus ?? undefined}
            />
          </div>
        ) : (
          <p className="text-[12.5px] text-fg-subtle italic px-3 py-6">{t('sql.noResultYet')}</p>
        )}
      </TabsContent>

      {expected && expected.kind === 'result-set' && (
        <TabsContent value="expected">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-widest text-fg-subtle">
                {t('sql.expectedResult')}
              </span>
              <span className="text-[11px] text-fg-subtle tabular-nums">
                {t('sql.rowsCount', { count: expectedRows.length })}
              </span>
            </div>
            <ResultGrid columns={expectedColumns} rows={expectedRows} highlight="expected" />
          </div>
        </TabsContent>
      )}
    </Tabs>
  );
};

const SchemaView = ({
  tables,
  previews,
}: {
  tables: ParsedTable[];
  previews: TablePreview[] | undefined;
}) => {
  const { t } = useTranslation('runners');
  if (tables.length === 0) {
    return (
      <div className="rounded-lg border border-border-base bg-surface/40 px-3 py-4">
        <pre className="whitespace-pre-wrap text-[11.5px] font-mono text-fg-muted overflow-x-auto">
          {t('sql.fixtureLabel')}
        </pre>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {tables.map((table) => {
        const preview = previews?.find((p) => p.name === table.name);
        return (
          <div
            key={table.name}
            className="rounded-xl border border-border-base bg-surface/40 backdrop-blur-soft overflow-hidden"
          >
            <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border-base bg-surface-2/40">
              <div className="flex items-center gap-2 min-w-0">
                <Table2 size={13} className="text-accent" />
                <span className="font-mono text-[12.5px] text-fg truncate">{table.name}</span>
              </div>
              <span className="text-[10.5px] uppercase tracking-widest text-fg-subtle tabular-nums">
                {preview?.total !== undefined
                  ? `${preview.total} rows`
                  : preview === undefined
                    ? '…'
                    : '—'}
              </span>
            </header>
            <ul className="px-3 py-2 space-y-0.5">
              {table.columns.map((col) => (
                <li
                  key={col.name}
                  className="flex items-center justify-between gap-3 text-[12px] font-mono"
                >
                  <span className="flex items-center gap-1.5 text-fg min-w-0">
                    {col.notes.includes('PK') && (
                      <Key size={10} className="text-amber-400 shrink-0" />
                    )}
                    <span className="truncate">{col.name}</span>
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10.5px] uppercase tracking-widest text-fg-subtle">
                      {col.type}
                    </span>
                    {col.notes
                      .filter((n) => n !== 'PK')
                      .map((note) => (
                        <span
                          key={note}
                          className="text-[9px] uppercase tracking-widest text-fg-subtle"
                        >
                          {note}
                        </span>
                      ))}
                  </span>
                </li>
              ))}
            </ul>
            {preview && preview.rows.length > 0 && (
              <div className="border-t border-border-base bg-canvas/40">
                <ResultGrid
                  columns={preview.columns}
                  rows={preview.rows}
                  maxRows={5}
                  compact
                />
              </div>
            )}
            {preview === undefined && (
              <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-fg-subtle border-t border-border-base">
                <Loader2 size={11} className="animate-spin" />
                loading preview
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
