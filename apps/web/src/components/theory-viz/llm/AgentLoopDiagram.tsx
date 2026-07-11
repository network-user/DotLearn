import { useEffect, useRef, useState } from 'react';

import { m as motion, useReducedMotion } from 'framer-motion';
import { Pause, Play, RotateCw } from 'lucide-react';

import { cx } from '@/components/ui/cx';
import { VizButton, VizShell } from '@/components/viz/VizShell';
import { useInViewport } from '@/hooks/useInViewport';

export interface AgentLoopStep {
  title: string;
  detail: string;
}

export interface AgentLoopDiagramProps {
  steps?: AgentLoopStep[];
  label?: string;
  playLabel?: string;
  pauseLabel?: string;
  stepLabel?: string;
  resetLabel?: string;
}

const defaultSteps: AgentLoopStep[] = [
  { title: 'Думает', detail: 'Модель решает, что делать дальше, исходя из цели и истории.' },
  { title: 'Вызывает инструмент', detail: 'Формирует вызов инструмента с аргументами в JSON.' },
  { title: 'Наблюдает', detail: 'Получает результат инструмента и добавляет его в контекст.' },
  { title: 'Повторяет', detail: 'Если задача не решена, цикл начинается заново.' },
  { title: 'Отвечает', detail: 'Когда данных достаточно, выдаёт финальный ответ.' },
];

interface Point {
  x: number;
  y: number;
}

const STEP_MS = 2000;
const RADIUS = 116;
const CENTER = 150;
const NODE = 30;
const fallbackStep: AgentLoopStep = { title: '', detail: '' };

const nodePosition = (index: number, total: number): Point => {
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  return { x: CENTER + Math.cos(angle) * RADIUS, y: CENTER + Math.sin(angle) * RADIUS };
};

export const AgentLoopDiagram = ({
  steps = defaultSteps,
  label = 'Цикл агента',
  playLabel = 'Старт',
  pauseLabel = 'Пауза',
  stepLabel = 'Шаг',
  resetLabel = 'Сброс',
}: AgentLoopDiagramProps) => {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<number | null>(null);
  const [viewportRef, visible] = useInViewport<HTMLDivElement>();

  const total = steps.length;

  useEffect(() => {
    if (!playing || !visible) return;
    timerRef.current = window.setInterval(() => {
      setActive((value) => (value + 1) % total);
    }, STEP_MS);
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, [playing, visible, total]);

  const positions: Point[] = steps.map((_, index) => nodePosition(index, total));
  const current = steps[active] ?? fallbackStep;

  const togglePlay = (): void => setPlaying((value) => !value);
  const stepForward = (): void => {
    setPlaying(false);
    setActive((value) => (value + 1) % total);
  };
  const reset = (): void => {
    setPlaying(false);
    setActive(0);
  };

  return (
    <VizShell
      label={label}
      actions={
        <>
          <VizButton onClick={togglePlay} tone="accent">
            {playing ? <Pause size={12} /> : <Play size={12} />}
            {playing ? pauseLabel : playLabel}
          </VizButton>
          <VizButton onClick={stepForward} tone="ghost">
            {stepLabel}
          </VizButton>
          <VizButton onClick={reset} tone="ghost">
            <RotateCw size={12} />
            {resetLabel}
          </VizButton>
        </>
      }
      footer={
        <span>
          <span className="font-mono text-accent">{current.title}.</span>{' '}
          <span className="text-fg-muted">{current.detail}</span>
        </span>
      }
    >
      <div ref={viewportRef} className="mx-auto w-full max-w-[360px]">
        <svg viewBox="0 0 300 300" className="block w-full" role="img" aria-label={label}>
          <defs>
            <marker
              id="agent-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill="rgb(var(--accent-1))" />
            </marker>
          </defs>

          {steps.map((_, index) => {
            const from = positions[index] ?? nodePosition(index, total);
            const to = positions[(index + 1) % total] ?? nodePosition((index + 1) % total, total);
            const isActiveEdge = index === active;
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.hypot(dx, dy) || 1;
            const ux = dx / len;
            const uy = dy / len;
            const sx = from.x + ux * (NODE + 4);
            const sy = from.y + uy * (NODE + 4);
            const ex = to.x - ux * (NODE + 10);
            const ey = to.y - uy * (NODE + 10);
            const midX = (sx + ex) / 2 - uy * 24;
            const midY = (sy + ey) / 2 + ux * 24;
            return (
              <path
                key={`edge-${index}`}
                d={`M ${sx} ${sy} Q ${midX} ${midY} ${ex} ${ey}`}
                fill="none"
                stroke={isActiveEdge ? 'rgb(var(--accent-1))' : 'rgb(var(--border-strong) / 0.6)'}
                strokeWidth={isActiveEdge ? 2 : 1.25}
                markerEnd="url(#agent-arrow)"
                className="transition-[stroke] duration-med"
              />
            );
          })}

          {steps.map((step, index) => {
            const { x, y } = positions[index] ?? nodePosition(index, total);
            const isActive = index === active;
            const pulsing = isActive && playing && !reduceMotion && visible;
            return (
              <g
                key={`node-${index}`}
                transform={`translate(${x} ${y})`}
                className="cursor-pointer"
                onClick={() => {
                  setPlaying(false);
                  setActive(index);
                }}
                tabIndex={0}
                role="button"
                aria-label={step.title}
                onFocus={() => setActive(index)}
              >
                <motion.circle
                  r={NODE}
                  animate={pulsing ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={
                    pulsing
                      ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
                      : { duration: 0.2 }
                  }
                  fill={isActive ? 'rgb(var(--accent-1) / 0.16)' : 'rgb(var(--surface-2))'}
                  stroke={isActive ? 'rgb(var(--accent-1))' : 'rgb(var(--border-strong))'}
                  strokeWidth={isActive ? 2 : 1.25}
                />
                <text
                  textAnchor="middle"
                  dy="0.35em"
                  className={cx(
                    'pointer-events-none select-none font-display',
                    isActive ? 'fill-[rgb(var(--accent-1))]' : 'fill-[rgb(var(--fg-muted))]',
                  )}
                  style={{ fontSize: 10.5, fontWeight: 600 }}
                >
                  {step.title.length > 11 ? `${step.title.slice(0, 10)}…` : step.title}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </VizShell>
  );
};
