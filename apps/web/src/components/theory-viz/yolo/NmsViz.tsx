import { useMemo, useState } from 'react';

import { useReducedMotion } from 'framer-motion';

import { cx } from '@/components/ui/cx';
import { VizButton, VizShell } from '@/components/viz/VizShell';

export interface NmsBox {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
}

export interface NmsVizProps {
  label?: string;
  boxes?: NmsBox[];
  iouThreshold?: number;
  stepLabel?: string;
  resetLabel?: string;
  keptLabel?: string;
  suppressedLabel?: string;
  candidateLabel?: string;
  thresholdLabel?: string;
  introHint?: string;
  doneHint?: string;
}

type BoxState = 'candidate' | 'kept' | 'suppressed';

interface ComputedStep {
  states: BoxState[];
  activeIndex: number | null;
  caption: string;
}

const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 220;

const defaultBoxes: NmsBox[] = [
  { x: 40, y: 40, w: 130, h: 120, score: 0.92 },
  { x: 58, y: 58, w: 130, h: 118, score: 0.81 },
  { x: 30, y: 64, w: 120, h: 110, score: 0.74 },
  { x: 180, y: 70, w: 110, h: 110, score: 0.88 },
  { x: 196, y: 86, w: 108, h: 104, score: 0.66 },
];

const iouOf = (a: NmsBox, b: NmsBox): number => {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
};

const buildSteps = (
  boxes: NmsBox[],
  order: number[],
  threshold: number,
  keptLabel: string,
  suppressedLabel: string,
  introHint: string,
  doneHint: string,
): ComputedStep[] => {
  const steps: ComputedStep[] = [];
  const states: BoxState[] = boxes.map(() => 'candidate');

  steps.push({ states: [...states], activeIndex: null, caption: introHint });

  for (const winner of order) {
    const winnerBox = boxes[winner];
    if (!winnerBox || states[winner] === 'suppressed') continue;
    states[winner] = 'kept';
    const suppressedNow: number[] = [];
    for (const other of order) {
      const otherBox = boxes[other];
      if (!otherBox || states[other] !== 'candidate') continue;
      const overlap = iouOf(winnerBox, otherBox);
      if (overlap > threshold) {
        states[other] = 'suppressed';
        suppressedNow.push(other);
      }
    }
    const caption =
      suppressedNow.length > 0
        ? `${keptLabel} #${winner + 1} (score ${winnerBox.score.toFixed(2)}) → ${suppressedLabel}: ${suppressedNow
            .map((index) => `#${index + 1}`)
            .join(', ')}`
        : `${keptLabel} #${winner + 1} (score ${winnerBox.score.toFixed(2)})`;
    steps.push({ states: [...states], activeIndex: winner, caption });
  }

  steps.push({ states: [...states], activeIndex: null, caption: doneHint });
  return steps;
};

