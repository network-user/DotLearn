import { useMemo, useState } from 'react';

import { LayoutGroup, m as motion, useReducedMotion } from 'framer-motion';
import { Combine, Split } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';

import { VizButton, VizShell } from './VizShell';

interface GroupRow {
  label: string;
  group: string;
  value?: number;
}

interface GroupByVizProps {
  rows?: GroupRow[];
  agg?: 'count' | 'sum';
  groupKeyName?: string;
  valueKeyName?: string;
  label?: string;
}

const defaultRows: GroupRow[] = [
  { label: 'Ada', group: 'London', value: 120 },
  { label: 'Linus', group: 'Helsinki', value: 80 },
  { label: 'Grace', group: 'London', value: 45 },
  { label: 'Edsger', group: 'Austin', value: 200 },
  { label: 'Barbara', group: 'London', value: 60 },
  { label: 'Alan', group: 'Helsinki', value: 150 },
];

interface GroupPalette {
  dot: string;
  border: string;
  tint: string;
}

const fallbackPalette: GroupPalette = {
  dot: 'bg-[rgb(var(--viz-cat-1))]',
  border: 'border-[rgb(var(--viz-cat-1)/0.4)]',
  tint: 'bg-[rgb(var(--viz-cat-1)/0.08)]',
};

const groupPalette: GroupPalette[] = [
  fallbackPalette,
  {
    dot: 'bg-[rgb(var(--viz-cat-2))]',
    border: 'border-[rgb(var(--viz-cat-2)/0.4)]',
    tint: 'bg-[rgb(var(--viz-cat-2)/0.08)]',
  },
  {
    dot: 'bg-[rgb(var(--viz-cat-3))]',
    border: 'border-[rgb(var(--viz-cat-3)/0.4)]',
    tint: 'bg-[rgb(var(--viz-cat-3)/0.08)]',
  },
  {
    dot: 'bg-[rgb(var(--viz-cat-4))]',
    border: 'border-[rgb(var(--viz-cat-4)/0.4)]',
    tint: 'bg-[rgb(var(--viz-cat-4)/0.08)]',
  },
  {
    dot: 'bg-[rgb(var(--viz-cat-5))]',
    border: 'border-[rgb(var(--viz-cat-5)/0.4)]',
    tint: 'bg-[rgb(var(--viz-cat-5)/0.08)]',
  },
  {
    dot: 'bg-[rgb(var(--viz-cat-6))]',
    border: 'border-[rgb(var(--viz-cat-6)/0.4)]',
    tint: 'bg-[rgb(var(--viz-cat-6)/0.08)]',
  },
];

export const GroupByViz = ({
  rows = defaultRows,
  agg = 'count',
  groupKeyName = 'city',
  valueKeyName = 'total',
  label,
}: GroupByVizProps) => {
  const { t } = useTranslation('viz');
  const reduceMotion = useReducedMotion();
  const [grouped, setGrouped] = useState(false);

  const groups = useMemo(() => {
    const order: string[] = [];
    for (const row of rows) {
      if (!order.includes(row.group)) order.push(row.group);
    }
    return order;
  }, [rows]);

  const paletteOf = (group: string): GroupPalette =>
    groupPalette[groups.indexOf(group) % groupPalette.length] ?? fallbackPalette;

  const aggregate = (group: string): number => {
    const members = rows.filter((row) => row.group === group);
    if (agg === 'sum') {
      return members.reduce((sum, row) => sum + (row.value ?? 0), 0);
    }
    return members.length;
  };

  const aggLabel = agg === 'sum' ? `SUM(${valueKeyName})` : 'COUNT(*)';

  const chip = (row: GroupRow, index: number): JSX.Element => (
    <motion.div
      key={`${row.label}-${index}`}
      {...(reduceMotion ? {} : { layoutId: `chip-${row.label}-${index}` })}
      layout={!reduceMotion}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border-base bg-surface px-2 py-1 font-mono text-[11.5px] shadow-card"
    >
      <span className={cx('size-1.5 rounded-full', paletteOf(row.group).dot)} />
      <span className="text-fg">{row.label}</span>
      <span className="text-fg-subtle">
        {row.group}
        {agg === 'sum' && row.value !== undefined && ` · ${row.value}`}
      </span>
    </motion.div>
  );

  return (
    <VizShell
      label={label ?? t('group.label')}
      actions={
        <VizButton onClick={() => setGrouped((value) => !value)}>
          {grouped ? <Split size={12} /> : <Combine size={12} />}
          {grouped ? t('group.reset') : t('group.run')}
        </VizButton>
      }
      footer={
        grouped ? (
          <span className="font-mono text-[12px]">
            GROUP BY {groupKeyName} → {aggLabel}
          </span>
        ) : null
      }
    >
      <LayoutGroup>
        {!grouped ? (
          <div className="flex flex-wrap gap-2 min-h-[72px] items-start content-start">
            {rows.map((row, index) => chip(row, index))}
          </div>
        ) : (
          <div
            className="grid gap-3 min-h-[72px]"
            style={{ gridTemplateColumns: `repeat(${Math.min(groups.length, 3)}, minmax(0, 1fr))` }}
          >
            {groups.map((group) => {
              const palette = paletteOf(group);
              return (
                <div
                  key={group}
                  className={cx('rounded-lg border p-2.5', palette.border, palette.tint)}
                >
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-fg">
                      <span className={cx('size-2 rounded-full', palette.dot)} />
                      {group}
                    </span>
                    <motion.span
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        delay: reduceMotion ? 0 : 0.35,
                        type: 'spring',
                        stiffness: 400,
                        damping: 22,
                      }}
                      className="rounded-md bg-surface border border-border-base px-1.5 py-0.5 font-mono text-[11px] text-accent font-semibold"
                      title={t('group.result')}
                    >
                      {aggregate(group)}
                    </motion.span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {rows.map((row, index) => (row.group === group ? chip(row, index) : null))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </LayoutGroup>
    </VizShell>
  );
};
