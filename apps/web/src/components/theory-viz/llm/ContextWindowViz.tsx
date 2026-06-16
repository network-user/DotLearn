import { useMemo, useState } from 'react';

import { motion, useReducedMotion } from 'framer-motion';

import { cx } from '@/components/ui/cx';
import { VizButton, VizShell } from '@/components/viz/VizShell';

export interface ContextWindowVizProps {
  tokens?: string[];
  windowSize?: number;
  label?: string;
  truncatedLabel?: string;
  contextLabel?: string;
  positionLabel?: string;
}

const defaultTokens = [
  'Жил',
  'был',
  'агент',
  ',',
  'который',
  'читал',
  'длинный',
  'документ',
  'по',
  'токену',
  'за',
  'раз',
  ',',
  'но',
  'окно',
  'контекста',
  'было',
  'конечным',
  ',',
  'и',
  'самое',
  'начало',
  'постепенно',
  'выпадало',
  'из',
  'памяти',
  '.',
];

export const ContextWindowViz = ({
  tokens = defaultTokens,
  windowSize = 8,
  label = 'Окно контекста',
  truncatedLabel = 'вытеснено',
  contextLabel = 'в контексте',
  positionLabel = 'позиция',
}: ContextWindowVizProps) => {
  const reduceMotion = useReducedMotion();
  const effectiveSize = Math.max(1, Math.min(windowSize, tokens.length));
  const [end, setEnd] = useState(effectiveSize);

  const start = Math.max(0, end - effectiveSize);

  const view = useMemo(
    () =>
      tokens.map((token, index) => ({
        token,
        index,
        inWindow: index >= start && index < end,
        truncated: index < start,
        future: index >= end,
      })),
    [tokens, start, end],
  );

  const atEnd = end >= tokens.length;
  const atStart = end <= effectiveSize;

  const advance = (): void => setEnd((value) => Math.min(value + 1, tokens.length));
  const rewind = (): void => setEnd((value) => Math.max(value - 1, effectiveSize));
  const reset = (): void => setEnd(effectiveSize);

  const truncatedCount = start;

  return (
    <VizShell
      label={label}
      actions={
        <>
          <VizButton onClick={rewind} disabled={atStart} tone="ghost">
            ←
          </VizButton>
          <VizButton onClick={advance} disabled={atEnd} tone="accent">
            →
          </VizButton>
          <VizButton onClick={reset} disabled={atStart} tone="ghost">
            Сброс
          </VizButton>
        </>
      }
      footer={
        <span>
          <span className="font-mono tabular-nums text-accent">{effectiveSize}</span> {contextLabel}{' '}
          <span className="text-border-strong">·</span>{' '}
          <span className="font-mono tabular-nums">{truncatedCount}</span> {truncatedLabel}{' '}
          <span className="text-border-strong">·</span> {positionLabel}{' '}
          <span className="font-mono tabular-nums">{end}</span>/{tokens.length}
        </span>
      }
    >
      <div className="overflow-x-auto">
        <div className="flex min-w-max flex-wrap gap-1.5">
          {view.map((item) => (
            <motion.span
              key={item.index}
              animate={{ opacity: item.truncated ? 0.28 : item.future ? 0.5 : 1 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
              className={cx(
                'inline-flex items-center rounded-md border px-2 py-1 font-mono text-[12.5px] transition-colors duration-fast',
                item.inWindow
                  ? 'border-accent/50 bg-accent/10 text-fg'
                  : item.truncated
                    ? 'border-dashed border-border-base bg-surface text-fg-subtle line-through'
                    : 'border-border-base bg-surface text-fg-muted',
              )}
            >
              {item.token}
            </motion.span>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3 text-[11px] text-fg-subtle">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm border border-accent/50 bg-accent/10" />
          {contextLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm border border-dashed border-border-base bg-surface" />
          {truncatedLabel}
        </span>
      </div>
    </VizShell>
  );
};
