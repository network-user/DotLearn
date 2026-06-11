import { useEffect, useMemo, useRef, useState } from 'react';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Search } from 'lucide-react';

import { cx } from '@/components/ui/cx';

import { VizButton, VizShell } from './VizShell';

interface KvEntry {
  key: string;
  value: string;
}

interface KeyValueStoreFigureProps {
  entries?: KvEntry[];
  buckets?: number;
  label?: string;
  idleHint?: string;
}

const defaultEntries: KvEntry[] = [
  { key: 'user:1001', value: 'Анна' },
  { key: 'session:ab12', value: 'токен входа' },
  { key: 'cart:1001', value: '[книга, кофе]' },
  { key: 'views:home', value: '48213' },
];

const STEP_MS = 600;

const hashKey = (key: string, mod: number): number => {
  let total = 0;
  for (const char of key) total += char.codePointAt(0) ?? 0;
  return total % mod;
};

type Phase =
  | { kind: 'idle' }
  | { kind: 'looking'; key: string; bucket: number }
  | { kind: 'hit'; key: string; bucket: number; value: string }
  | { kind: 'miss'; key: string; bucket: number };

export const KeyValueStoreFigure = ({
  entries = defaultEntries,
  buckets = 6,
  label = 'Хранилище ключ-значение',
  idleHint = 'Запросите ключ через GET. Ключ хешируется в номер корзины, и значение находится за один шаг, это сложность O(1).',
}: KeyValueStoreFigureProps) => {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [typed, setTyped] = useState('');
  const timerRef = useRef<number | null>(null);

  const layout = useMemo(() => {
    const slots: (KvEntry | null)[] = Array.from({ length: buckets }, () => null);
    for (const entry of entries) {
      let index = hashKey(entry.key, buckets);
      for (let step = 0; step < buckets; step += 1) {
        const probe = (index + step) % buckets;
        if (slots[probe] === null) {
          slots[probe] = entry;
          index = probe;
          break;
        }
      }
    }
    return slots;
  }, [entries, buckets]);

  const slotOf = useMemo(() => {
    const map = new Map<string, number>();
    layout.forEach((entry, index) => {
      if (entry) map.set(entry.key, index);
    });
    return map;
  }, [layout]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const busy = phase.kind === 'looking';

  const get = (rawKey: string): void => {
    const key = rawKey.trim();
    if (!key || busy) return;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);

    const bucket = slotOf.get(key) ?? hashKey(key, buckets);
    const found = slotOf.has(key);
    const entry = found ? layout[bucket] : null;

    if (reduceMotion) {
      setPhase(
        entry ? { kind: 'hit', key, bucket, value: entry.value } : { kind: 'miss', key, bucket },
      );
      return;
    }

    setPhase({ kind: 'looking', key, bucket });
    timerRef.current = window.setTimeout(() => {
      setPhase(
        entry ? { kind: 'hit', key, bucket, value: entry.value } : { kind: 'miss', key, bucket },
      );
    }, STEP_MS);
  };

  const footer = (() => {
    switch (phase.kind) {
      case 'idle':
        return idleHint;
      case 'looking':
        return (
          <span>
            <span className="font-mono text-accent">{phase.key}</span> → хеш → корзина{' '}
            <span className="font-mono">{phase.bucket}</span>…
          </span>
        );
      case 'hit':
        return (
          <span className="text-ok">
            <span className="font-mono">{phase.key}</span> → «{phase.value}» за один шаг.
          </span>
        );
      case 'miss':
        return (
          <span className="text-warn">
            <span className="font-mono">{phase.key}</span> → корзина пуста, вернётся nil.
          </span>
        );
    }
  })();

  const activeBucket =
    phase.kind === 'idle' ? null : phase.bucket;
  const hitValue = phase.kind === 'hit' ? phase.value : null;

  return (
    <VizShell label={label} footer={footer}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {layout.map((entry, index) => {
            const isActive = activeBucket === index;
            return (
              <div key={index} className="flex flex-col items-center gap-1">
                <motion.div
                  animate={isActive && !reduceMotion ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className={cx(
                    'flex h-12 min-w-[64px] items-center justify-center rounded-lg border px-2 font-mono text-[11px] transition-colors duration-fast',
                    isActive
                      ? phase.kind === 'miss'
                        ? 'border-warn/60 bg-warn/10 text-warn'
                        : 'border-accent/70 bg-accent/12 text-accent'
                      : entry
                        ? 'border-border-strong bg-surface-2 text-fg'
                        : 'border-dashed border-border-base bg-surface text-fg-subtle',
                  )}
                >
                  {entry ? entry.key : '·'}
                </motion.div>
                <span className="font-mono text-[10px] tabular-nums text-fg-subtle">{index}</span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 min-h-[28px]">
          <AnimatePresence mode="wait">
            {hitValue !== null && (
              <motion.div
                key={hitValue}
                initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="inline-flex items-center gap-2 rounded-md border border-ok/40 bg-ok/8 px-3 py-1.5 font-mono text-[12.5px] text-fg"
              >
                <ArrowRight size={13} className="text-ok" />
                {hitValue}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              get(typed);
            }}
          >
            <input
              type="text"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder="ключ"
              disabled={busy}
              className="form-input h-8 w-36 rounded-md border border-border-base bg-surface px-2.5 font-mono text-[16px] text-fg placeholder:text-fg-subtle focus:border-accent/60 focus:outline-none disabled:opacity-50 sm:text-[13px]"
            />
            <VizButton onClick={() => get(typed)} disabled={busy || typed.trim().length === 0}>
              <Search size={12} />
              GET
            </VizButton>
          </form>

          <div className="flex flex-wrap gap-1.5">
            {entries.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => get(entry.key)}
                disabled={busy}
                className={cx(
                  'rounded-md border border-border-base bg-surface px-2 py-1 font-mono text-[11px] text-fg-muted transition-colors duration-fast',
                  'hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40',
                )}
              >
                {entry.key}
              </button>
            ))}
          </div>
        </div>
      </div>
    </VizShell>
  );
};
