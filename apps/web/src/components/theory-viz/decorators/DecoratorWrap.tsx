import { useEffect, useRef, useState } from 'react';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Play, RotateCcw } from 'lucide-react';

import { cx } from '@/components/ui/cx';
import { VizButton, VizShell } from '@/components/viz/VizShell';

export interface DecoratorWrapProps {
  decoratorName?: string;
  funcName?: string;
  before?: string;
  after?: string;
  label?: string;
  callExpression?: string;
}

type Stage = 'idle' | 'enter' | 'before' | 'inner' | 'after' | 'return';

const stageOrder: Stage[] = ['idle', 'enter', 'before', 'inner', 'after', 'return'];

const stageMs = 720;

const stageCaption: Record<Stage, string> = {
  idle: 'Вызов снаружи попадает не в исходную функцию, а в обёртку-декоратор.',
  enter: 'Вызов входит в wrapper — функцию, которую вернул декоратор.',
  before: 'Сначала срабатывает код «до»: логирование, замер времени, проверка.',
  inner: 'Обёртка передаёт управление исходной функции и получает результат.',
  after: 'Затем выполняется код «после»: обработка результата, очистка.',
  return: 'Обёртка возвращает результат наружу — снаружи всё выглядит как обычный вызов.',
};

const activeAtStage: Record<Stage, { outer: boolean; before: boolean; inner: boolean; after: boolean }> = {
  idle: { outer: false, before: false, inner: false, after: false },
  enter: { outer: true, before: false, inner: false, after: false },
  before: { outer: true, before: true, inner: false, after: false },
  inner: { outer: true, before: false, inner: true, after: false },
  after: { outer: true, before: false, inner: false, after: true },
  return: { outer: true, before: false, inner: false, after: false },
};

export const DecoratorWrap = ({
  decoratorName = 'timed',
  funcName = 'compute',
  before = 'start = time()',
  after = 'log(time() - start)',
  label,
  callExpression,
}: DecoratorWrapProps) => {
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState<Stage>('idle');
  const [running, setRunning] = useState(false);
  const timerRef = useRef<number | null>(null);

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
      setStage('return');
      setRunning(false);
      return;
    }
    const advance = (index: number): void => {
      const next = stageOrder[index];
      if (next === undefined) {
        setRunning(false);
        return;
      }
      setStage(next);
      timerRef.current = window.setTimeout(() => advance(index + 1), stageMs);
    };
    advance(1);
  };

  const step = (): void => {
    stopTimer();
    setRunning(false);
    setStage((current) => {
      const index = stageOrder.indexOf(current);
      const next = stageOrder[(index + 1) % stageOrder.length];
      return next ?? 'idle';
    });
  };

  const reset = (): void => {
    stopTimer();
    setRunning(false);
    setStage('idle');
  };

  const active = activeAtStage[stage];
  const expr = callExpression ?? `${funcName}(x)`;
  const tokenVisible = stage !== 'idle';
  const tokenReturning = stage === 'return';

  return (
    <VizShell
      label={label ?? `Декоратор @${decoratorName}`}
      actions={
        <>
          <VizButton onClick={play} disabled={running}>
            <Play size={12} />
            проиграть
          </VizButton>
          <VizButton onClick={step} tone="ghost" disabled={running}>
            шаг
          </VizButton>
          <VizButton onClick={reset} tone="ghost" disabled={stage === 'idle'}>
            <RotateCcw size={11} />
            сброс
          </VizButton>
        </>
      }
      footer={<span key={stage}>{stageCaption[stage]}</span>}
    >
      <div className="min-w-[300px]">
        <div className="relative flex flex-col items-center gap-2">
          <div className="flex w-full items-center justify-between font-mono text-[12px]">
            <span className="text-fg-subtle">@{decoratorName}</span>
            <span className="text-fg-subtle">def {funcName}(…)</span>
          </div>

          <div className="relative h-6 w-full">
            <AnimatePresence>
              {tokenVisible && (
                <motion.span
                  key="call-token"
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -40 }}
                  animate={{
                    opacity: 1,
                    x: tokenReturning ? 40 : 0,
                    y: tokenReturning ? -2 : 0,
                  }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 40 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                  className={cx(
                    'absolute left-1/2 top-0 -translate-x-1/2 rounded-full border px-2.5 py-0.5 font-mono text-[11px] shadow-card',
                    tokenReturning
                      ? 'border-ok/50 bg-ok/10 text-ok'
                      : 'border-accent/50 bg-accent/10 text-accent',
                  )}
                >
                  {tokenReturning ? 'результат' : expr}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <motion.div
            animate={
              reduceMotion
                ? {}
                : { scale: active.outer ? 1 : 0.99, opacity: active.outer ? 1 : 0.92 }
            }
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className={cx(
              'w-full rounded-xl border-2 px-3 pb-3 pt-2.5 transition-colors duration-fast',
              active.outer
                ? 'border-accent/60 bg-accent/[0.06]'
                : 'border-border-strong bg-surface-2',
            )}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-md bg-accent/12 px-2 py-0.5 font-mono text-[11px] font-semibold text-accent">
                wrapper
              </span>
              <span className="font-mono text-[11px] text-fg-subtle">обёртка от @{decoratorName}</span>
            </div>

            <HookRow text={before} kind="before" active={active.before} reduceMotion={!!reduceMotion} />

            <motion.div
              animate={
                reduceMotion ? {} : { scale: active.inner ? 1.015 : 1 }
              }
              transition={{ type: 'spring', stiffness: 420, damping: 24 }}
              className={cx(
                'my-2 rounded-lg border px-3 py-2.5 transition-colors duration-fast',
                active.inner
                  ? 'border-ok/60 bg-ok/10'
                  : 'border-border-base bg-surface',
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cx(
                    'rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold transition-colors duration-fast',
                    active.inner ? 'bg-ok/20 text-ok' : 'bg-surface-2 text-fg-muted',
                  )}
                >
                  {funcName}()
                </span>
                <span className="font-mono text-[11px] text-fg-subtle">исходная функция</span>
              </div>
            </motion.div>

            <HookRow text={after} kind="after" active={active.after} reduceMotion={!!reduceMotion} />
          </motion.div>

          <div className="flex w-full items-center justify-center font-mono text-[11px] text-fg-subtle">
            <span className="rounded-full bg-surface-2 px-2 py-0.5">
              {funcName} = {decoratorName}({funcName})
            </span>
          </div>
        </div>
      </div>
    </VizShell>
  );
};

interface HookRowProps {
  text: string;
  kind: 'before' | 'after';
  active: boolean;
  reduceMotion: boolean;
}

const HookRow = ({ text, kind, active, reduceMotion }: HookRowProps) => (
  <motion.div
    animate={reduceMotion ? {} : { x: active ? 4 : 0 }}
    transition={{ type: 'spring', stiffness: 460, damping: 30 }}
    className={cx(
      'flex items-center gap-2 rounded-md border px-2.5 py-1.5 transition-colors duration-fast',
      active ? 'border-accent/50 bg-accent/10' : 'border-transparent bg-surface-2/50',
    )}
  >
    <span
      className={cx(
        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide transition-colors duration-fast',
        active ? 'bg-accent/15 text-accent' : 'bg-surface text-fg-subtle',
      )}
    >
      {kind === 'before' ? 'до' : 'после'}
    </span>
    <code className="truncate font-mono text-[11.5px] text-fg-muted">{text}</code>
  </motion.div>
);
