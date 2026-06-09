import { useTranslation } from 'react-i18next';

interface ResultTableProps {
  columns: string[];
  rows: Record<string, unknown>[];
  emptyMessage?: string;
}

export const ResultTable = ({ columns, rows, emptyMessage }: ResultTableProps) => {
  const { t } = useTranslation('runners');
  const nullLabel = t('results.null');
  const formatCell = (value: unknown): string => {
    if (value === null || value === undefined) {
      return nullLabel;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  };

  if (rows.length === 0) {
    return (
      <p className="text-sm text-fg-subtle italic">
        {emptyMessage ?? t('results.noRows')}
      </p>
    );
  }
  const headerColumns = columns.length > 0 ? columns : Object.keys(rows[0] ?? {});
  return (
    <div className="overflow-x-auto rounded-lg border border-border-base">
      <table className="min-w-full text-sm font-mono">
        <thead className="bg-surface/80 text-fg">
          <tr>
            {headerColumns.map((column) => (
              <th
                key={column}
                className="px-3 py-1.5 text-left text-xs uppercase tracking-wide font-medium border-b border-border-base"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-fg">
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="even:bg-canvas/40 border-b border-border-base last:border-b-0"
            >
              {headerColumns.map((column) => (
                <td key={column} className="px-3 py-1.5 align-top whitespace-pre-wrap">
                  {formatCell(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
