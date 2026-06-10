import { useMemo, useState } from 'react';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Combine, Split } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';

import { VizButton, VizShell } from './VizShell';

type AggregateKind = 'count' | 'sum' | 'avg' | 'min' | 'max';

interface AggregateRow {
  label: string;
  value: number;
}

interface AggregateVizProps {
  rows?: AggregateRow[];
  aggs?: AggregateKind[];
  valueKeyName?: string;
  tableName?: string;
  label?: string;
}

const defaultRows: AggregateRow[] = [
  { label: 'Compilers', value: 620 },
  { label: 'Algorithms', value: 480 },
  { label: 'Notes on math', value: 90 },
  { label: 'Operating systems', value: 700 },
  { label: 'COBOL essentials', value: 220 },
];

const aggSql = (agg: AggregateKind, column: string): string => {
  if (agg === 'count') return 'COUNT(*)';
  return `${agg.toUpperCase()}(${column})`;
};

const compute = (agg: AggregateKind, rows: AggregateRow[]): number => {
  const values = rows.map((row) => row.value);
  switch (agg) {
    case 'count':
      return rows.length;
    case 'sum':
      return values.reduce((sum, value) => sum + value, 0);
    case 'avg': {
      const total = values.reduce((sum, value) => sum + value, 0);
      return rows.length === 0 ? 0 : Math.round((total / rows.length) * 100) / 100;
    }
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
  }
};

export const AggregateViz = ({
  rows = defaultRows,
  aggs = ['count', 'sum', 'avg', 'min', 'max'],
  valueKeyName = 'pages',
  tableName = 'book',
  label,
}: AggregateVizProps) => {
  const { t } = useTranslation('viz');
  const reduceMotion = useReducedMotion();
  const [collapsed, setCollapsed] = useState(false);
  const [agg, setAgg] = useState<AggregateKind>(aggs[0] ?? 'count');

  const result = useMemo(() => compute(agg, rows), [agg, rows]);

  return (
    <VizShell
      label={label ?? t('aggregate.label')}
      actions={
        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-lg border border-border-base bg-surface p-0.5">
            {aggs.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setAgg(kind)}
                className={cx(
                  'rounded-md px-2 h-6 font-mono text-[11px] transition-colors duration-fast',
                  agg === kind
                    ? 'bg-accent text-surface dark:text-canvas'
                    : 'text-fg-muted hover:text-fg',
                )}
              >
                {kind.toUpperCase()}
              </button>
            ))}
          </div>
          <VizButton onClick={() => setCollapsed((value) => !value)}>
            {collapsed ? <Split size={12} /> : <Combine size={12} />}
            {collapsed ? t('aggregate.reset') : t('aggregate.run')}
          </VizButton>
        </div>
      }
      footer={
        collapsed ? (
          <span className="font-mono text-[12px]">
            SELECT {aggSql(agg, valueKeyName)} FROM {tableName};
          </span>
        ) : (
          t('aggregate.idle', { count: rows.length })
        )
      }
    >
      <div className="min-h-[120px] grid place-items-center">
        <AnimatePresence mode="wait" initial={false}>
          {!collapsed ? (
            <motion.ul
              key="rows"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={
                reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.7, filter: 'blur(4px)' }
              }
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-[420px] rounded-lg border border-border-base bg-surface overflow-hidden"
            >
              <li className="grid grid-cols-[1fr_max-content] gap-2 px-3 py-1.5 border-b border-border-base/60 bg-surface-2 font-mono text-[11px] text-fg-subtle">
                <span>title</span>
                <span>{valueKeyName}</span>
              </li>
              {rows.map((row, index) => (
                <motion.li
                  key={row.label}
                  initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: reduceMotion ? 0 : index * 0.05 }}
                  className="grid grid-cols-[1fr_max-content] gap-2 px-3 py-1.5 border-b border-border-base/40 last:border-b-0 font-mono text-[12px]"
                >
                  <span className="text-fg">{row.label}</span>
                  <span className="text-accent tabular-nums">{row.value}</span>
                </motion.li>
              ))}
            </motion.ul>
          ) : (
            <motion.div
              key="result"
              initial={
                reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: 'blur(6px)' }
              }
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              className="text-center"
            >
              <div className="font-mono text-[11px] uppercase tracking-widest text-fg-subtle mb-2">
                {aggSql(agg, valueKeyName)}
              </div>
              <div className="inline-grid place-items-center rounded-lg border border-accent/40 bg-accent/8 px-8 py-4">
                <span className="font-display text-[40px] leading-none text-accent tabular-nums">
                  {result}
                </span>
              </div>
              <div className="mt-2 text-[11.5px] text-fg-subtle">
                {t('aggregate.fromRows', { count: rows.length })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </VizShell>
  );
};
