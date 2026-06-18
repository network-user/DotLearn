import { useMemo, useState } from 'react';

import { motion, useReducedMotion } from 'framer-motion';

import { cx } from '@/components/ui/cx';
import { VizShell } from '@/components/viz/VizShell';

export type SamplingCandidate = [string, number];

export interface SamplingBarsProps {
  candidates?: SamplingCandidate[];
  label?: string;
  temperatureLabel?: string;
  topKLabel?: string;
  topPLabel?: string;
}

interface ScoredCandidate {
  token: string;
  logit: number;
  probability: number;
  kept: boolean;
  cutBy: 'topK' | 'topP' | null;
}

const defaultCandidates: SamplingCandidate[] = [
  ['кофе', 3.2],
  ['чай', 2.7],
  ['воду', 2.1],
  ['сок', 1.4],
  ['молоко', 0.9],
  ['пиво', 0.3],
  ['ничего', -0.4],
];

const softmax = (logits: number[], temperature: number): number[] => {
  const safeTemp = Math.max(temperature, 0.01);
  const scaled = logits.map((value) => value / safeTemp);
  const max = Math.max(...scaled);
  const exps = scaled.map((value) => Math.exp(value - max));
  const sum = exps.reduce((total, value) => total + value, 0) || 1;
  return exps.map((value) => value / sum);
};

export const SamplingBars = ({
  candidates = defaultCandidates,
  label = 'Сэмплирование следующего токена',
  temperatureLabel = 'Температура',
  topKLabel = 'top-k',
  topPLabel = 'top-p',
}: SamplingBarsProps) => {
  const reduceMotion = useReducedMotion();
  const [temperature, setTemperature] = useState(0.8);
  const [topK, setTopK] = useState(candidates.length);
  const [topP, setTopP] = useState(1);

  const scored = useMemo<ScoredCandidate[]>(() => {
    const logits = candidates.map(([, logit]) => logit);
    const probabilities = softmax(logits, temperature);
    const ranked = candidates
      .map(([token, logit], index) => ({ token, logit, probability: probabilities[index] ?? 0 }))
      .sort((a, b) => b.probability - a.probability);

    let cumulative = 0;
    let nucleusFull = false;
    return ranked.map((item, rankIndex) => {
      const withinK = rankIndex < topK;
      cumulative += item.probability;
      const withinP = !nucleusFull;
      if (cumulative >= topP) nucleusFull = true;
      const kept = withinK && withinP;
      let cutBy: 'topK' | 'topP' | null = null;
      if (!withinK) cutBy = 'topK';
      else if (!withinP) cutBy = 'topP';
      return { ...item, kept, cutBy };
    });
  }, [candidates, temperature, topK, topP]);

  const keptMass = scored
    .filter((item) => item.kept)
    .reduce((total, item) => total + item.probability, 0);

  const renormalized = useMemo(
    () =>
      scored.map((item) => ({
        ...item,
        renormalized: item.kept && keptMass > 0 ? item.probability / keptMass : 0,
      })),
    [scored, keptMass],
  );

  const maxBar = Math.max(...renormalized.map((item) => item.renormalized), 0.001);

  return (
    <VizShell
      label={label}
      footer={
        <span>
          Сохранено {scored.filter((item) => item.kept).length} из {candidates.length} ·{' '}
          {topK >= candidates.length && topP >= 1
            ? 'без отсечения'
            : `масса ядра ${(keptMass * 100).toFixed(0)}%`}
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between text-[11px] text-fg-subtle">
              <span className="uppercase tracking-widest">{temperatureLabel}</span>
              <span className="font-mono tabular-nums text-fg">{temperature.toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={0.1}
              max={2}
              step={0.05}
              value={temperature}
              onChange={(event) => setTemperature(Number(event.target.value))}
              className="h-11 w-full cursor-pointer accent-[rgb(var(--accent-1))] sm:h-2"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between text-[11px] text-fg-subtle">
              <span className="uppercase tracking-widest">{topKLabel}</span>
              <span className="font-mono tabular-nums text-fg">{topK}</span>
            </span>
            <input
              type="range"
              min={1}
              max={candidates.length}
              step={1}
              value={topK}
              onChange={(event) => setTopK(Number(event.target.value))}
              className="h-11 w-full cursor-pointer accent-[rgb(var(--accent-1))] sm:h-2"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between text-[11px] text-fg-subtle">
              <span className="uppercase tracking-widest">{topPLabel}</span>
              <span className="font-mono tabular-nums text-fg">{topP.toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={topP}
              onChange={(event) => setTopP(Number(event.target.value))}
              className="h-11 w-full cursor-pointer accent-[rgb(var(--accent-1))] sm:h-2"
            />
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          {renormalized.map((item) => (
            <div key={item.token} className="flex items-center gap-2.5">
              <span
                className={cx(
                  'w-20 shrink-0 truncate text-right font-mono text-[12px]',
                  item.kept ? 'text-fg' : 'text-fg-subtle line-through',
                )}
                title={item.token}
              >
                {item.token}
              </span>
              <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-surface-2">
                <motion.div
                  className={cx(
                    'absolute inset-y-0 left-0 rounded-md',
                    item.kept ? 'bg-accent' : 'bg-border-strong',
                  )}
                  animate={{ width: `${(item.renormalized / maxBar) * 100}%` }}
                  transition={
                    reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30 }
                  }
                />
              </div>
              <span
                className={cx(
                  'w-16 shrink-0 text-right font-mono text-[11px] tabular-nums',
                  item.kept ? 'text-fg-muted' : 'text-fg-subtle',
                )}
              >
                {item.kept
                  ? `${(item.renormalized * 100).toFixed(1)}%`
                  : item.cutBy === 'topK'
                    ? 'top-k'
                    : 'top-p'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </VizShell>
  );
};
