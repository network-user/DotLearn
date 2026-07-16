import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';

interface ResultGridProps {
  columns: string[];
  rows: Record<string, unknown>[];
  emptyMessage?: string;
  highlight?: 'pass' | 'fail' | 'expected' | undefined;
  maxRows?: number;
  compact?: boolean;
}

const formatCell = (value: unknown, nullLabel: string): string => {
  if (value === null || value === undefined) return nullLabel;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const cellIsNumeric = (value: unknown): boolean =>
  typeof value === 'number' || (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value));

const highlightHeader: Record<NonNullable<ResultGridProps['highlight']>, string> = {
  pass: 'bg-ok/8 text-ok border-ok/20',
  fail: 'bg-err/8 text-err border-err/20',
  expected: 'bg-accent/8 text-accent border-accent/20',
};

export const ResultGrid = ({
  columns,
  rows,
  emptyMessage,
  highlight,
  maxRows = 100,
  compact = false,
}: ResultGridProps) => {
  const { t } = useTranslation('runners');
  const nullLabel = t('results.null');
  if (rows.length === 0) {
    return (
      <p className="text-[12.5px] text-fg-subtle italic px-3 py-4">
        {emptyMessage ?? t('results.noRows')}
      </p>
    );
  }
  const headerColumns = columns.length > 0 ? columns : Object.keys(rows[0] ?? {});
  const visible = rows.slice(0, maxRows);
  const truncated = rows.length > visible.length;
  return (
    <div className="rounded-lg border border-border-base overflow-hidden">
      <div className="resize-y overflow-auto min-h-[140px] max-h-[70dvh]">
        <table className={cx('min-w-full font-mono', compact ? 'text-[12px]' : 'text-[12.5px]')}>
          <thead>
            <tr>
              {headerColumns.map((column) => (
                <th
                  key={column}
                  className={cx(
                    'px-3 py-1.5 text-left text-[10.5px] uppercase tracking-widest font-semibold',
                    highlight
                      ? cx('border-b', highlightHeader[highlight])
                      : 'bg-surface-2 text-fg-muted border-b border-border-base',
                  )}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={cx(
                  'transition-colors duration-fast',
                  rowIndex % 2 === 0 ? 'bg-transparent' : 'bg-surface-2/30',
                  highlight === 'pass' && 'dl-anim-row-flash',
                )}
                style={{ animationDelay: `${rowIndex * 30}ms` }}
              >
                {headerColumns.map((column) => {
                  const value = row[column];
                  const isNumeric = cellIsNumeric(value);
                  return (
                    <td
                      key={column}
                      className={cx(
                        'px-3 py-1 align-top whitespace-nowrap text-fg',
                        isNumeric && 'text-right tabular-nums',
                        value === null || value === undefined ? 'text-fg-subtle italic' : '',
                      )}
                    >
                      {formatCell(value, nullLabel)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {truncated && (
        <div className="px-3 py-1.5 text-[11px] text-fg-subtle bg-surface-2 border-t border-border-base">
          {t('results.showing', {
            shown: visible.length,
            total: rows.length,
            defaultValue: 'показано {{shown}} из {{total}}',
          })}
        </div>
      )}
    </div>
  );
};
