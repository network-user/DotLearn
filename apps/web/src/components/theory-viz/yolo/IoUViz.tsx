import { useId, useMemo, useState } from 'react';

import { useReducedMotion } from 'framer-motion';

import { cx } from '@/components/ui/cx';
import { VizButton, VizShell } from '@/components/viz/VizShell';

export interface BoxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface IoUVizProps {
  label?: string;
  boxA?: BoxRect;
  boxB?: BoxRect;
  boxALabel?: string;
  boxBLabel?: string;
  intersectionLabel?: string;
  unionLabel?: string;
  iouLabel?: string;
  nudgeLabel?: string;
  resetLabel?: string;
  hintLabel?: string;
}

interface IntersectRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  width: number;
  height: number;
  area: number;
}

const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 220;
const NUDGE_STEP = 14;

const defaultBoxA: BoxRect = { x: 36, y: 44, w: 150, h: 120 };
const defaultBoxB: BoxRect = { x: 120, y: 86, w: 150, h: 110 };

const clampBox = (box: BoxRect): BoxRect => ({
  x: Math.max(0, Math.min(box.x, VIEW_WIDTH - box.w)),
  y: Math.max(0, Math.min(box.y, VIEW_HEIGHT - box.h)),
  w: Math.max(20, Math.min(box.w, VIEW_WIDTH)),
  h: Math.max(20, Math.min(box.h, VIEW_HEIGHT)),
});

const computeIntersection = (a: BoxRect, b: BoxRect): IntersectRect => {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  const width = Math.max(0, x1 - x0);
  const height = Math.max(0, y1 - y0);
  return { x0, y0, x1, y1, width, height, area: width * height };
};

export const IoUViz = ({
  label = 'IoU — пересечение над объединением',
  boxA = defaultBoxA,
  boxB = defaultBoxB,
  boxALabel = 'Предсказание',
  boxBLabel = 'Эталон',
  intersectionLabel = 'Пересечение',
  unionLabel = 'Объединение',
  iouLabel = 'IoU',
  nudgeLabel = 'Сдвинуть предсказание',
  resetLabel = 'Сбросить',
  hintLabel = 'Сдвигайте синюю рамку, чтобы увидеть, как меняется IoU.',
}: IoUVizProps) => {
  const reduceMotion = useReducedMotion();
  const rawId = useId();
  const clipId = `iou-clip-${rawId.replace(/:/g, '')}`;
  const [movableBox, setMovableBox] = useState<BoxRect>(() => clampBox(boxA));
  const fixedBox = useMemo(() => clampBox(boxB), [boxB]);

  const intersection = useMemo(
    () => computeIntersection(movableBox, fixedBox),
    [movableBox, fixedBox],
  );

  const areaA = movableBox.w * movableBox.h;
  const areaB = fixedBox.w * fixedBox.h;
  const unionArea = areaA + areaB - intersection.area;
  const iou = unionArea > 0 ? intersection.area / unionArea : 0;

  const nudge = (dx: number, dy: number): void => {
    setMovableBox((current) => clampBox({ ...current, x: current.x + dx, y: current.y + dy }));
  };

  const reset = (): void => setMovableBox(clampBox(boxA));

  const transitionClass = reduceMotion
    ? ''
    : 'transition-[x,y,width,height] duration-med ease-standard';

  const quality = iou >= 0.5 ? 'text-ok' : iou >= 0.25 ? 'text-warn' : 'text-err';

  return (
    <VizShell
      label={label}
      actions={
        <VizButton onClick={reset} tone="ghost">
          {resetLabel}
        </VizButton>
      }
      footer={
        <span>
          {hintLabel}{' '}
          <span className="font-mono text-fg">
            {iouLabel} = {intersection.area.toFixed(0)} / {unionArea.toFixed(0)}
          </span>
        </span>
      }
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-[300px] flex-1">
          <svg
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            role="img"
            aria-label={`${iouLabel} ${iou.toFixed(2)}`}
            className="w-full rounded-lg border border-border-base bg-surface-2"
          >
            <defs>
              <clipPath id={clipId}>
                <rect
                  x={intersection.x0}
                  y={intersection.y0}
                  width={intersection.width}
                  height={intersection.height}
                />
              </clipPath>
            </defs>

            <rect
              x={movableBox.x}
              y={movableBox.y}
              width={movableBox.w}
              height={movableBox.h}
              className={cx('fill-accent/8 stroke-accent', transitionClass)}
              strokeWidth={2}
              rx={4}
            />
            <rect
              x={fixedBox.x}
              y={fixedBox.y}
              width={fixedBox.w}
              height={fixedBox.h}
              className="fill-[rgb(var(--viz-cat-3))]/8 stroke-[rgb(var(--viz-cat-3))]"
              strokeWidth={2}
              strokeDasharray="6 4"
              rx={4}
            />

            {intersection.area > 0 && (
              <rect
                x={intersection.x0}
                y={intersection.y0}
                width={intersection.width}
                height={intersection.height}
                clipPath={`url(#${clipId})`}
                className={cx('fill-accent/35 stroke-accent', transitionClass)}
                strokeWidth={1}
              />
            )}

            <g className="font-mono">
              <text
                x={movableBox.x + 4}
                y={movableBox.y - 5}
                className="fill-accent text-[10px]"
              >
                {boxALabel}
              </text>
              <text
                x={fixedBox.x + 4}
                y={fixedBox.y + fixedBox.h + 13}
                className="fill-[rgb(var(--viz-cat-3))] text-[10px]"
              >
                {boxBLabel}
              </text>
            </g>
          </svg>
        </div>

        <div className="flex flex-col gap-3 lg:w-[200px]">
          <div className="rounded-lg border border-border-base bg-surface p-3 text-center">
            <div className="text-[10px] uppercase tracking-widest text-fg-subtle">{iouLabel}</div>
            <div className={cx('font-mono text-3xl font-semibold tabular-nums', quality)}>
              {iou.toFixed(2)}
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-1.5 font-mono text-[12px]">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-fg-subtle">{intersectionLabel}</dt>
              <dd className="text-accent tabular-nums">{intersection.area.toFixed(0)}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-fg-subtle">{unionLabel}</dt>
              <dd className="text-fg tabular-nums">{unionArea.toFixed(0)}</dd>
            </div>
          </dl>

          <div className="rounded-lg border border-border-base bg-surface-2 p-2">
            <div className="mb-2 text-[10px] uppercase tracking-widest text-fg-subtle">
              {nudgeLabel}
            </div>
            <div className="mx-auto grid w-[132px] grid-cols-3 grid-rows-2 gap-1">
              <span />
              <NudgeButton label="↑" onPress={() => nudge(0, -NUDGE_STEP)} />
              <span />
              <NudgeButton label="←" onPress={() => nudge(-NUDGE_STEP, 0)} />
              <NudgeButton label="↓" onPress={() => nudge(0, NUDGE_STEP)} />
              <NudgeButton label="→" onPress={() => nudge(NUDGE_STEP, 0)} />
            </div>
          </div>
        </div>
      </div>
    </VizShell>
  );
};

interface NudgeButtonProps {
  label: string;
  onPress: () => void;
}

const NudgeButton = ({ label, onPress }: NudgeButtonProps) => (
  <button
    type="button"
    onClick={onPress}
    aria-label={label}
    className="flex h-11 min-h-[var(--tap)] items-center justify-center rounded-md border border-border-base bg-surface text-fg-muted transition-colors duration-fast hover:border-accent/50 hover:text-accent sm:h-9 sm:min-h-0"
  >
    {label}
  </button>
);
