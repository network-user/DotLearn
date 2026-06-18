import { useEffect, useMemo, useRef, useState } from 'react';

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Hash, RotateCw } from 'lucide-react';

import { cx } from '@/components/ui/cx';

import { VizButton, VizShell } from './VizShell';

interface HashTableVizProps {
  initialCapacity?: number;
  presetKeys?: string[];
  loadFactorThreshold?: number;
  label?: string;
}

interface Slot {
  key: string | null;
  hash: number | null;
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'probing'; key: string; home: number; index: number; collided: boolean }
  | { kind: 'placed'; key: string; slot: number; probes: number }
  | { kind: 'resizing'; key: string; from: number; to: number }
  | { kind: 'full' };

const STEP_MS = 650;
const DEFAULT_PRESETS = ['cat', 'dog', 'fox', 'owl', 'bee', 'ant', 'elk', 'jay'];

const hashKey = (key: string): number => {
  let total = 0;
  for (const char of key) total += char.codePointAt(0) ?? 0;
  return total;
};

const makeSlots = (capacity: number): Slot[] =>
  Array.from({ length: capacity }, () => ({ key: null, hash: null }));

const findFreeSlot = (slots: Slot[], home: number): number => {
  const capacity = slots.length;
  for (let step = 0; step < capacity; step += 1) {
    const index = (home + step) % capacity;
    if (slots[index]?.key === null) return index;
  }
  return -1;
};

const insertImmediate = (slots: Slot[], key: string): Slot[] => {
  const next = slots.map((slot) => ({ ...slot }));
  const hash = hashKey(key);
  const home = hash % next.length;
  const target = findFreeSlot(next, home);
  if (target === -1) return next;
  next[target] = { key, hash };
  return next;
};

const rehash = (slots: Slot[], capacity: number): Slot[] => {
  let grown = makeSlots(capacity);
  for (const slot of slots) {
    if (slot.key !== null) grown = insertImmediate(grown, slot.key);
  }
  return grown;
};

