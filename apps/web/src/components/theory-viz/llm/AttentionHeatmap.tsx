import { useMemo, useState } from 'react';

import { useReducedMotion } from 'framer-motion';

import { cx } from '@/components/ui/cx';
import { softmax } from '@/components/theory-viz/nn/activations';
import { VizShell } from '@/components/viz/VizShell';

export interface AttentionHeatmapProps {
  tokens?: string[];
  weights?: number[][];
  label?: string;
  rowHint?: string;
  colHint?: string;
  emptyHint?: string;
}

interface HoverCell {
  row: number;
  col: number;
}

class AttentionShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AttentionShapeError';
  }
}

const defaultTokens = ['Кошка', 'села', 'на', 'тёплый', 'коврик'];

const syntheticWeights = (tokens: string[]): number[][] =>
  tokens.map((_, rowIndex) => {
    const logits = tokens.map((__, colIndex) => {
      if (colIndex > rowIndex) return -Infinity;
      const distance = rowIndex - colIndex;
      const recency = 2.4 - distance * 0.7;
      const diagonal = colIndex === rowIndex ? 1.1 : 0;
      return recency + diagonal;
    });
    return softmax(logits);
  });

const normalizeWeights = (tokens: string[], weights?: number[][]): number[][] => {
  if (!weights) return syntheticWeights(tokens);
  if (weights.length !== tokens.length) {
    throw new AttentionShapeError(
      `attention rows (${weights.length}) must equal token count (${tokens.length})`,
    );
  }
  return weights.map((row, rowIndex) => {
    if (row.length !== tokens.length) {
      throw new AttentionShapeError(
        `attention row ${rowIndex} has ${row.length} columns, expected ${tokens.length}`,
      );
    }
    const sum = row.reduce((total, value) => total + Math.max(value, 0), 0);
    if (sum <= 0) return row.map(() => 0);
    return row.map((value) => Math.max(value, 0) / sum);
  });
};

export const AttentionHeatmap = ({
  tokens = defaultTokens,
  weights,
  label = 'Карта внимания',
  rowHint = 'запрос',
  colHint = 'ключ',
  emptyHint = 'Наведите на ячейку, чтобы прочитать вес внимания.',
}: AttentionHeatmapProps) => {
  const reduceMotion = useReducedMotion();
  const [hover, setHover] = useState<HoverCell | null>(null);

  const matrix = useMemo(() => normalizeWeights(tokens, weights), [tokens, weights]);

  const cellSize = tokens.length > 8 ? 34 : 44;
  const labelWidth = 64;

  const active = hover ? (matrix[hover.row]?.[hover.col] ?? 0) : null;

  return (
    <VizShell
      label={label}
      footer={
        hover ? (
          <span>
            <span className="font-mono text-accent">{tokens[hover.row]}</span>
            <span className="text-fg-subtle"> → </span>
            <span className="font-mono text-fg">{tokens[hover.col]}</span>
            <span className="text-fg-subtle"> · </span>
            <span className="font-mono tabular-nums text-fg">{(active ?? 0).toFixed(3)}</span>
          </span>
        ) : (
          emptyHint
        )
      }
    >
      <div className="flex items-center gap-3">
        <span
          className="shrink-0 -rotate-90 whitespace-nowrap text-[10px] uppercase tracking-widest text-fg-subtle"
          style={{ width: 16 }}
        >
          {rowHint}
        </span>

        <div className="min-w-max">
          <div className="flex" style={{ marginLeft: labelWidth }}>
            {tokens.map((token, colIndex) => (
              <span
                key={`col-${colIndex}`}
                className={cx(
                  'flex items-end justify-center pb-1 text-[10px]',
                  hover?.col === colIndex ? 'text-accent' : 'text-fg-subtle',
                )}
                style={{ width: cellSize, height: 22 }}
                title={token}
              >
                <span className="block max-w-full truncate font-mono">{token}</span>
              </span>
            ))}
            <span className="self-end pb-1 pl-2 text-[10px] uppercase tracking-widest text-fg-subtle">
              {colHint}
            </span>
          </div>

          {tokens.map((rowToken, rowIndex) => (
            <div key={`row-${rowIndex}`} className="flex items-center">
              <span
                className={cx(
                  'truncate pr-2 text-right font-mono text-[11px]',
                  hover?.row === rowIndex ? 'text-accent' : 'text-fg-muted',
                )}
                style={{ width: labelWidth }}
                title={rowToken}
              >
                {rowToken}
              </span>
              {matrix[rowIndex]?.map((weight, colIndex) => {
                const isActive = hover?.row === rowIndex && hover?.col === colIndex;
                return (
                  <button
                    key={`cell-${rowIndex}-${colIndex}`}
                    type="button"
                    onMouseEnter={() => setHover({ row: rowIndex, col: colIndex })}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover({ row: rowIndex, col: colIndex })}
                    onBlur={() => setHover(null)}
                    onClick={() => setHover({ row: rowIndex, col: colIndex })}
                    className={cx(
                      'grid place-items-center border border-canvas/40 outline-none transition-[transform] duration-fast',
                      isActive && 'z-10 ring-2 ring-accent',
                      !reduceMotion && isActive && 'scale-110',
                    )}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      backgroundColor: `rgb(var(--accent-1) / ${(0.06 + weight * 0.94).toFixed(3)})`,
                    }}
                    aria-label={`${rowToken} → ${tokens[colIndex]}: ${weight.toFixed(3)}`}
                  >
                    <span
                      className={cx(
                        'font-mono text-[10px] tabular-nums',
                        weight > 0.5 ? 'text-canvas' : 'text-fg-subtle',
                      )}
                    >
                      {weight >= 0.08 ? weight.toFixed(2).slice(1) : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </VizShell>
  );
};
