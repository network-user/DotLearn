interface ResultTableProps {
  columns: string[];
  rows: Record<string, unknown>[];
  emptyMessage?: string;
}

const formatCell = (value: unknown): string => {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
};

export const ResultTable = ({ columns, rows, emptyMessage = 'No rows.' }: ResultTableProps) => {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500 italic">{emptyMessage}</p>;
  }
  const headerColumns = columns.length > 0 ? columns : Object.keys(rows[0] ?? {});
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="min-w-full text-sm font-mono">
        <thead className="bg-zinc-900/80 text-zinc-300">
          <tr>
            {headerColumns.map((column) => (
              <th
                key={column}
                className="px-3 py-1.5 text-left text-xs uppercase tracking-wide font-medium border-b border-zinc-800"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-zinc-200">
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="even:bg-zinc-950/40 border-b border-zinc-900 last:border-b-0"
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
