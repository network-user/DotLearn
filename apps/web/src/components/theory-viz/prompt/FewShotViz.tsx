import { useEffect, useMemo, useRef, useState } from 'react';

import { AnimatePresence, m as motion, useReducedMotion } from 'framer-motion';
import { Pause, Play, RotateCcw } from 'lucide-react';

import { cx } from '@/components/ui/cx';

export interface FewShot {
  input: string;
  output: string;
}

export interface FewShotVizProps {
  label?: string;
  shots?: FewShot[];
  query?: string;
  prediction?: string;
  modelName?: string;
  caption?: string;
}

const defaultLabel = 'Few-shot подсказка';

const defaultCaption =
  'Несколько пар «вход → выход» задают модели формат и стиль. Новый запрос модель продолжает по тому же шаблону.';

const defaultShots: FewShot[] = [
  { input: 'отличный сервис, всё быстро', output: 'позитив' },
  { input: 'товар пришёл сломанным', output: 'негатив' },
  { input: 'нормально, без восторга', output: 'нейтрально' },
];

const defaultQuery = 'доставку ждал две недели, ужас';

const defaultPrediction = 'негатив';

const defaultModelName = 'модель';

interface ButtonProps {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  label: string;
  children: React.ReactNode;
}

const ControlButton = ({ onClick, disabled, active, label, children }: ButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    className={cx(
      'inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 min-h-[36px] sm:min-h-[28px] min-w-[44px] sm:min-w-0 text-[12px] font-medium transition-colors duration-fast disabled:opacity-40 disabled:cursor-not-allowed',
      active
        ? 'bg-accent/12 text-accent hover:bg-accent/20'
        : 'text-fg-muted hover:bg-surface-2/60 hover:text-fg',
    )}
  >
    {children}
  </button>
);

const stepCount = (shots: FewShot[]): number => shots.length + 2;

export const FewShotViz = ({
  label = defaultLabel,
  shots = defaultShots,
  query = defaultQuery,
  prediction = defaultPrediction,
  modelName = defaultModelName,
  caption = defaultCaption,
}: FewShotVizProps) => {
  const reduceMotion = useReducedMotion();
  const total = useMemo(() => stepCount(shots), [shots]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = (): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => clearTimer, []);

  useEffect(() => {
    setStep(0);
    setPlaying(false);
    clearTimer();
  }, [shots, query]);

  useEffect(() => {
    if (!playing) return;
    if (step >= total - 1) {
      setPlaying(false);
      return;
    }
    timerRef.current = window.setTimeout(
      () => {
        setStep((value) => Math.min(value + 1, total - 1));
      },
      reduceMotion ? 350 : 900,
    );
    return clearTimer;
  }, [playing, step, total, reduceMotion]);

  const queryVisible = step >= shots.length;
  const predictionVisible = step >= shots.length + 1;
  const atEnd = step >= total - 1;

  const togglePlay = (): void => {
    if (atEnd) {
      setStep(0);
      setPlaying(true);
      return;
    }
    setPlaying((value) => !value);
  };

  const reset = (): void => {
    clearTimer();
    setPlaying(false);
    setStep(0);
  };

  const renderPair = (
    input: string,
    output: string,
    visible: boolean,
    delay: number,
    tone: 'shot' | 'query',
  ): JSX.Element => (
    <motion.div
      initial={false}
      animate={{ opacity: visible ? 1 : 0.25 }}
      transition={{ duration: 0.3 }}
      className={cx(
        'flex items-stretch gap-2',
        tone === 'query' && 'rounded-lg border border-accent/30 bg-accent/4 p-2',
      )}
    >
      <div className="flex-1 rounded-md border border-border-base bg-surface-2/50 px-2.5 py-1.5">
        <div className="eyebrow mb-0.5 text-fg-subtle">вход</div>
        <p className="font-mono text-[12px] leading-snug text-fg break-words">{input}</p>
      </div>
      <div className="flex items-center text-fg-subtle" aria-hidden>
        <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
          <path
            d="M1 7h15M12 2l5 5-5 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div
        className={cx(
          'flex w-[34%] min-w-[88px] items-center rounded-md border px-2.5 py-1.5',
          tone === 'query'
            ? 'border-accent/40 bg-accent/8'
            : 'border-[rgb(var(--viz-cat-3)/0.4)] bg-[rgb(var(--viz-cat-3)/0.08)]',
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {tone === 'query' && !visible ? (
            <motion.span
              key="pending"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="font-mono text-[12px] text-fg-subtle"
            >
              ?
            </motion.span>
          ) : (
            <motion.span
              key="value"
              initial={reduceMotion ? false : { opacity: 0, y: delay ? 4 : 0 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className={cx(
                'font-mono text-[12px] font-semibold',
                tone === 'query' ? 'text-accent' : 'text-[rgb(var(--viz-cat-3))]',
              )}
            >
              {output}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );

  return (
    <aside className="not-prose my-6 rounded-lg border border-border-base bg-surface overflow-hidden shadow-card">
      <header className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-border-base bg-surface-2">
        <span className="text-[11px] uppercase tracking-widest text-fg-subtle">{label}</span>
        <div className="flex items-center gap-1">
          <ControlButton
            onClick={togglePlay}
            active={playing}
            label={playing ? 'Пауза' : 'Запустить'}
          >
            {playing ? <Pause size={13} /> : <Play size={13} />}
            <span className="hidden sm:inline">
              {playing ? 'Пауза' : atEnd ? 'Снова' : 'Показать'}
            </span>
          </ControlButton>
          <ControlButton onClick={reset} disabled={step === 0 && !playing} label="Сбросить">
            <RotateCcw size={13} />
          </ControlButton>
        </div>
      </header>

      <div className="p-4 overflow-x-auto">
        <div className="flex flex-col gap-2">
          <div className="eyebrow text-fg-subtle">примеры в промпте</div>
          {shots.map((shot, index) => (
            <div key={`shot-${index}`}>
              {renderPair(shot.input, shot.output, step >= index + 1, 0, 'shot')}
            </div>
          ))}

          <div className="my-1 flex items-center gap-2" aria-hidden>
            <span className="h-px flex-1 bg-border-base" />
            <motion.span
              animate={playing && !atEnd && !reduceMotion ? { scale: [1, 1.06, 1] } : { scale: 1 }}
              transition={{ duration: 1, repeat: playing ? Infinity : 0 }}
              className="rounded-full border border-accent/40 bg-accent/8 px-2.5 py-0.5 font-mono text-[11px] text-accent"
            >
              {modelName}
            </motion.span>
            <span className="h-px flex-1 bg-border-base" />
          </div>

          <div className="eyebrow text-accent">новый запрос</div>
          {renderPair(query, prediction, queryVisible && predictionVisible, 1, 'query')}
        </div>

        <div className="mt-3 flex gap-1" aria-hidden>
          {Array.from({ length: total }).map((_, index) => (
            <span
              key={`tick-${index}`}
              className={cx(
                'h-1 flex-1 rounded-full transition-colors duration-fast',
                index <= step ? 'bg-accent/70' : 'bg-border-base',
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
