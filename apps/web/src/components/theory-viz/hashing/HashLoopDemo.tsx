import { useEffect, useRef, useState } from 'react';

import { AnimatePresence, m as motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Pause, Play, SkipForward } from 'lucide-react';

import { cx } from '@/components/ui/cx';
import { VizButton, VizShell } from '@/components/viz/VizShell';
import { useInViewport } from '@/hooks/useInViewport';

import { bits32, fnv1a, toHex, type VizLang } from './hash-utils';

export interface HashLoopDemoProps {
  inputs?: string[];
  label?: string;
  lang?: VizLang;
  intervalMs?: number;
}

const STRINGS = {
  ru: {
    label: 'Один и тот же hash() на разных входах (цикл)',
    play: 'играть',
    pause: 'пауза',
    step: 'дальше',
    defaultInputs: ['Москва', 'Казань', 'Сочи', 'Пермь', 'Тула'],
    caption:
      'Функция одна, входы разные - отпечатки совершенно непохожи и всегда одной длины. Анимация идёт по кругу.',
    reduced:
      'Анимация отключена в настройках системы. Жмите «дальше», чтобы пролистать входы вручную.',
  },
  en: {
    label: 'The same hash() on different inputs (loop)',
    play: 'play',
    pause: 'pause',
    step: 'next',
    defaultInputs: ['Moscow', 'Kazan', 'Sochi', 'Perm', 'Tula'],
    caption:
      'One function, different inputs - the fingerprints are completely unalike and always the same length. The animation runs in a loop.',
    reduced:
      'Animation is disabled in your system settings. Press "next" to step through inputs manually.',
  },
} as const;

export const HashLoopDemo = ({
  inputs,
  label,
  lang = 'ru',
  intervalMs = 2000,
}: HashLoopDemoProps) => {
  const t = STRINGS[lang];
  const reduceMotion = useReducedMotion();
  const items = inputs ?? t.defaultInputs;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(!reduceMotion);
  const timerRef = useRef<number | null>(null);
  const [viewportRef, visible] = useInViewport<HTMLDivElement>();

  useEffect(() => {
    if (!playing || reduceMotion || !visible) return;
    timerRef.current = window.setInterval(() => {
      setIndex((current) => (current + 1) % items.length);
    }, intervalMs);
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, [playing, reduceMotion, visible, items.length, intervalMs]);

  const current = items[index] ?? items[0] ?? '';
  const hash = fnv1a(current);
  const bits = bits32(hash);
  const step = (): void => setIndex((value) => (value + 1) % items.length);

  return (
    <VizShell
      label={label ?? t.label}
      actions={
        <>
          {!reduceMotion && (
            <VizButton onClick={() => setPlaying((value) => !value)} tone="ghost">
              {playing ? <Pause size={12} /> : <Play size={12} />}
              {playing ? t.pause : t.play}
            </VizButton>
          )}
          <VizButton onClick={step} tone="ghost">
            <SkipForward size={12} />
            {t.step}
          </VizButton>
        </>
      }
      footer={<span>{reduceMotion ? t.reduced : t.caption}</span>}
    >
      <div ref={viewportRef} className="flex min-w-[300px] flex-col gap-4">
        <div className="flex items-center justify-center gap-3 sm:gap-5">
          <div className="relative h-9 w-28 sm:w-32">
            <AnimatePresence mode="popLayout">
              <motion.span
                key={current}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                {...(reduceMotion ? {} : { exit: { opacity: 0, y: -10 } })}
                transition={{ duration: 0.35 }}
                className="absolute inset-0 flex items-center justify-center rounded-md border border-border-strong bg-surface-2 px-2 font-mono text-[15px] text-fg"
              >
                {current}
              </motion.span>
            </AnimatePresence>
          </div>

          <ArrowRight size={18} className="shrink-0 text-fg-subtle" />

          <div className="flex items-baseline gap-1 font-mono">
            <span className="text-fg-subtle text-xs">0x</span>
            <div className="flex gap-0.5 text-[18px] sm:text-xl font-semibold tracking-wide text-accent">
              {toHex(hash)
                .split('')
                .map((digit, i) => (
                  <AnimatePresence mode="popLayout" key={i}>
                    <motion.span
                      key={`${digit}-${index}`}
                      initial={reduceMotion ? false : { y: -8, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.25, delay: i * 0.02 }}
                    >
                      {digit}
                    </motion.span>
                  </AnimatePresence>
                ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1">
          {bits.map((bit, i) => (
            <motion.span
              key={i}
              animate={{ opacity: 1 }}
              className={cx(
                'aspect-square rounded-[3px] border transition-colors duration-med',
                bit === 1 ? 'border-accent/40 bg-accent/70' : 'border-border-base bg-surface-2',
              )}
              aria-hidden
            />
          ))}
        </div>

        <div className="flex justify-center gap-1.5">
          {items.map((_, i) => (
            <span
              key={i}
              className={cx(
                'h-1.5 rounded-full transition-all duration-med',
                i === index ? 'w-5 bg-accent' : 'w-1.5 bg-border-strong',
              )}
              aria-hidden
            />
          ))}
        </div>
      </div>
    </VizShell>
  );
};
