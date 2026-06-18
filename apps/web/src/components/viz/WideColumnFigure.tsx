import { useMemo, useState } from 'react';

import { m as motion, useReducedMotion } from 'framer-motion';

import { cx } from '@/components/ui/cx';

import { VizShell } from './VizShell';

interface WideColumnFigureProps {
  columns?: string[];
  rows?: string[][];
  queryColumn?: number;
  label?: string;
  rowNote?: string;
  columnNote?: string;
}

const defaultColumns = ['city', 'price', 'qty'];
const defaultRows: string[][] = [
  ['Москва', '100', '2'],
  ['Сочи', '250', '1'],
  ['Казань', '90', '5'],
  ['Пермь', '180', '3'],
];

type Layout = 'row' | 'column';

interface Cell {
  value: string;
  col: number;
  row: number;
}

export const WideColumnFigure = ({
  columns = defaultColumns,
  rows = defaultRows,
  queryColumn = 1,
  label = 'Строки против колонок на диске',
  rowNote = 'Чтобы прочитать одну колонку, построчное хранение проходит все строки целиком, и нужные ячейки разбросаны, читается лишнее.',
  columnNote = 'Колонка лежит на диске одним подряд идущим блоком. Аналитический запрос (AVG, SUM по колонке) читает только его.',
}: WideColumnFigureProps) => {
  const reduceMotion = useReducedMotion();
  const [layout, setLayout] = useState<Layout>('row');
  const [target, setTarget] = useState<number>(queryColumn);

  const strip = useMemo<Cell[]>(() => {
    const cells: Cell[] = [];
    if (layout === 'row') {
      rows.forEach((row, rowIndex) => {
        row.forEach((value, colIndex) => cells.push({ value, col: colIndex, row: rowIndex }));
      });
    } else {
      columns.forEach((_, colIndex) => {
        rows.forEach((row, rowIndex) =>
          cells.push({ value: row[colIndex] ?? '', col: colIndex, row: rowIndex }),
        );
      });
    }
    return cells;
  }, [layout, rows, columns]);

  const colPalette = ['text-fg-subtle', 'text-accent', 'text-fg-muted'];

  const toggle = (mode: Layout, text: string): JSX.Element => (
    <button
      type="button"
      onClick={() => setLayout(mode)}
      className={cx(
        'rounded-md px-2.5 h-6 font-mono text-[11px] transition-colors duration-fast',
        layout === mode ? 'bg-accent text-surface dark:text-canvas' : 'text-fg-muted hover:text-fg',
      )}
    >
      {text}
    </button>
  );

  return (
    <VizShell
      label={label}
      actions={
        <div className="flex items-center rounded-lg border border-border-base bg-surface p-0.5">
          {toggle('row', 'по строкам')}
          {toggle('column', 'по колонкам')}
        </div>
      }
      footer={layout === 'row' ? rowNote : columnNote}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span className="text-fg-subtle uppercase tracking-widest text-[10px]">
            читаем колонку
          </span>
          {columns.map((column, index) => (
            <button
              key={column}
              type="button"
              onClick={() => setTarget(index)}
              className={cx(
                'rounded-md border px-2 py-0.5 font-mono text-[11.5px] transition-colors duration-fast',
                target === index
                  ? 'border-accent bg-accent/12 text-accent'
                  : 'border-border-base bg-surface text-fg-muted hover:border-accent/40',
              )}
            >
              {column}
            </button>
          ))}
        </div>

        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
            физический порядок на диске
          </div>
          <div className="flex flex-wrap gap-1">
            {strip.map((cell, index) => {
              const isTarget = cell.col === target;
              return (
                <motion.div
                  key={`${layout}-${index}`}
                  initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: reduceMotion ? 0 : index * 0.015 }}
                  className={cx(
                    'flex h-9 min-w-[52px] items-center justify-center rounded-md border px-1.5 font-mono text-[11.5px] transition-colors duration-fast',
                    isTarget
                      ? 'border-accent bg-accent/12 text-accent'
                      : 'border-border-base bg-surface text-fg-subtle opacity-60',
                  )}
                >
                  {cell.value}
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[max-content_1fr] sm:items-start">
          <div className="rounded-lg border border-border-base bg-surface overflow-hidden">
            <table className="text-[12px] font-mono">
              <thead>
                <tr>
                  {columns.map((column, index) => (
                    <th
                      key={column}
                      className={cx(
                        'px-3 py-1 text-left font-normal border-b border-border-base/50',
                        index === target ? 'text-accent' : 'text-fg-subtle',
                      )}
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((value, colIndex) => (
                      <td
                        key={colIndex}
                        className={cx(
                          'px-3 py-1 border-b border-border-base/30 last:border-b-0',
                          colIndex === target
                            ? 'text-accent'
                            : colPalette[colIndex % colPalette.length],
                        )}
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="font-serif text-[14px] leading-relaxed text-fg-muted">
            Подсвечены ячейки колонки{' '}
            <span className="font-mono text-accent">{columns[target]}</span>. Переключите раскладку
            и проследите, лежат они подряд или вразброс.
          </p>
        </div>
      </div>
    </VizShell>
  );
};
