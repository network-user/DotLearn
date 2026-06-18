import { useEffect, useMemo, useState } from 'react';

import { Key, Loader2, Table2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getSqlRuntime } from '@/lib/sql-runtime';

import { parseSqlFixture, type ParsedTable } from './parseSqlFixture';
import { ResultGrid } from './ResultGrid';

const TOTAL_COLUMN = '__dotlearn_total';

interface TablePreview {
  name: string;
  columns: string[];
  rows: Record<string, unknown>[];
  total: number | undefined;
  error?: string;
}

interface SqlSchemaPreviewProps {
  fixture: string;
}

export const SqlSchemaPreview = ({ fixture }: SqlSchemaPreviewProps) => {
  const tables = useMemo(() => parseSqlFixture(fixture), [fixture]);
  const [previews, setPreviews] = useState<TablePreview[] | undefined>(undefined);

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
            `SELECT *, COUNT(*) OVER () AS ${TOTAL_COLUMN} FROM "${table.name}" LIMIT 6;`,
            fixture,
          );
          if (cancelled) return;
          const columns = exec.columns.filter((column) => column !== TOTAL_COLUMN);
          const rows = exec.rows.map((row) =>
            Object.fromEntries(Object.entries(row).filter(([key]) => key !== TOTAL_COLUMN)),
          );
          const total = exec.rows.length > 0 ? Number(exec.rows[0]?.[TOTAL_COLUMN] ?? 0) : 0;
          out.push({ name: table.name, columns, rows, total });
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

  return <SchemaView tables={tables} previews={previews} />;
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
      <div className="rounded-lg border border-border-base bg-surface px-3 py-4">
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
            className="rounded-lg border border-border-base bg-surface overflow-hidden"
          >
            <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border-base bg-surface-2/60">
              <div className="flex items-center gap-2 min-w-0">
                <Table2 size={13} className="text-accent" />
                <span className="font-mono text-[12.5px] text-fg truncate">{table.name}</span>
              </div>
              <span className="text-[10.5px] uppercase tracking-widest text-fg-subtle tabular-nums">
                {preview?.total !== undefined
                  ? t('sql.rowsCount', { count: preview.total })
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
                    {col.notes.includes('PK') && <Key size={10} className="text-warn shrink-0" />}
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
              <div className="border-t border-border-base">
                <ResultGrid columns={preview.columns} rows={preview.rows} maxRows={5} compact />
              </div>
            )}
            {preview === undefined && (
              <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-fg-subtle border-t border-border-base">
                <Loader2 size={11} className="animate-spin" />
                {t('sql.loadingPreview', { defaultValue: 'загрузка предпросмотра' })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
