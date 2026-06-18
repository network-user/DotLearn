import { useMemo, useState } from 'react';

import { useReducedMotion } from 'framer-motion';

import { cx } from '@/components/ui/cx';
import { VizButton, VizShell } from '@/components/viz/VizShell';

export interface AnchorShape {
  w: number;
  h: number;
}

export interface AnchorObjectBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export interface AnchorGridVizProps {
  label?: string;
  grid?: number;
  anchors?: AnchorShape[];
  object?: AnchorObjectBox;
  objectLabel?: string;
  cellLabel?: string;
  anchorsTitle?: string;
  showAnchorsLabel?: string;
  hideAnchorsLabel?: string;
  hintLabel?: string;
}

const VIEW = 300;

const defaultAnchors: AnchorShape[] = [
  { w: 0.85, h: 0.35 },
  { w: 0.4, h: 0.85 },
  { w: 0.6, h: 0.6 },
];

const defaultObject: AnchorObjectBox = { cx: 0.62, cy: 0.46, w: 0.34, h: 0.5 };

const iou = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): number => {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
};

export const AnchorGridViz = ({
  label = 'Сетка ячеек и якоря',
  grid = 5,
  anchors = defaultAnchors,
  object = defaultObject,
  objectLabel = 'Объект',
  cellLabel = 'Ответственная ячейка',
  anchorsTitle = 'Якоря',
  showAnchorsLabel = 'Показать якоря',
  hideAnchorsLabel = 'Скрыть якоря',
  hintLabel = 'За объект отвечает ячейка, в которую попадает его центр; среди якорей выбирается тот, у которого больше IoU.',
}: AnchorGridVizProps) => {
  const reduceMotion = useReducedMotion();
  const safeGrid = Math.max(2, Math.min(grid, 12));
  const cell = VIEW / safeGrid;
  const [showAnchors, setShowAnchors] = useState(true);

  const responsibleCol = Math.min(safeGrid - 1, Math.floor(object.cx * safeGrid));
  const responsibleRow = Math.min(safeGrid - 1, Math.floor(object.cy * safeGrid));

  const objectPx = useMemo(
    () => ({
      x: (object.cx - object.w / 2) * VIEW,
      y: (object.cy - object.h / 2) * VIEW,
      w: object.w * VIEW,
      h: object.h * VIEW,
    }),
    [object],
  );

  const objectNorm = useMemo(
    () => ({
      x: object.cx - object.w / 2,
      y: object.cy - object.h / 2,
      w: object.w,
      h: object.h,
    }),
    [object],
  );

  const bestAnchorIndex = useMemo(() => {
    let best = 0;
    let bestScore = -1;
    anchors.forEach((anchor, index) => {
      const anchorNorm = {
        x: object.cx - anchor.w / 2,
        y: object.cy - anchor.h / 2,
        w: anchor.w,
        h: anchor.h,
      };
      const score = iou(anchorNorm, objectNorm);
      if (score > bestScore) {
        bestScore = score;
        best = index;
      }
    });
    return best;
  }, [anchors, object.cx, object.cy, objectNorm]);

  const anchorPalette = [
    'rgb(var(--viz-cat-2))',
    'rgb(var(--viz-cat-4))',
    'rgb(var(--viz-cat-5))',
    'rgb(var(--viz-cat-6))',
  ];

  const cellCenterX = (responsibleCol + 0.5) * cell;
  const cellCenterY = (responsibleRow + 0.5) * cell;

  const transitionClass = reduceMotion ? '' : 'transition-all duration-med ease-standard';

  return (
    <VizShell
      label={label}
      actions={
        <VizButton onClick={() => setShowAnchors((v) => !v)} tone="ghost">
          {showAnchors ? hideAnchorsLabel : showAnchorsLabel}
        </VizButton>
      }
      footer={hintLabel}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-[280px] flex-1">
          <svg
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            role="img"
            aria-label={label}
            className="w-full rounded-lg border border-border-base bg-surface-2"
          >
            <rect
              x={responsibleCol * cell}
              y={responsibleRow * cell}
              width={cell}
              height={cell}
              className={cx('fill-accent/12', transitionClass)}
            />

            <g className="stroke-border-base" strokeWidth={1}>
              {Array.from({ length: safeGrid - 1 }, (_, index) => (
                <line
                  key={`v-${index}`}
                  x1={(index + 1) * cell}
                  y1={0}
                  x2={(index + 1) * cell}
                  y2={VIEW}
                />
              ))}
              {Array.from({ length: safeGrid - 1 }, (_, index) => (
                <line
                  key={`h-${index}`}
                  x1={0}
                  y1={(index + 1) * cell}
                  x2={VIEW}
                  y2={(index + 1) * cell}
                />
              ))}
            </g>

            {showAnchors &&
              anchors.map((anchor, index) => {
                const color = anchorPalette[index % anchorPalette.length];
                const isBest = index === bestAnchorIndex;
                return (
                  <rect
                    key={`anchor-${index}`}
                    x={cellCenterX - (anchor.w * cell) / 2}
                    y={cellCenterY - (anchor.h * cell) / 2}
                    width={anchor.w * cell}
                    height={anchor.h * cell}
                    fill="none"
                    stroke={color}
                    strokeWidth={isBest ? 2 : 1}
                    strokeDasharray={isBest ? undefined : '3 3'}
                    opacity={isBest ? 1 : 0.5}
                    className={transitionClass}
                    rx={2}
                  />
                );
              })}

            <rect
              x={objectPx.x}
              y={objectPx.y}
              width={objectPx.w}
              height={objectPx.h}
              className={cx('fill-ok/10 stroke-ok', transitionClass)}
              strokeWidth={2}
              rx={3}
            />
            <circle cx={object.cx * VIEW} cy={object.cy * VIEW} r={4} className="fill-ok" />
            <circle cx={cellCenterX} cy={cellCenterY} r={3} className="fill-accent" />
            <text
              x={objectPx.x + 4}
              y={Math.max(12, objectPx.y - 5)}
              className="fill-ok font-mono text-[10px]"
            >
              {objectLabel}
            </text>
          </svg>
        </div>

        <div className="flex flex-col gap-3 lg:w-[210px]">
          <div className="rounded-lg border border-border-base bg-surface p-3">
            <div className="text-[10px] uppercase tracking-widest text-fg-subtle">{cellLabel}</div>
            <div className="mt-1 font-mono text-[13px] text-accent">
              ({responsibleRow}, {responsibleCol})
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-fg-subtle">
              {safeGrid}×{safeGrid}
            </div>
          </div>

          <div className="rounded-lg border border-border-base bg-surface-2 p-3">
            <div className="mb-2 text-[10px] uppercase tracking-widest text-fg-subtle">
              {anchorsTitle}
            </div>
            <ul className="flex flex-col gap-1.5 font-mono text-[12px]">
              {anchors.map((anchor, index) => {
                const isBest = index === bestAnchorIndex;
                return (
                  <li key={`legend-${index}`} className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: anchorPalette[index % anchorPalette.length] }}
                    />
                    <span className={cx(isBest ? 'text-fg' : 'text-fg-subtle')}>
                      {anchor.w.toFixed(2)}×{anchor.h.toFixed(2)}
                    </span>
                    {isBest && <span className="ml-auto text-[10px] text-ok">✓</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </VizShell>
  );
};
