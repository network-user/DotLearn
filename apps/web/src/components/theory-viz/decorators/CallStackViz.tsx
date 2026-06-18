import { useEffect, useRef, useState } from 'react';

import { AnimatePresence, m as motion, useReducedMotion } from 'framer-motion';
import { Play, RotateCcw } from 'lucide-react';

import { cx } from '@/components/ui/cx';
import { VizButton, VizShell } from '@/components/viz/VizShell';

export interface CallStackVizProps {
  frames?: string[];
  label?: string;
  innerLabel?: string;
}

type Direction = 'idle' | 'pushing' | 'peak' | 'popping' | 'done';

const stepMs = 620;

const directionCaption = (
  direction: Direction,
  depth: number,
  total: number,
  top: string | undefined,
  inner: string,
): string => {
  switch (direction) {
    case 'idle':
      return 'Стек кадров пуст. Каждый декоратор добавляет свой кадр поверх предыдущего.';
    case 'pushing':
      return `Заходим в кадр «${top ?? ''}» — он ложится поверх стека. Глубина: ${depth} из ${total}.`;
    case 'peak':
      return `Все обёртки на стеке, управление дошло до «${inner}». Самый вложенный вызов.`;
    case 'popping':
      return `Возврат из «${top ?? inner}» — кадр снимается со стека, результат идёт наружу.`;
    case 'done':
      return 'Стек снова пуст: каждый кадр вернул управление тому, кто его вызвал.';
  }
};

export const CallStackViz = ({
  frames = ['@auth', '@cache', '@log'],
  label,
  innerLabel = 'handler()',
}: CallStackVizProps) => {
  const reduceMotion = useReducedMotion();
  const [depth, setDepth] = useState(0);
  const [direction, setDirection] = useState<Direction>('idle');
  const [running, setRunning] = useState(false);
  const timerRef = useRef<number | null>(null);

  const total = frames.length + 1;

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const stopTimer = (): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const play = (): void => {
    stopTimer();
    setRunning(true);
    if (reduceMotion) {
      setDepth(0);
      setDirection('done');
      setRunning(false);
      return;
    }
    let current = 0;
    let goingUp = true;
    setDepth(0);
    setDirection('pushing');
    const tick = (): void => {
      if (goingUp) {
        current += 1;
        setDepth(current);
        if (current >= total) {
          goingUp = false;
          setDirection('peak');
        } else {
          setDirection('pushing');
        }
      } else {
        current -= 1;
        setDepth(current);
        setDirection(current <= 0 ? 'done' : 'popping');
        if (current <= 0) {
          setRunning(false);
          return;
        }
      }
      timerRef.current = window.setTimeout(tick, stepMs);
    };
    timerRef.current = window.setTimeout(tick, stepMs);
  };

  const step = (): void => {
    stopTimer();
    setRunning(false);
    setDepth((current) => {
      const next = current >= total ? 0 : current + 1;
      setDirection(next === 0 ? 'idle' : next >= total ? 'peak' : 'pushing');
      return next;
    });
  };

  const reset = (): void => {
    stopTimer();
    setRunning(false);
    setDepth(0);
    setDirection('idle');
  };

  const allFrames = [...frames, innerLabel];
  const visible = allFrames.slice(0, depth);
  const topFrame = visible[visible.length - 1];

  return (
    <VizShell
      label={label ?? 'Стек вызовов'}
      actions={
        <>
          <VizButton onClick={play} disabled={running}>
            <Play size={12} />
            проиграть
          </VizButton>
          <VizButton onClick={step} tone="ghost" disabled={running}>
            шаг
          </VizButton>
          <VizButton onClick={reset} tone="ghost" disabled={depth === 0 && direction === 'idle'}>
            <RotateCcw size={11} />
            сброс
          </VizButton>
        </>
      }
      footer={
        <span key={`${direction}-${depth}`}>
          {directionCaption(direction, depth, total, topFrame, innerLabel)}
        </span>
      }
    >
      <div className="grid min-w-[300px] grid-cols-1 items-end gap-4 sm:grid-cols-[1fr_max-content]">
        <div className="flex flex-col-reverse items-stretch gap-1.5">
          <div className="rounded-md border border-border-base bg-surface-2 px-3 py-1.5 text-center font-mono text-[11px] text-fg-subtle">
            底 дно стека
          </div>
          <div className="flex min-h-[180px] flex-col-reverse justify-start gap-1.5">
            <AnimatePresence mode="popLayout" initial={false}>
              {visible.map((frame, index) => {
                const isInner = index === allFrames.length - 1;
                const isTop = index === visible.length - 1;
                return (
                  <motion.div
                    key={frame + index}
                    layout={!reduceMotion}
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                    className={cx(
                      'flex items-center justify-between gap-2 rounded-lg border-2 px-3 py-2 font-mono text-[12.5px] transition-colors duration-fast',
                      isInner
                        ? 'border-ok/60 bg-ok/10 text-ok'
                        : isTop
                          ? 'border-accent/60 bg-accent/10 text-accent'
                          : 'border-border-strong bg-surface text-fg',
                    )}
                  >
                    <span className="font-semibold">{frame}</span>
                    <span className="text-[10px] uppercase tracking-wide opacity-70">
                      {isInner ? 'тело' : `кадр ${index + 1}`}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex flex-row items-center gap-3 sm:flex-col sm:items-stretch sm:gap-2">
          <DepthGauge depth={depth} total={total} reduceMotion={!!reduceMotion} />
          <ul className="space-y-1 font-mono text-[11px] text-fg-subtle">
            {allFrames.map((frame, index) => (
              <li
                key={frame + index}
                className={cx(
                  'flex items-center gap-1.5 transition-colors duration-fast',
                  index < depth ? 'text-fg' : 'text-fg-subtle/60',
                )}
              >
                <span
                  className={cx(
                    'inline-block size-1.5 rounded-full',
                    index < depth ? 'bg-accent' : 'bg-border-strong',
                  )}
                />
                {frame}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </VizShell>
  );
};

interface DepthGaugeProps {
  depth: number;
  total: number;
  reduceMotion: boolean;
}

const DepthGauge = ({ depth, total, reduceMotion }: DepthGaugeProps) => {
  const ratio = total === 0 ? 0 : Math.min(1, depth / total);
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-20 overflow-hidden rounded-full bg-surface-2 sm:w-full">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-accent"
          initial={false}
          animate={{ width: `${ratio * 100}%` }}
          transition={
            reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 30 }
          }
        />
      </div>
      <span className="font-mono text-[11px] tabular-nums text-fg-muted">
        {depth}/{total}
      </span>
    </div>
  );
};