export const HashTableViz = ({
  initialCapacity = 8,
  presetKeys = DEFAULT_PRESETS,
  loadFactorThreshold = 2 / 3,
  label = 'Hash table',
}: HashTableVizProps) => {
  const reduceMotion = useReducedMotion();
  const [slots, setSlots] = useState<Slot[]>(() => makeSlots(initialCapacity));
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [typed, setTyped] = useState('');
  const timerRef = useRef<number | null>(null);

  const capacity = slots.length;
  const occupied = useMemo(() => slots.filter((slot) => slot.key !== null).length, [slots]);
  const loadFactor = occupied / capacity;
  const usedKeys = useMemo(
    () => new Set(slots.filter((slot) => slot.key !== null).map((slot) => slot.key)),
    [slots],
  );

  const busy = phase.kind === 'probing' || phase.kind === 'resizing';

  const clearTimer = (): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => clearTimer, []);

  const grow = (source: Slot[], onDone: (next: Slot[]) => void): void => {
    const nextCapacity = source.length * 2;
    if (reduceMotion) {
      onDone(rehash(source, nextCapacity));
      return;
    }
    setPhase({ kind: 'resizing', key: '', from: source.length, to: nextCapacity });
    timerRef.current = window.setTimeout(() => {
      const grown = rehash(source, nextCapacity);
      setSlots(grown);
      onDone(grown);
    }, STEP_MS * 1.4);
  };

  const insert = (rawKey: string): void => {
    const key = rawKey.trim();
    if (!key || busy || usedKeys.has(key)) return;
    clearTimer();
    setTyped('');

    const place = (table: Slot[]): void => {
      const hash = hashKey(key);
      const home = hash % table.length;
      const target = findFreeSlot(table, home);
      if (target === -1) {
        setPhase({ kind: 'full' });
        return;
      }

      if (reduceMotion) {
        const next = table.map((slot) => ({ ...slot }));
        next[target] = { key, hash };
        setSlots(next);
        const probes = (target - home + table.length) % table.length;
        setPhase({ kind: 'placed', key, slot: target, probes });
        return;
      }

      const walk = (index: number): void => {
        const collided = table[index]?.key !== null;
        setPhase({ kind: 'probing', key, home, index, collided });
        timerRef.current = window.setTimeout(() => {
          if (!collided) {
            const next = table.map((slot) => ({ ...slot }));
            next[index] = { key, hash };
            setSlots(next);
            const probes = (index - home + table.length) % table.length;
            setPhase({ kind: 'placed', key, slot: index, probes });
            return;
          }
          walk((index + 1) % table.length);
        }, STEP_MS);
      };
      walk(home);
    };

    const willOverflow = (occupied + 1) / capacity > loadFactorThreshold;
    if (willOverflow) {
      grow(slots, (grown) => place(grown));
    } else {
      place(slots);
    }
  };

  const reset = (): void => {
    clearTimer();
    setSlots(makeSlots(initialCapacity));
    setPhase({ kind: 'idle' });
    setTyped('');
  };

  const probingHash = phase.kind === 'probing' ? hashKey(phase.key) : null;

  const footer = (() => {
    switch (phase.kind) {
      case 'idle':
        return 'Insert a key. It is hashed, then placed at its home slot — or the next free one.';
      case 'probing':
        return phase.collided ? (
          <span>
            <span className="font-mono text-accent">{phase.key}</span> wants slot{' '}
            <span className="font-mono">{phase.index}</span> — taken, linear-probing onward.
          </span>
        ) : (
          <span>
            <span className="font-mono text-accent">{phase.key}</span> hashes to{' '}
            <span className="font-mono">{probingHash}</span> → home slot{' '}
            <span className="font-mono">{phase.home}</span>.
          </span>
        );
      case 'placed':
        return (
          <span className="text-ok">
            Placed <span className="font-mono">{phase.key}</span> at slot{' '}
            <span className="font-mono">{phase.slot}</span>
            {phase.probes > 0 ? ` after ${phase.probes} probe${phase.probes > 1 ? 's' : ''}.` : '.'}
          </span>
        );
      case 'resizing':
        return (
          <span className="text-warn">
            Load factor crossed {(loadFactorThreshold * 100).toFixed(0)}% — resizing {phase.from} →{' '}
            {phase.to} and rehashing every key.
          </span>
        );
      case 'full':
        return <span className="text-err">Table is full — no free slot for this key.</span>;
    }
  })();

  return (
    <VizShell
      label={label}
      actions={
        <VizButton onClick={reset} tone="ghost" disabled={busy}>
          <RotateCw size={12} />
          Reset
        </VizButton>
      }
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3 text-[12px]">
            <span className="inline-flex items-center gap-1.5 text-fg-subtle uppercase tracking-widest text-[10px]">
              <Hash size={11} />
              capacity
            </span>
            <span className="font-mono text-fg">{capacity}</span>
            <span className="text-border-strong">·</span>
            <span className="text-fg-subtle uppercase tracking-widest text-[10px]">load</span>
            <span
              className={cx(
                'font-mono tabular-nums',
                loadFactor > loadFactorThreshold ? 'text-warn' : 'text-fg',
              )}
            >
              {occupied}/{capacity} = {loadFactor.toFixed(2)}
            </span>
          </div>

          <div className="relative h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-surface-2">
            <motion.div
              className={cx(
                'absolute inset-y-0 left-0 rounded-full',
                loadFactor > loadFactorThreshold ? 'bg-warn' : 'bg-accent',
              )}
              animate={{ width: `${Math.min(loadFactor, 1) * 100}%` }}
              transition={
                reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30 }
              }
            />
            <div
              className="absolute inset-y-0 w-px bg-border-strong"
              style={{ left: `${loadFactorThreshold * 100}%` }}
            />
          </div>
        </div>

        <LayoutGroup>
          <motion.div
            className="flex flex-wrap gap-2"
            animate={
              phase.kind === 'resizing' && !reduceMotion
                ? { opacity: [1, 0.45, 1] }
                : { opacity: 1 }
            }
            transition={{ duration: STEP_MS / 1000 }}
          >
            {slots.map((slot, index) => {
              const isHome = phase.kind === 'probing' && phase.home === index;
              const isProbe = phase.kind === 'probing' && phase.index === index;
              const justPlaced = phase.kind === 'placed' && phase.slot === index;
              const filled = slot.key !== null;

              return (
                <div key={index} className="flex flex-col items-center gap-1">
                  <motion.div
                    layout={!reduceMotion}
                    animate={
                      isProbe && !reduceMotion
                        ? phase.collided
                          ? { scale: [1, 0.94, 1] }
                          : { scale: 1.06 }
                        : justPlaced && !reduceMotion
                          ? { scale: [1.12, 1] }
                          : { scale: 1 }
                    }
                    transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                    className={cx(
                      'relative flex h-12 w-12 items-center justify-center rounded-lg border font-mono text-[12.5px] transition-colors duration-fast',
                      isProbe
                        ? phase.collided
                          ? 'border-err/60 bg-err/10 text-err'
                          : 'border-accent/70 bg-accent/12 text-accent'
                        : justPlaced
                          ? 'border-ok/60 bg-ok/12 text-ok'
                          : filled
                            ? 'border-border-strong bg-surface-2 text-fg'
                            : 'border-dashed border-border-base bg-surface text-fg-subtle',
                      isHome && !isProbe && 'ring-1 ring-accent/40',
                    )}
                  >
                    <AnimatePresence mode="popLayout" initial={false}>
                      {slot.key !== null ? (
                        <motion.span
                          key={slot.key}
                          initial={reduceMotion ? false : { opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          {...(reduceMotion ? {} : { exit: { opacity: 0, y: 6 } })}
                          transition={{ duration: 0.2 }}
                        >
                          {slot.key}
                        </motion.span>
                      ) : (
                        <span className="text-fg-subtle/60">·</span>
                      )}
                    </AnimatePresence>
                    {isProbe && phase.collided && (
                      <ArrowRight
                        size={13}
                        className="absolute -right-3.5 top-1/2 -translate-y-1/2 text-err"
                      />
                    )}
                  </motion.div>
                  <span
                    className={cx(
                      'font-mono text-[10px] tabular-nums',
                      isHome ? 'text-accent' : 'text-fg-subtle',
                    )}
                  >
                    {index}
                  </span>
                </div>
              );
            })}
          </motion.div>
        </LayoutGroup>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              insert(typed);
            }}
          >
            <input
              type="text"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder="key"
              disabled={busy}
              className="form-input h-8 w-28 rounded-md border border-border-base bg-surface px-2.5 font-mono text-[16px] text-fg placeholder:text-fg-subtle focus:border-accent/60 focus:outline-none disabled:opacity-50 sm:text-[13px]"
            />
            <VizButton onClick={() => insert(typed)} disabled={busy || typed.trim().length === 0}>
              insert
            </VizButton>
          </form>

          <div className="flex flex-wrap gap-1.5">
            {presetKeys.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => insert(preset)}
                disabled={busy || usedKeys.has(preset)}
                className={cx(
                  'rounded-md border border-border-base bg-surface px-2 py-1 font-mono text-[11.5px] transition-colors duration-fast',
                  'hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-35',
                  usedKeys.has(preset) ? 'text-fg-subtle line-through' : 'text-fg-muted',
                )}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>
    </VizShell>
  );
};
