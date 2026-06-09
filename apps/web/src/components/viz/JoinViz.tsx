import { useMemo, useState } from 'react';

import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';

import { VizShell } from './VizShell';

type JoinMode = 'inner' | 'left' | 'right';

interface JoinRow {
  key: number;
  label: string;
}

interface JoinVizProps {
  leftTitle?: string;
  rightTitle?: string;
  leftKeyName?: string;
  rightKeyName?: string;
  left?: JoinRow[];
  right?: JoinRow[];
  label?: string;
}

interface ResultPair {
  left: JoinRow | null;
  right: JoinRow | null;
}

const defaultLeft: JoinRow[] = [
  { key: 1, label: 'Ada' },
  { key: 2, label: 'Linus' },
  { key: 3, label: 'Grace' },
];

const defaultRight: JoinRow[] = [
  { key: 1, label: '$120' },
  { key: 1, label: '$80' },
  { key: 3, label: '$45' },
  { key: 4, label: '$200' },
];

const keyPalette = [
  'bg-indigo-500',
  'bg-cyan-500',
  'bg-teal-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
];

const joinModes: JoinMode[] = ['inner', 'left', 'right'];

const modeSql: Record<JoinMode, string> = {
  inner: 'INNER JOIN',
  left: 'LEFT JOIN',
  right: 'RIGHT JOIN',
};

export const JoinViz = ({
  leftTitle = 'users',
  rightTitle = 'orders',
  leftKeyName = 'id',
  rightKeyName = 'user_id',
  left = defaultLeft,
  right = defaultRight,
  label,
}: JoinVizProps) => {
  const { t } = useTranslation('viz');
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<JoinMode>('inner');

  const keyColor = useMemo(() => {
    const keys = Array.from(new Set([...left, ...right].map((row) => row.key))).sort(
      (a, b) => a - b,
    );
    return new Map(keys.map((key, index) => [key, keyPalette[index % keyPalette.length]]));
  }, [left, right]);

  const result = useMemo<ResultPair[]>(() => {
    const pairs: ResultPair[] = [];
    if (mode === 'inner' || mode === 'left') {
      for (const leftRow of left) {
        const matches = right.filter((rightRow) => rightRow.key === leftRow.key);
        if (matches.length > 0) {
          for (const match of matches) pairs.push({ left: leftRow, right: match });
        } else if (mode === 'left') {
          pairs.push({ left: leftRow, right: null });
        }
      }
    } else {
      for (const rightRow of right) {
        const match = left.find((leftRow) => leftRow.key === rightRow.key);
        pairs.push({ left: match ?? null, right: rightRow });
      }
    }
    return pairs;
  }, [left, right, mode]);

  const participates = (side: 'left' | 'right', row: JoinRow): boolean =>
    result.some((pair) => pair[side] === row);

  const sourceTable = (
    side: 'left' | 'right',
    title: string,
    keyName: string,
    rows: JoinRow[],
  ): JSX.Element => (
    <div className="rounded-xl border border-border-base bg-surface-2/30 overflow-hidden">
      <div className="px-3 py-1.5 border-b border-border-base/60 bg-surface-2/50 font-mono text-[11.5px] text-fg-muted">
        {title}
      </div>
      <ul>
        {rows.map((row, index) => (
          <li
            key={index}
            className={cx(
              'flex items-center gap-2 px-3 py-1.5 font-mono text-[12px] border-b border-border-base/40 last:border-b-0 transition-opacity duration-med',
              participates(side, row) ? 'opacity-100' : 'opacity-35',
            )}
          >
            <span className={cx('size-2 rounded-full shrink-0', keyColor.get(row.key))} />
            <span className="text-fg-subtle">
              {keyName}={row.key}
            </span>
            <span className="text-fg">{row.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <VizShell
      label={label ?? t('join.label')}
      actions={
        <div className="flex items-center rounded-lg border border-border-base bg-surface/50 p-0.5">
          {joinModes.map((joinMode) => (
            <button
              key={joinMode}
              type="button"
              onClick={() => setMode(joinMode)}
              className={cx(
                'rounded-md px-2 h-6 font-mono text-[11px] transition-colors duration-fast',
                mode === joinMode
                  ? 'bg-accent text-white shadow-glow-sm'
                  : 'text-fg-muted hover:text-fg',
              )}
            >
              {joinMode.toUpperCase()}
            </button>
          ))}
        </div>
      }
      footer={t('join.pairs', { count: result.length })}
    >
      <div className="grid grid-cols-2 gap-3 mb-4">
        {sourceTable('left', leftTitle, leftKeyName, left)}
        {sourceTable('right', rightTitle, rightKeyName, right)}
      </div>

      <div className="rounded-xl border border-accent/30 bg-accent/4 overflow-hidden">
        <div className="px-3 py-1.5 border-b border-accent/20 bg-accent/8 font-mono text-[11.5px] text-accent">
          {leftTitle} {modeSql[mode]} {rightTitle} · {t('join.result')}
        </div>
        <ul key={mode}>
          {result.map((pair, index) => (
            <motion.li
              key={index}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: reduceMotion ? 0 : index * 0.06, duration: 0.25 }}
              className="grid grid-cols-2 border-b border-border-base/40 last:border-b-0"
            >
              <span
                className={cx(
                  'flex items-center gap-2 px-3 py-1.5 font-mono text-[12px]',
                  pair.left === null && 'justify-center',
                )}
              >
                {pair.left ? (
                  <>
                    <span
                      className={cx('size-2 rounded-full shrink-0', keyColor.get(pair.left.key))}
                    />
                    <span className="text-fg">{pair.left.label}</span>
                  </>
                ) : (
                  <span className="rounded border border-dashed border-border-strong px-1.5 text-[11px] text-fg-subtle">
                    NULL
                  </span>
                )}
              </span>
              <span
                className={cx(
                  'flex items-center gap-2 px-3 py-1.5 font-mono text-[12px] border-l border-border-base/40',
                  pair.right === null && 'justify-center',
                )}
              >
                {pair.right ? (
                  <>
                    <span
                      className={cx('size-2 rounded-full shrink-0', keyColor.get(pair.right.key))}
                    />
                    <span className="text-fg">{pair.right.label}</span>
                  </>
                ) : (
                  <span className="rounded border border-dashed border-border-strong px-1.5 text-[11px] text-fg-subtle">
                    NULL
                  </span>
                )}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
    </VizShell>
  );
};
