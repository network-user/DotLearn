import { useEffect, useState } from 'react';

import { Database, ListChecks, Table2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';

import { ResultGrid } from './ResultGrid';
import { SqlSchemaPreview } from './SqlSchemaPreview';

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

export const SqlVisualizer = ({
  fixture,
  expected,
  result,
  resultStatus,
  initialTab = 'schema',
}: SqlVisualizerProps) => {
  const { t } = useTranslation('runners');
  const [activeTab, setActiveTab] = useState<'schema' | 'result' | 'expected'>(initialTab);

  useEffect(() => {
    if (result) {
      setActiveTab('result');
    }
  }, [result]);

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
                  ? 'bg-ok'
                  : resultStatus === 'fail'
                    ? 'bg-err'
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
        <SqlSchemaPreview fixture={fixture} />
      </TabsContent>

      <TabsContent value="result">
        {result ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="eyebrow">{t('sql.yourResult')}</span>
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
              <span className="eyebrow">{t('sql.expectedResult')}</span>
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
