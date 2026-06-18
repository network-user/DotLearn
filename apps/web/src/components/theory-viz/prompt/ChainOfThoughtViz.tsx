import { useEffect, useRef, useState } from 'react';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronRight, Play, RotateCcw, X } from 'lucide-react';

import { cx } from '@/components/ui/cx';

export interface ChainOfThoughtVizProps {
  label?: string;
  question?: string;
  steps?: string[];
  answer?: string;
  directAnswer?: string;
  directIsWrong?: boolean;
  caption?: string;
}

const defaultLabel = 'Цепочка рассуждений';

const defaultCaption =
  'Прямой ответ часто ошибается на многошаговых задачах. Просьба «рассуждай пошагово» заставляет модель проговорить промежуточные выводы и прийти к верному ответу.';

const defaultQuestion =
  'В корзине было 23 яблока. Использовали 20 на обед и докупили ещё 6. Сколько яблок осталось?';

const defaultSteps: string[] = [
  'Старт: в корзине 23 яблока.',
  'Использовали 20 на обед: 23 − 20 = 3.',
  'Докупили ещё 6: 3 + 6 = 9.',
];

const defaultAnswer = '9 яблок';

const defaultDirectAnswer = '3 яблока';

export const ChainOfThoughtViz = ({
  label = defaultLabel,
  question = defaultQuestion,
  steps = defaultSteps,
  answer = defaultAnswer,
  directAnswer = defaultDirectAnswer,
  directIsWrong = true,
  caption = defaultCaption,
}: ChainOfThoughtVizProps) => {
  const reduceMotion = useReducedMotion();
  const [revealed, setRevealed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<number | null>(null);
  const total = steps.length + 1;

  const clearTimer = (): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => clearTimer, []);

  useEffect(() => {
    setRevealed(0);
    setPlaying(false);
    clearTimer();
  }, [steps, answer]);

  useEffect(() => {
    if (!playing) return;
    if (revealed >= total) {
      setPlaying(false);
      return;
    }
    timerRef.current = window.setTimeout(
      () => setRevealed((value) => Math.min(value + 1, total)),
      reduceMotion ? 300 : 750,
    );
    return clearTimer;
  }, [playing, revealed, total, reduceMotion]);

  const answerVisible = revealed >= total;
  const atEnd = revealed >= total;

  const play = (): void => {
    if (atEnd) {
      setRevealed(0);
    }
    setPlaying(true);
  };

  const stepForward = (): void => {
    clearTimer();
    setPlaying(false);
    setRevealed((value) => Math.min(value + 1, total));
  };

  const reset = (): void => {
    clearTimer();
    setPlaying(false);
    setRevealed(0);
  };

  return (
    <aside className="not-prose my-6 rounded-lg border border-border-base bg-surface overflow-hidden shadow-card">
      <header className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-border-base bg-surface-2">
        <span className="text-[11px] uppercase tracking-widest text-fg-subtle">{label}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={play}
            aria-label="Запустить рассуждение"
            className="inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 min-h-[36px] sm:min-h-[28px] min-w-[44px] sm:min-w-0 text-[12px] font-medium bg-accent/12 text-accent hover:bg-accent/20 transition-colors duration-fast"
          >
            <Play size={13} />
            <span className="hidden sm:inline">{atEnd ? 'Снова' : 'Играть'}</span>
          </button>
          <button
            type="button"
            onClick={stepForward}
            disabled={atEnd}
            aria-label="Следующий шаг"
            className="inline-flex items-center justify-center rounded-md px-2.5 min-h-[36px] sm:min-h-[28px] min-w-[44px] sm:min-w-0 text-[12px] font-medium text-fg-muted hover:bg-surface-2/60 hover:text-fg disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-fast"
          >
            <ChevronRight size={14} />
            <span className="hidden sm:inline">Шаг</span>
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={revealed === 0 && !playing}
            aria-label="Сбросить"
            className="inline-flex items-center justify-center rounded-md px-2.5 min-h-[36px] sm:min-h-[28px] min-w-[44px] sm:min-w-0 text-fg-muted hover:bg-surface-2/60 hover:text-fg disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-fast"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </header>

      <div className="p-4 overflow-x-auto">
        <div className="rounded-lg border border-border-base bg-surface-2/50 px-3 py-2.5 mb-4">
          <div className="eyebrow mb-1 text-fg-subtle">вопрос</div>
          <p className="text-[13.5px] leading-relaxed text-fg break-words">{question}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border-base bg-surface p-3">
            <div className="eyebrow mb-2 text-fg-subtle">прямой ответ</div>
            <div
              className={cx(
                'flex items-center gap-2 rounded-md border px-2.5 py-2',
                directIsWrong ? 'border-err/40 bg-err/8' : 'border-ok/40 bg-ok/8',
              )}
            >
              <span
                className={cx(
                  'grid size-5 place-items-center rounded-full shrink-0',
                  directIsWrong ? 'bg-err/15 text-err' : 'bg-ok/15 text-ok',
                )}
                aria-hidden
              >
                {directIsWrong ? <X size={12} /> : <Check size={12} />}
              </span>
              <span
                className={cx(
                  'font-mono text-[13px] font-semibold',
                  directIsWrong ? 'text-err line-through decoration-err/50' : 'text-ok',
                )}
              >
                {directAnswer}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-accent/30 bg-accent/4 p-3">
            <div className="eyebrow mb-2 text-accent">пошаговое рассуждение</div>
            <ol className="flex flex-col gap-1.5">
              {steps.map((stepText, index) => {
                const visible = revealed > index;
                return (
                  <li key={`cot-${index}`} className="min-h-[28px]">
                    <AnimatePresence initial={false}>
                      {visible && (
                        <motion.div
                          initial={reduceMotion ? false : { opacity: 0, x: -8, height: 0 }}
                          animate={{ opacity: 1, x: 0, height: 'auto' }}
                          transition={{ duration: 0.3 }}
                          className="flex items-start gap-2"
                        >
                          <span className="mt-0.5 grid size-5 place-items-center rounded-full bg-accent/12 text-accent text-[11px] font-semibold font-mono shrink-0">
                            {index + 1}
                          </span>
                          <p className="text-[13px] leading-relaxed text-fg break-words">
                            {stepText}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ol>

            <AnimatePresence initial={false}>
              {answerVisible && (
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-2.5 flex items-center gap-2 rounded-md border border-ok/40 bg-ok/10 px-2.5 py-2"
                >
                  <span
                    className="grid size-5 place-items-center rounded-full bg-ok/15 text-ok shrink-0"
                    aria-hidden
                  >
                    <Check size={12} />
                  </span>
                  <span className="font-mono text-[13px] font-semibold text-ok">{answer}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-3 flex gap-1" aria-hidden>
          {Array.from({ length: total }).map((_, index) => (
            <span
              key={`progress-${index}`}
              className={cx(
                'h-1 flex-1 rounded-full transition-colors duration-fast',
                index < revealed ? 'bg-accent/70' : 'bg-border-base',
              )}
            />
          ))}
        </div>
      </div>

      {caption && (
        <footer className="px-4 py-2.5 border-t border-border-base/60 bg-surface text-[12.5px] leading-relaxed text-fg-muted">
          {caption}
        </footer>
      )}
    </aside>
  );
};
