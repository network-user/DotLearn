import { useState } from 'react';

import { motion, useReducedMotion } from 'framer-motion';
import { Plus, RotateCcw } from 'lucide-react';

import { cx } from '@/components/ui/cx';
import { VizButton, VizShell } from '@/components/viz/VizShell';

import type { VizLang } from './hash-utils';

export interface LoadFactorVizProps {
  initialSize?: number;
  threshold?: number;
  label?: string;
  lang?: VizLang;
}

const STRINGS = {
  ru: {
    label: 'Коэффициент загрузки и рехеширование',
    add: 'добавить элемент',
    reset: 'сброс',
    elements: 'элементы',
    buckets: 'корзины',
    rehashes: 'рехешей',
    threshold: 'порог',
    resized: (size: number, th: number) =>
      `α превысил порог ${th} - таблица удвоилась до ${size} корзин, все элементы перехешированы. Один дорогой шаг, но он окупается на множестве дешёвых вставок: амортизированная стоимость остаётся O(1).`,
    idle: (th: number) =>
      `α = элементы / корзины. Добавляйте элементы и следите за полосой: как только α переваливает за ${th}, таблица растёт, чтобы корзины не переполнялись.`,
  },
  en: {
    label: 'Load factor and rehashing',
    add: 'add element',
    reset: 'reset',
    elements: 'elements',
    buckets: 'buckets',
    rehashes: 'rehashes',
    threshold: 'threshold',
    resized: (size: number, th: number) =>
      `α crossed the threshold ${th} - the table doubled to ${size} buckets and every element was rehashed. One expensive step, but it pays off across many cheap inserts: the amortized cost stays O(1).`,
    idle: (th: number) =>
      `α = elements / buckets. Add elements and watch the bar: as soon as α passes ${th}, the table grows so buckets don't overflow.`,
  },
} as const;

export const LoadFactorViz = ({
  initialSize = 4,
  threshold = 0.75,
  label,
  lang = 'ru',
}: LoadFactorVizProps) => {
  const t = STRINGS[lang];
  const reduceMotion = useReducedMotion();
  const [size, setSize] = useState(initialSize);
  const [count, setCount] = useState(0);
  const [resizes, setResizes] = useState(0);
  const [justResized, setJustResized] = useState(false);

  const add = (): void => {
    const nextCount = count + 1;
    setCount(nextCount);
    if (nextCount / size >= threshold) {
      setSize(size * 2);
      setResizes((value) => value + 1);
      setJustResized(true);
    } else {
      setJustResized(false);
    }
  };

  const reset = (): void => {
    setSize(initialSize);
    setCount(0);
    setResizes(0);
    setJustResized(false);
  };

  const alpha = count / size;
  const fillPercent = Math.min(alpha, 1) * 100;
  const thresholdPercent = threshold * 100;

  return (
    <VizShell
      label={label ?? t.label}
      actions={
        <>
          <VizButton onClick={add}>
            <Plus size={12} />
            {t.add}
          </VizButton>
          <VizButton onClick={reset} tone="ghost" disabled={count === 0 && resizes === 0}>
            <RotateCcw size={11} />
            {t.reset}
          </VizButton>
        </>
      }
      footer={
        justResized ? <span>{t.resized(size, threshold)}</span> : <span>{t.idle(threshold)}</span>
      }
    >
      <div className="min-w-[300px] space-y-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[13px]">
          <span className="text-fg-muted">
            {t.elements} <strong className="text-fg">{count}</strong>
          </span>
          <span className="text-fg-muted">
            {t.buckets} <strong className="text-fg">{size}</strong>
          </span>
          <span className="text-fg-muted">
            α ={' '}
            <strong className={alpha > threshold ? 'text-warn' : 'text-accent'}>
              {alpha.toFixed(2)}
            </strong>
          </span>
          <span className="text-fg-subtle">
            {t.rehashes}: {resizes}
          </span>
        </div>

        <div className="relative h-7 overflow-hidden rounded-md border border-border-base bg-surface-2">
          <motion.div
            className={cx('h-full', alpha > threshold ? 'bg-warn/60' : 'bg-accent/55')}
            animate={{ width: `${fillPercent}%` }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 180, damping: 24 }}
          />
          <div
            className="absolute inset-y-0 w-px bg-err/70"
            style={{ left: `${thresholdPercent}%` }}
            aria-hidden
          />
          <span
            className="absolute -top-0.5 translate-x-1 text-[10px] font-medium text-err"
            style={{ left: `${thresholdPercent}%` }}
          >
            {t.threshold}
          </span>
        </div>

        <motion.div
          key={size}
          initial={reduceMotion ? false : { opacity: 0.5 }}
          animate={{ opacity: 1 }}
          className="flex flex-wrap gap-1"
        >
          {Array.from({ length: size }, (_, i) => (
            <span
              key={i}
              className={cx(
                'h-5 flex-1 rounded-sm border min-w-[10px]',
                i < count ? 'border-accent/40 bg-accent/30' : 'border-border-base bg-surface',
              )}
              aria-hidden
            />
          ))}
        </motion.div>
      </div>
    </VizShell>
  );
};
