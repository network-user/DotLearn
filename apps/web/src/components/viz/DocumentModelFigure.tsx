import { useState } from 'react';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Boxes, Table2 } from 'lucide-react';

import { cx } from '@/components/ui/cx';

import { VizShell } from './VizShell';

interface DocTable {
  name: string;
  columns: string[];
  rows: string[][];
}

interface DocumentModelFigureProps {
  tables?: DocTable[];
  document?: string;
  label?: string;
  tablesNote?: string;
  documentNote?: string;
}

const defaultTables: DocTable[] = [
  {
    name: 'users',
    columns: ['id', 'name'],
    rows: [['1', 'Анна']],
  },
  {
    name: 'orders',
    columns: ['id', 'user_id', 'item'],
    rows: [
      ['10', '1', 'Книга'],
      ['11', '1', 'Кофе'],
    ],
  },
];

const defaultDocument = `{
  "_id": 1,
  "name": "Анна",
  "orders": [
    { "id": 10, "item": "Книга" },
    { "id": 11, "item": "Кофе" }
  ]
}`;

type View = 'tables' | 'document';

export const DocumentModelFigure = ({
  tables = defaultTables,
  document = defaultDocument,
  label = 'Нормализация против документа',
  tablesNote = 'Данные разложены по таблицам и связаны через user_id. Чтобы собрать заказ пользователя, нужен JOIN.',
  documentNote = 'Заказы вложены прямо в документ пользователя. Чтение без JOIN, но общие данные приходится дублировать.',
}: DocumentModelFigureProps) => {
  const reduceMotion = useReducedMotion();
  const [view, setView] = useState<View>('tables');

  const tab = (mode: View, icon: JSX.Element, text: string): JSX.Element => (
    <button
      type="button"
      onClick={() => setView(mode)}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 h-7 text-[12px] font-medium transition-colors duration-fast',
        view === mode ? 'bg-accent text-surface dark:text-canvas' : 'text-fg-muted hover:text-fg',
      )}
    >
      {icon}
      {text}
    </button>
  );

  return (
    <VizShell
      label={label}
      actions={
        <div className="flex items-center rounded-lg border border-border-base bg-surface p-0.5">
          {tab('tables', <Table2 size={12} />, 'Таблицы')}
          {tab('document', <Boxes size={12} />, 'Документ')}
        </div>
      }
      footer={view === 'tables' ? tablesNote : documentNote}
    >
      <AnimatePresence mode="wait" initial={false}>
        {view === 'tables' ? (
          <motion.div
            key="tables"
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            {...(reduceMotion ? {} : { exit: { opacity: 0, y: -6 } })}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-3 sm:flex-row sm:flex-wrap"
          >
            {tables.map((table) => (
              <div
                key={table.name}
                className="rounded-lg border border-border-base bg-surface overflow-hidden"
              >
                <div className="px-3 py-1.5 border-b border-border-base/60 bg-surface-2 font-mono text-[11.5px] text-fg-muted">
                  {table.name}
                </div>
                <table className="text-[12px] font-mono">
                  <thead>
                    <tr>
                      {table.columns.map((column) => (
                        <th
                          key={column}
                          className="px-3 py-1 text-left text-fg-subtle font-normal border-b border-border-base/40"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className={cx(
                              'px-3 py-1 text-fg border-b border-border-base/30 last:border-b-0',
                              table.columns[cellIndex] === 'user_id' && 'text-accent',
                            )}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.pre
            key="document"
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            {...(reduceMotion ? {} : { exit: { opacity: 0, y: -6 } })}
            transition={{ duration: 0.2 }}
            className="rounded-lg border border-accent/30 bg-accent/4 p-4 font-mono text-[12.5px] leading-relaxed text-fg overflow-x-auto"
          >
            {document}
          </motion.pre>
        )}
      </AnimatePresence>
    </VizShell>
  );
};