export const NmsViz = ({
  label = 'Non-Maximum Suppression',
  boxes = defaultBoxes,
  iouThreshold = 0.45,
  stepLabel = 'Шаг',
  resetLabel = 'Сначала',
  keptLabel = 'Оставлен',
  suppressedLabel = 'подавлены',
  candidateLabel = 'Кандидат',
  thresholdLabel = 'Порог IoU',
  introHint = 'Кандидаты отсортированы по уверенности. Жмите «Шаг», чтобы запустить подавление.',
  doneHint = 'Готово: остались только не пересекающиеся боксы с наибольшей уверенностью.',
}: NmsVizProps) => {
  const reduceMotion = useReducedMotion();
  const [stepIndex, setStepIndex] = useState(0);

  const order = useMemo(
    () =>
      boxes
        .map((box, index) => ({ index, score: box.score }))
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.index),
    [boxes],
  );

  const steps = useMemo(
    () => buildSteps(boxes, order, iouThreshold, keptLabel, suppressedLabel, introHint, doneHint),
    [boxes, order, iouThreshold, keptLabel, suppressedLabel, introHint, doneHint],
  );

  const clampedStep = Math.min(stepIndex, steps.length - 1);
  const fallbackStep: ComputedStep = {
    states: boxes.map(() => 'candidate'),
    activeIndex: null,
    caption: introHint,
  };
  const current = steps[clampedStep] ?? fallbackStep;
  const isLast = clampedStep >= steps.length - 1;

  const palette: Record<BoxState, { stroke: string; fill: string; text: string }> = {
    candidate: {
      stroke: 'stroke-fg-subtle',
      fill: 'fill-transparent',
      text: 'fill-fg-subtle',
    },
    kept: { stroke: 'stroke-ok', fill: 'fill-ok/12', text: 'fill-ok' },
    suppressed: { stroke: 'stroke-err', fill: 'fill-transparent', text: 'fill-err' },
  };

  const transitionClass = reduceMotion ? '' : 'transition-all duration-med ease-standard';

  return (
    <VizShell
      label={label}
      actions={
        <>
          <VizButton onClick={() => setStepIndex(0)} tone="ghost" disabled={clampedStep === 0}>
            {resetLabel}
          </VizButton>
          <VizButton
            onClick={() => setStepIndex((index) => Math.min(index + 1, steps.length - 1))}
            disabled={isLast}
          >
            {stepLabel}
          </VizButton>
        </>
      }
      footer={
        <span>
          {current.caption}{' '}
          <span className="font-mono text-fg-subtle">
            ({thresholdLabel} {iouThreshold.toFixed(2)})
          </span>
        </span>
      }
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-[300px] flex-1">
          <svg
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            role="img"
            aria-label={label}
            className="w-full rounded-lg border border-border-base bg-surface-2"
          >
            {boxes.map((box, index) => {
              const state = current.states[index] ?? 'candidate';
              const tone = palette[state];
              const isActive = current.activeIndex === index;
              const suppressed = state === 'suppressed';
              return (
                <g key={index} className={cx(transitionClass)} opacity={suppressed ? 0.45 : 1}>
                  <rect
                    x={box.x}
                    y={box.y}
                    width={box.w}
                    height={box.h}
                    className={cx(tone.stroke, tone.fill, transitionClass)}
                    strokeWidth={isActive ? 3 : state === 'kept' ? 2 : 1.5}
                    strokeDasharray={state === 'candidate' ? '5 4' : undefined}
                    rx={4}
                  />
                  <text
                    x={box.x + 5}
                    y={box.y + 14}
                    className={cx('font-mono text-[10px]', tone.text)}
                  >
                    #{index + 1} · {box.score.toFixed(2)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex flex-col gap-2 lg:w-[200px]">
          <div className="mb-1 flex flex-wrap gap-3 text-[11px]">
            <LegendDot className="bg-ok" text={keptLabel} />
            <LegendDot className="bg-err" text={suppressedLabel} />
            <LegendDot className="bg-fg-subtle" text={candidateLabel} />
          </div>
          <ul className="flex flex-col gap-1.5 font-mono text-[12px]">
            {order.map((boxIndex) => {
              const state = current.states[boxIndex] ?? 'candidate';
              const score = boxes[boxIndex]?.score ?? 0;
              return (
                <li
                  key={boxIndex}
                  className={cx(
                    'flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5',
                    state === 'kept'
                      ? 'border-ok/40 bg-ok/8 text-ok'
                      : state === 'suppressed'
                        ? 'border-err/30 bg-err/5 text-err line-through'
                        : 'border-border-base bg-surface text-fg-muted',
                  )}
                >
                  <span>#{boxIndex + 1}</span>
                  <span className="tabular-nums">{score.toFixed(2)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </VizShell>
  );
};

interface LegendDotProps {
  className: string;
  text: string;
}

const LegendDot = ({ className, text }: LegendDotProps) => (
  <span className="inline-flex items-center gap-1.5 text-fg-subtle">
    <span className={cx('size-2.5 rounded-sm', className)} />
    {text}
  </span>
);
